import { supabase } from '/public/js/supabaseClient.js';

// Helper: Generate a simple code from username/id
function generateCode(username, userId) {
  return (username || 'user') + '-' + (userId || '').slice(0, 8);
}

// Get or create a referral link for the logged-in user
export async function getOrCreateReferralLink() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Check for existing link
  const { data: userData, error: err1 } = await supabase
    .from('users_extended_data')
    .select('username')
    .eq('user_id', user.id)
    .single();
  if (err1 || !userData) return null;

  const { data: existing, error: err2 } = await supabase
    .from('referral_links')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (existing) {
    return window.location.origin + '/register.html?ref=' + encodeURIComponent(existing.code);
  }

  // Create a new link
  const code = generateCode(userData.username, user.id);
  const { data: created, error: err3 } = await supabase
    .from('referral_links')
    .insert([{ user_id: user.id, code }])
    .select()
    .single();
  if (err3) return null;

  return window.location.origin + '/register.html?ref=' + encodeURIComponent(code);
}

// Display the referral link on dashboard
export async function showReferralLink(selector = "#referral-link-box") {
  const link = await getOrCreateReferralLink();
  const el = document.querySelector(selector);
  if (el) {
    el.innerHTML = link
      ? `<div>Your referral link:<br><input readonly value="${link}" style="width:80%"><button onclick="navigator.clipboard.writeText('${link}')">Copy</button></div>`
      : `<div>Unable to generate referral link.</div>`;
  }
}
