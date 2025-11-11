// ./js/privacy.js
import { supabase } from './supabaseClient.js';

/* =========================
   Existing: Export / Delete
========================= */
document.getElementById('privacy-export-btn').onclick = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return alert("Not logged in");
  const { error } = await supabase
    .from('user_privacy_requests')
    .insert([{ user_id: session.user.id, email: session.user.email, type: 'export' }]);
  if (!error) alert("Your export request was submitted. We’ll email you or update the status here.");
  else alert("Error: " + error.message);
};

document.getElementById('privacy-delete-btn').onclick = async () => {
  if (!confirm("Are you sure? This will permanently delete your account and all related data (after verification).")) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return alert("Not logged in");
  const { error } = await supabase
    .from('user_privacy_requests')
    .insert([{ user_id: session.user.id, email: session.user.email, type: 'delete' }]);
  if (!error) alert("Your delete request was submitted. We’ll contact you for confirmation.");
  else alert("Error: " + error.message);
};

async function showPrivacyRequestStatus() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;
  const { data: requests } = await supabase
    .from('user_privacy_requests')
    .select('*')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false });
  let html = '';
  if (!requests || requests.length === 0) html = '';
  else {
    html = '<ul>' + requests.map(req =>
      `<li>
        ${req.type.toUpperCase()} — <b>${req.status}</b> (${new Date(req.created_at).toLocaleString()})
        ${req.result_url ? ` <a href="${req.result_url}" download>Download</a>` : ''}
        ${req.status === 'pending'
          ? `<button class="cancel-privacy-request-btn" data-id="${req.id}" title="Cancel Request" style="color:#f33;border:none;background:transparent;font-weight:bold;font-size:1.2em;margin-left:8px;cursor:pointer;box-shadow:none;">×</button>`
          : ''}
      </li>`
    ).join('') + '</ul>';
  }
  const statusEl = document.getElementById('privacy-request-status');
  if (statusEl) statusEl.innerHTML = html;

  document.querySelectorAll('.cancel-privacy-request-btn').forEach(btn => {
    btn.onclick = async function () {
      if (!confirm("Are you sure you want to remove/cancel this request?")) return;
      const id = this.getAttribute('data-id');
      const { error } = await supabase
        .from('user_privacy_requests')
        .delete()
        .eq('id', id)
        .eq('status', 'pending');
      if (!error) {
        showPrivacyRequestStatus();
      } else {
        alert("Could not cancel the request.");
      }
    };
  });
}
showPrivacyRequestStatus();

/* =========================
   New: Public Dashboard
========================= */
// Elements may not exist on every page; guard everything.
const $ = (id) => document.getElementById(id);
const elToggle = $('public-dash-toggle');
const elRow    = $('public-dash-row');
const elSlug   = $('public-dash-slug');
const elSave   = $('public-dash-save');
const elLink   = $('public-dash-link');
const elCopy   = $('public-dash-copy');
const elMsg    = $('public-dash-status');

// If the UI isn't present, skip the rest.
if (elToggle && elRow && elSlug && elSave && elLink && elCopy && elMsg) {
  const PUBLIC_BASE = `${location.origin}/u/index.html?u=`;

  const setMsg = (text, ok = true) => {
    elMsg.textContent = text || '';
    elMsg.style.color = ok ? 'inherit' : '#e33';
  };

  const sanitizeSlug = (val) => {
    if (!val) return '';
    // Allow letters, numbers, hyphen, underscore; must start with alnum; 3-40 chars
    let s = String(val).trim().replace(/\s+/g, '-');
    s = s.replace(/[^a-zA-Z0-9_-]/g, '');
    // Ensure starts with alnum
    s = s.replace(/^[^a-zA-Z0-9]+/, '');
    if (s.length < 3) return s;
    return s.slice(0, 40);
  };

  const randomSuffix = () => Math.random().toString(36).slice(2, 6);

  const buildUrl = (slug) => `${PUBLIC_BASE}${slug || ''}`;

  const updatePreviewLink = (slug) => {
    const url = buildUrl(slug || '');
    elLink.href = slug ? url : '#';
    elLink.textContent = slug ? 'Open public page' : 'Open public page';
    elLink.style.pointerEvents = slug ? 'auto' : 'none';
    elLink.style.opacity = slug ? '1' : '.5';
  };

  const showRow = (show) => {
    elRow.style.display = show ? 'block' : 'none';
  };

  async function loadPublicState() {
    setMsg('Loading…');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      setMsg('Not logged in', false);
      return;
    }
    const { data, error } = await supabase
      .from('users_extended_data')
      .select('public_dashboard_enabled, public_dashboard_slug, username, email, user_id')
      .eq('user_id', session.user.id)
      .single();

    if (error || !data) {
      setMsg('Could not load settings.', false);
      return;
    }

    const enabled = !!data.public_dashboard_enabled;
    const slug    = data.public_dashboard_slug || '';
    elToggle.checked = enabled;
    showRow(enabled);
    elSlug.value = slug || '';
    updatePreviewLink(slug);

    // If enabled but no slug (should not happen due to CHECK), suggest one
    if (enabled && !slug) {
      const suggested = suggestSlug(data.username, data.email, data.user_id);
      elSlug.value = suggested;
      updatePreviewLink(suggested);
    }
    setMsg('');
  }

  function suggestSlug(username, email, userId) {
    const baseFromUsername = username ? String(username) : '';
    const baseFromEmail = email ? String(email).split('@')[0] : '';
    const base = sanitizeSlug(baseFromUsername || baseFromEmail || (userId ? String(userId).slice(0, 8) : 'user'));
    return base || `user-${randomSuffix()}`;
  }

  async function saveEnabled(newEnabled) {
    setMsg('Saving…');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setMsg('Not logged in', false); return; }

    // If enabling and no slug in the input, propose one
    let slug = sanitizeSlug(elSlug.value);
    if (newEnabled && !slug) {
      // Load username/email to suggest
      const { data: userRow } = await supabase
        .from('users_extended_data')
        .select('username,email,user_id')
        .eq('user_id', session.user.id)
        .single();
      slug = suggestSlug(userRow?.username, userRow?.email, userRow?.user_id);
      elSlug.value = slug;
    }

    // When disabling, keep the slug as-is (user keeps their URL reserved), only flip the flag.
    const payload = newEnabled
      ? { public_dashboard_enabled: true, public_dashboard_slug: slug }
      : { public_dashboard_enabled: false };

    const { error } = await supabase
      .from('users_extended_data')
      .update(payload)
      .eq('user_id', session.user.id);

    if (error) {
      // Unique violation
      if (error.code === '23505') {
        setMsg('That link is taken. Try a different one.', false);
        elToggle.checked = false; // roll back enable
        showRow(false);
        return;
      }
      setMsg('Could not save. Please try again.', false);
      // Roll back UI to previous known state
      await loadPublicState();
      return;
    }

    showRow(newEnabled);
    updatePreviewLink(slug);
    setMsg(newEnabled
      ? 'Public dashboard enabled!'
      : 'Public dashboard disabled.');
  }

  async function saveSlug() {
    setMsg('Saving…');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setMsg('Not logged in', false); return; }

    let slug = sanitizeSlug(elSlug.value);
    if (!slug || slug.length < 3) {
      setMsg('Slug must be at least 3 characters and use letters, numbers, "-" or "_".', false);
      return;
    }

    // Attempt save; if collision, append a short suffix and retry once.
    let attempts = 0;
    while (attempts < 2) {
      const { error } = await supabase
        .from('users_extended_data')
        .update({ public_dashboard_slug: slug })
        .eq('user_id', session.user.id);

      if (!error) {
        updatePreviewLink(slug);
        setMsg('Link saved.');
        return;
      }
      if (error.code === '23505' && attempts === 0) {
        slug = `${slug}-${randomSuffix()}`;
        attempts++;
        continue;
      }
      setMsg('Could not save link. Try a different slug.', false);
      return;
    }
  }

  function copyLink() {
    const slug = sanitizeSlug(elSlug.value);
    if (!slug) return setMsg('Enable and save your link first.', false);
    const url = buildUrl(slug);
    // Try Clipboard API; fallback to prompt
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        setMsg('Link copied!');
      }).catch(() => {
        window.prompt('Copy link:', url);
        setMsg('Link ready to copy.');
      });
    } else {
      window.prompt('Copy link:', url);
      setMsg('Link ready to copy.');
    }
  }

  // Wire events
  elToggle.addEventListener('change', () => saveEnabled(elToggle.checked));
  elSave.addEventListener('click', saveSlug);
  elCopy.addEventListener('click', copyLink);

  // Live preview while typing (unsaved)
  elSlug.addEventListener('input', () => {
    const s = sanitizeSlug(elSlug.value);
    if (s !== elSlug.value) elSlug.value = s;
    updatePreviewLink(s);
    setMsg(s ? 'Unsaved changes.' : '');
  });

  // Initial load
  loadPublicState();
}

