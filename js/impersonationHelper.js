import { supabase } from './supabaseClient.js';

/**
 * Returns the user object to use for all data access and display.
 * - If admin is impersonating, returns that user's data (with __impersonated = true)
 * - Otherwise returns current logged-in user's data (with __impersonated = false)
 * Returns null if not logged in or user not found.
 */
export async function getActiveUser() {
  const impersonateId = localStorage.getItem("impersonate_user_id");
  if (impersonateId) {
    const { data: user, error } = await supabase
      .from('users_extended_data')
      .select('*')
      .eq('user_id', impersonateId)
      .single();
    if (user) {
      user.__impersonated = true;
      return user;
    }
    localStorage.removeItem("impersonate_user_id");
  }
  // Fallback: get real logged-in user
  const { data: { session } } = await supabase.auth.getSession();
  if (!session || !session.user) return null;
  const { data: user } = await supabase
    .from('users_extended_data')
    .select('*')
    .eq('user_id', session.user.id)
    .single();
  if (user) user.__impersonated = false;
  return user;
}

/**
 * Show an impersonation banner if in impersonation mode.
 */
export function showImpersonationBanner(user) {
  if (user && user.__impersonated) {
    let banner = document.getElementById('impersonation-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'impersonation-banner';
      banner.style = "background:#F6C62E;color:#111;padding:0.5rem;text-align:center;font-weight:bold;z-index:11000;";
      banner.textContent = `⚠️  Impersonating: ${user.username || user.email}. Click here to stop.`;
      banner.onclick = () => {
        localStorage.removeItem("impersonate_user_id");
        window.location.reload();
      };
      document.body.prepend(banner);
    }
  } else {
    const banner = document.getElementById('impersonation-banner');
    if (banner) banner.remove();
  }
}
