// ./js/badges.js
import { supabase } from './supabaseClient.js'

/**
 * Injects unlocked offer badges (bronze, silver, gold) and social OAuth badges (platform logos).
 * Affiliate badge is shown on the same line as medals.
 * Social badges are rendered on a NEW LINE beneath.
 */
export async function injectUserBadge(userEmail, selector, emailField = 'sponsor_email') {
  let reviewCompletedCount = 0
  let isAffiliate = false

  // 1) Offer-based badges (bronze/silver/gold)
  try {
    const { count, error } = await supabase
      .from('private_offers')
      .select('*', { count: 'exact', head: true })
      .eq(emailField, userEmail)
      .eq('status', 'review_completed')

    if (error) throw error
    reviewCompletedCount = count || 0
  } catch (e) {
    console.warn('Could not load offer badge count:', e)
  }

  // 2) Check if user is an affiliate
  let userRow = null
  try {
    const { data, error } = await supabase
      .from('users_extended_data')
      .select('user_id')
      .eq('email', userEmail)
      .maybeSingle()
    if (error) throw error
    userRow = data

    if (userRow?.user_id) {
      const { data: aff, error: affErr } = await supabase
        .from('affiliate_partners')
        .select('id')
        .eq('user_id', userRow.user_id)
        .limit(1)
        .maybeSingle()
      if (affErr) throw affErr
      if (aff) isAffiliate = true
    }
  } catch (e) {
    console.warn('Could not check affiliate status:', e)
  }

  // 3) Build medals row (offer badges + affiliate if applicable)
  const levelBadges = []
  if (reviewCompletedCount >= 10)  levelBadges.push('bronze')
  if (reviewCompletedCount >= 25)  levelBadges.push('silver')
  if (reviewCompletedCount >= 50) levelBadges.push('gold')

  let levelHTML = ''
  if (levelBadges.length || isAffiliate) {
    const medals = levelBadges
      .map(level => {
        const label = level.charAt(0).toUpperCase() + level.slice(1)
        return `<span class="badge badge-${level}" title="${label} Verified"></span>`
      })
      .join(' ')

    const affiliateIcon = isAffiliate
      ? `<img class="badge-affiliate" src="affiliate.png" alt="Affiliate partner" title="Affiliate partner" 
           style="height:24px;width:24px;vertical-align:middle;display:inline-block;margin-left:8px;border-radius:8px">`
      : ''

    const countBadge = reviewCompletedCount
      ? `<span class="badge-count" style="margin-left:5px; font-size:13px; vertical-align:middle;">${reviewCompletedCount}</span>`
      : ''

    levelHTML = medals + countBadge + affiliateIcon
  }

  // 4) Social OAuth badges (still on separate line)
  const SOCIAL_FIELDS = [
    'youtube_connected',
    'twitch_connected',
    'instagram_connected',
    'facebook_connected',
    'tiktok_connected'
    // 'twitter_connected'
  ]
  const SOCIAL_LOGOS = {
    youtube_connected:   { src: 'youtubelogo.png',   title: 'YouTube connected' },
    twitch_connected:    { src: 'twitchlogo.png',    title: 'Twitch connected' },
    instagram_connected: { src: 'instagramlogo.png', title: 'Instagram connected' },
    facebook_connected:  { src: 'facebooklogo.png',  title: 'Facebook connected' },
    tiktok_connected:    { src: 'tiktoklogo.png',    title: 'TikTok connected' },
    twitter_connected:   { src: 'twitterlogo.png',   title: 'Twitter/X connected' }
  }

  let socialHTML = ''
  try {
    const { data: socials, error } = await supabase
      .from('users_extended_data')
      .select(SOCIAL_FIELDS.join(','))
      .eq('email', userEmail)
      .maybeSingle()
    if (error) throw error

    if (socials) {
      const icons = []
      for (const key of SOCIAL_FIELDS) {
        if (socials[key]) {
          const { src, title } = SOCIAL_LOGOS[key] || {}
          if (src) {
            icons.push(
              `<img class="badge-social" src="${src}" alt="${title}" title="${title}" 
                style="height:24px;width:24px;vertical-align:middle;display:inline-block;margin-right:8px;border-radius:8px">`
            )
          }
        }
      }
      socialHTML = icons.join('')
    }
  } catch (e) {
    console.warn('Could not load social badges:', e)
  }

  // 5) Inject into DOM
  const badgeSlot = document.querySelector(selector)
  if (badgeSlot) {
    const rows = []
    if (levelHTML) {
      rows.push(`<div class="badge-row badge-tier-row" aria-label="Offer/Affiliate badges">${levelHTML}</div>`)
    }
    if (socialHTML) {
      rows.push(`<div class="badge-row badge-social-row" aria-label="Connected platforms" style="margin-top:6px;">${socialHTML}</div>`)
    }
    badgeSlot.innerHTML = rows.join('')
  }
}
