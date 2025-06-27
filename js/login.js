import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://mqixtrnhotqqybaghgny.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xaXh0cm5ob3RxcXliYWdoZ255Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU0NzM1OTcsImV4cCI6MjA2MTA0OTU5N30.mlRfsBXfHkRv8SVQHHPUSDiI74ROs55xdq-yRS-XYnY';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function processReferralReward(user) {
  // Fetch extended user data again (to get referral_code if still present)
  const { data: ext, error: extErr } = await supabase
    .from('users_extended_data')
    .select('referral_code')
    .eq('user_id', user.id)
    .single();

  if (extErr) {
    console.warn('[Referral Reward] Could not fetch extended user data:', extErr.message);
    return;
  }

  const referral_code = ext?.referral_code;
  if (!referral_code) {
    // Already rewarded or never had referral
    return;
  }

  // Get JWT (must be fresh)
  const { data: sessionData } = await supabase.auth.getSession();
  const jwt = sessionData?.session?.access_token;

  if (!jwt) {
    console.warn('[Referral Reward] No JWT available. Cannot call edge function.');
    return;
  }

  try {
    const response = await fetch('https://mqixtrnhotqqybaghgny.supabase.co/functions/v1/referral_rewards', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`
      },
      body: JSON.stringify({ referred_user_id: user.id })
    });
    const result = await response.json();
    if (response.ok && result.success) {
      // Optionally, show a toast/alert for successful reward
      console.log('[Referral Reward] Reward processed:', result);
    } else if (response.status === 409) {
      // Already granted
      console.log('[Referral Reward] Already granted:', result.error);
    } else {
      console.warn('[Referral Reward] Error:', result.error || result.details);
    }
  } catch (e) {
    console.warn('[Referral Reward] Exception calling edge function:', e);
  }
}

document.getElementById('loginForm').addEventListener('submit', async function (e) {
  e.preventDefault();

  const email = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();

  // Attempt to sign in
  const { data, error: loginError } = await supabase.auth.signInWithPassword({ email, password });

  if (loginError) {
    alert('Login failed: ' + loginError.message);
    return;
  }

  // Force fetch fresh user object (with up-to-date confirmed_at)
  const { data: freshUserData, error: userFetchError } = await supabase.auth.getUser();
  if (userFetchError) {
    alert('Failed to fetch fresh user data: ' + userFetchError.message);
    return;
  }

  const freshUser = freshUserData.user;
  console.log('Fresh user:', freshUser);

  // Fetch extended user data from your custom table
  const { data: extendedData, error: dataError } = await supabase
    .from('users_extended_data')
    .select('userType, referral_code')
    .eq('user_id', freshUser.id)
    .single();

  if (dataError || !extendedData) {
    alert('Failed to fetch user data: ' + (dataError?.message || 'No extended data found.'));
    return;
  }

  // Check if email is confirmed
  const isEmailConfirmed = !!freshUser.confirmed_at;

  // (Optional but recommended) Sync email_verified field in your custom table
  const { error: updateError } = await supabase
    .from('users_extended_data')
    .update({ email_verified: isEmailConfirmed })
    .eq('user_id', freshUser.id);

  if (updateError) {
    console.warn('Failed to sync email_verified field:', updateError.message);
  }

  // 🟢 Run referral reward grant only if email is confirmed and referral_code exists
  if (isEmailConfirmed && extendedData.referral_code) {
    await processReferralReward(freshUser);
    // Optionally: Could alert user, show notification, etc.
  }

  // Redirect based on verification
  if (!isEmailConfirmed) {
    alert('Email not verified yet. Redirecting to limited dashboard.');
    window.location.href = 'limited-dashboard.html';
    return;
  }

  // Redirect based on user type
  const userType = extendedData.userType?.toLowerCase();
  if (userType === 'sponsor') {
    window.location.href = 'dashboardsponsor.html';
  } else if (userType === 'besponsored') {
    window.location.href = 'dashboardsponsee.html';
  } else {
    alert('Unknown user type. Please contact support.');
  }
});
