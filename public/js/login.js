import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://mqixtrnhotqqybaghgny.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xaXh0cm5ob3RxcXliYWdoZ255Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU0NzM1OTcsImV4cCI6MjA2MTA0OTU5N30.mlRfsBXfHkRv8SVQHHPUSDiI74ROs55xdq-yRS-XYnY';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
    .select('userType')
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
