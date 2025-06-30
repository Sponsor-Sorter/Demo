import { supabase } from './supabaseClient.js'; // If not already imported

document.addEventListener('DOMContentLoaded', async () => {
  const statusDiv = document.getElementById('oauth-status');

  // Parse URL params
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const error = urlParams.get('error');

  if (error) {
    statusDiv.innerHTML = `<span style="color:red;">Google OAuth failed: ${error}</span>`;
    return;
  }
  if (!code) {
    statusDiv.innerHTML = `<span style="color:red;">No OAuth code found. Please try connecting again.</span>`;
    return;
  }
  statusDiv.innerHTML = `<span style="color:#4886f4;">Connecting to YouTube, please wait...</span>`;

  try {
    const redirectUri = window.location.origin + window.location.pathname;

    // Get the current Supabase session JWT
    const { data: { session } } = await supabase.auth.getSession();
    const jwt = session?.access_token;
    if (!jwt) throw new Error("Not logged in or missing session.");

    // POST code and redirect_uri to backend API for token exchange
    const resp = await fetch('https://mqixtrnhotqqybaghgny.supabase.co/functions/v1/youtube-oauth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`,
      },
      body: JSON.stringify({ code, redirect_uri: redirectUri }),
      credentials: 'include',
    });

    const data = await resp.json();

    if (!resp.ok) {
      throw new Error(data.error || data.message || 'Unknown error');
    }

    statusDiv.innerHTML = `<span style="color:green;">YouTube account successfully connected! Redirecting to your dashboard...</span>`;
   // Instead of setTimeout(() => window.location.href = '...'), do:
if (window.opener) {
  // Tell the parent window to refresh YouTube status, then close this popup
  window.opener.postMessage({ youtubeConnected: true }, "*");
  window.close();
} else {
  // If not a popup, fallback to redirect
  window.location.href = './dashboardsponsee.html';
}

  } catch (err) {
    statusDiv.innerHTML = `<span style="color:red;">Failed to connect YouTube: ${err.message}</span>`;
  }
});
