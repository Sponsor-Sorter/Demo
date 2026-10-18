const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROFILE_FIELDS = ['user_id', 'username', 'userType', 'contenttype', 'platforms', 'target_audience', 'preferred_content_format', 'partnership_type', 'minfollowers', 'location', 'social_handles', 'profile_pic', 'planType'];
const unavailable = () => new Error('Partner recommendations could not be loaded. Please retry.');
const PLATFORMS = ['youtube', 'instagram', 'tiktok', 'twitch', 'facebook', 'twitter', 'snapchat'];
function publicProfile(value) {
  const profile = Object.fromEntries(PROFILE_FIELDS.filter(key => Object.hasOwn(value, key)).map(key => [key, value[key]]));
  const textLimits = {username:80,contenttype:400,target_audience:400,preferred_content_format:400,partnership_type:400,minfollowers:100,location:200,profile_pic:1024};
  for (const [key, max] of Object.entries(textLimits)) {
    const item = profile[key];
    if (item != null && (typeof item !== 'string' || item.length > max)) throw unavailable();
  }
  if (typeof profile.planType !== 'string' || (profile.platforms != null && (!Array.isArray(profile.platforms) || profile.platforms.length > 16 || profile.platforms.some(p=>typeof p !== 'string' || p.length > 100)))) throw unavailable();
  const handles = profile.social_handles;
  if (!handles || typeof handles !== 'object' || Array.isArray(handles) || Object.entries(handles).some(([key,value])=>!PLATFORMS.includes(key) || value !== true)) throw unavailable();
  return profile;
}
function strings(value) {
  if (!Array.isArray(value) || value.length > 32 || value.some(v => typeof v !== 'string' || v.length > 1000)) throw unavailable();
  return [...value];
}

export function validatePartnerRecommendations(data, viewerId, limit = 6) {
  if (!UUID.test(viewerId) || data?.ok !== true || data.mode !== 'partners' || data.algorithm_version !== 'partner-v2' ||
      !['sponsor', 'besponsored'].includes(data.viewer_role) || data.scoring?.max_points !== 105 ||
      data.scoring?.score_type !== 'compatibility_points' || !Array.isArray(data.matches) || data.matches.length > limit) throw unavailable();
  const ids = new Set();
  const role = data.viewer_role;
  const matches = data.matches.map(match => {
    if (!match || typeof match !== 'object') throw unavailable();
    const id = match.partner_user_id;
    if (!UUID.test(id) || id === viewerId || ids.has(id) || match.offer_id !== null ||
        match.profile?.user_id !== id || match.profile.userType !== (role === 'sponsor' ? 'besponsored' : 'sponsor') ||
        match.sponsor_id !== (role === 'sponsor' ? viewerId : id) || match.sponsee_id !== (role === 'sponsor' ? id : viewerId) ||
        !Number.isInteger(match.match_score) || match.match_score < 0 || match.match_score > 105 ||
        match.raw_points !== match.match_score || typeof match.saved !== 'boolean' ||
        !['reported', 'missing', 'stale'].includes(match.follower_data_status)) throw unavailable();
    if (match.follower_data_status === 'reported') {
      if (!Number.isSafeInteger(match.followers) || match.followers < 0) throw unavailable();
    } else if (match.followers !== null) throw unavailable();
    ids.add(id);
    const profile = publicProfile(match.profile);
    return { profile, reasons: strings(match.reasons), missing: strings(match.missing), saved: match.saved,
      followers: match.followers, follower_data_status: match.follower_data_status };
  });
  return { viewerId, viewerRole: role, matches };
}

export async function loadPartnerRecommendations(client, { limit = 6, signal } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 12) throw unavailable();
  const { data: auth, error: authError } = await client.auth.getSession();
  const session = auth?.session;
  if (authError || !session?.access_token || !UUID.test(session.user?.id || '')) {
    throw new Error('Sign in to see partners selected for your profile.');
  }
  const { data, error } = await client.functions.invoke('calculate_match_scores', { body: { limit }, signal });
  if (error || data?.ok === false) {
    let failure = data;
    if (!failure && error?.context?.json) {
      try { failure = await error.context.json(); } catch { /* No additional request. */ }
    }
    const messages = {
      SIGN_IN_REQUIRED: 'Sign in again to see partner recommendations.',
      CURRENT_SESSION_REQUIRED: 'A current signed-in, unblocked account is required to see partners.',
      ACCOUNT_UNAVAILABLE: 'Partner recommendations are unavailable for this account.',
      ACCOUNT_TYPE_REQUIRED: 'Complete your account type to find partners.',
      CAPACITY_EXCEEDED: 'Recommendations are temporarily unavailable. You can use profile search below.',
    };
    throw new Error(messages[failure?.code] || unavailable().message);
  }
  return validatePartnerRecommendations(data, session.user.id, limit);
}
