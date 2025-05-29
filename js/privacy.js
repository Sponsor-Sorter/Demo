import { supabase } from '/public/js/supabaseClient.js';

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
  if (requests.length === 0) html = '';
  else {
    html = '<ul>' + requests.map(req =>
      `<li>
        ${req.type.toUpperCase()} — <b>${req.status}</b> (${new Date(req.created_at).toLocaleString()})
        ${req.result_url ? ` <a href="${req.result_url}" download>Download</a>` : ''}
        ${req.status === 'pending'
          ? `<button class="cancel-privacy-request-btn" data-id="${req.id}" title="Cancel Request" style="color:#f33;border:none;background:transparent;font-weight:bold;font-size:1.2em;margin-left:8px;cursor:pointer;">×</button>`
          : ''}
      </li>`
    ).join('') + '</ul>';
  }
  document.getElementById('privacy-request-status').innerHTML = html;

  // Attach event listeners to all "X" buttons
  document.querySelectorAll('.cancel-privacy-request-btn').forEach(btn => {
    btn.onclick = async function () {
      if (!confirm("Are you sure you want to remove/cancel this request?")) return;
      const id = this.getAttribute('data-id');
      // Remove request (delete row)
      const { error } = await supabase
        .from('user_privacy_requests')
        .delete()
        .eq('id', id)
        .eq('status', 'pending'); // Only allow pending requests to be deleted!
      if (!error) {
        showPrivacyRequestStatus();
      } else {
        alert("Could not cancel the request.");
      }
    };
  });
}

showPrivacyRequestStatus();
