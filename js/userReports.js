// /public/js/userReports.js

import { supabase } from './supabaseClient.js';

function closeReportModal() {
  const modal = document.getElementById('report-modal-root');
  if (modal) modal.remove();
}

async function openReportModal(reportType, targetId) {
  closeReportModal();

  let session, reporter_id, reporter_email, reporter_username;
  try {
    const { data: sess } = await supabase.auth.getSession();
    session = sess?.session;
    if (!session || !session.user) throw new Error('You must be logged in to report.');
    reporter_id = session.user.id;
    reporter_email = session.user.email;
    const { data: userRow } = await supabase
      .from('users_extended_data')
      .select('username')
      .eq('user_id', reporter_id)
      .single();
    reporter_username = userRow?.username || reporter_email;
  } catch (err) {
    alert(err.message || "You must be logged in to report.");
    return;
  }

  const modal = document.createElement('div');
  modal.id = 'report-modal-root';
  modal.style = `
    position: fixed; z-index: 99999; top: 0; left: 0; width: 100vw; height: 100vh;
    background: rgba(0,0,0,0.65); display: flex; align-items: center; justify-content: center;
  `;

  const reasons = [
    "Spam or scam",
    "Abusive or harmful content",
    "Impersonation or fake profile",
    "Suspicious activity",
    "Other (add details below)"
  ];

  modal.innerHTML = `
    <div style="background:#23293b; color:#fff; border-radius:16px; padding:2.2rem 1.4rem; width:95vw; max-width:420px; box-shadow:0 4px 32px #0007; position:relative;">
      <button id="close-report-modal" title="Close" style="position:absolute;top:14px;right:17px;font-size:1.5em;background:none;border:none;color:#fff;cursor:pointer;">×</button>
      <h2 style="color:#e03232; margin-bottom:0.4em;">🚩 Report ${reportType.charAt(0).toUpperCase() + reportType.slice(1)}</h2>
      <form id="report-form">
        <label style="font-weight:500;">Reason:</label>
        <select id="report-reason" required style="width:98%;margin-bottom:0.7em;border-radius:7px;padding:0.2em;">
          <option value="">-- Select a reason --</option>
          ${reasons.map(r => `<option value="${r}">${r}</option>`).join('')}
        </select>
        <label for="report-details" style="font-weight:500;">Details (optional):</label>
        <textarea id="report-details" rows="3" placeholder="Add any extra information..." style="width:98%;margin-bottom:1em;border-radius:7px;"></textarea>
        <input type="hidden" id="report-type" value="${reportType}">
        <input type="hidden" id="report-target-id" value="${targetId}">
        <button type="submit" style="background:#e03232;color:#fff;font-weight:600;padding:0.5em 1.5em;border:none;border-radius:9px;cursor:pointer;width:100%;">Submit Report</button>
        <div id="report-feedback" style="margin-top:10px;"></div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  setTimeout(() => {
    document.getElementById('report-reason')?.focus();
  }, 200);

  document.getElementById('close-report-modal').onclick = closeReportModal;

  document.getElementById('report-form').onsubmit = async (e) => {
    e.preventDefault();
    const feedback = document.getElementById('report-feedback');
    feedback.textContent = '';

    const reason = document.getElementById('report-reason').value;
    const details = document.getElementById('report-details').value.trim();
    const type = document.getElementById('report-type').value;
    let target = document.getElementById('report-target-id').value;

    if (!reason || !type || !target) {
      feedback.textContent = "Please select a reason.";
      return;
    }

    let table, insertObj;

    if (type === 'offer') {
      table = 'reported_offers';
      // Fetch offer details for both usernames
      const { data: offerData } = await supabase
        .from('private_offers')
        .select('sponsee_username, sponsor_username, sponsor_email, sponsee_email')
        .eq('id', target)
        .single();
      let reported_username = "";
      if (offerData) {
        // Reporter is sponsor: reported is sponsee
        if (
          offerData.sponsor_username === reporter_username ||
          offerData.sponsor_email === reporter_email
        ) {
          reported_username = offerData.sponsee_username;
        } 
        // Reporter is sponsee: reported is sponsor
        else if (
          offerData.sponsee_username === reporter_username ||
          offerData.sponsee_email === reporter_email
        ) {
          reported_username = offerData.sponsor_username;
        } else {
          reported_username = offerData.sponsee_username || offerData.sponsor_username || "Unknown";
        }
      }
      insertObj = {
        offer_id: target,
        reporter_user_id: reporter_id,
        reporter_username,
        reported_username,
        reason,
        details,
        created_at: new Date().toISOString(),
        status: 'pending'
      };
    } else if (type === 'comment') {
      table = 'reported_comments';
      // Optionally you can fetch the comment author's username here if you want
      insertObj = {
        comment_id: target,
        reporter_id: reporter_id,
        reporter_username,
        // reported_username: ... (if you fetch the comment author)
        reason,
        details,
        created_at: new Date().toISOString(),
        status: 'pending'
      };
    } else if (type === 'profile') {
      table = 'reported_users';
      // Accept username or user_id for target
      let reported_user_id = target;
      let reported_username = "";
      if (target.length !== 36) {
        // Target is a username: get their user_id
        const { data: row } = await supabase
          .from('users_extended_data')
          .select('user_id, username')
          .ilike('username', target)
          .single();
        if (!row || !row.user_id) {
          feedback.textContent = "Could not find user to report.";
          return;
        }
        reported_user_id = row.user_id;
        reported_username = row.username;
      } else {
        // Target is user_id: fetch username
        const { data: row } = await supabase
          .from('users_extended_data')
          .select('username')
          .eq('user_id', target)
          .single();
        reported_username = row?.username || '';
      }
      insertObj = {
        reported_user_id,
        reporter_user_id: reporter_id,
        reporter_username,
        reported_username,
        reason,
        details,
        created_at: new Date().toISOString(),
        status: 'pending'
      };
    } else if (type === 'review') {
      table = 'reported_reviews';
      insertObj = {
        review_id: target,
        reporter_user_id: reporter_id,
        reporter_username,
        // Optionally: reported_username (if you fetch the review author)
        reason,
        details,
        created_at: new Date().toISOString(),
        status: 'pending'
      };
    } else {
      feedback.textContent = "Invalid report type.";
      return;
    }

    try {
      const { error } = await supabase.from(table).insert([insertObj]);
      if (error) throw error;

      // --- OPTIONAL: Notify admin (Edge Function) ---
      try {
        // Make sure your Edge Function endpoint is correct and open to POSTs
        await fetch("https://mqixtrnhotqqybaghgny.supabase.co/functions/v1/notifyAdminNewReport", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
            // No authorization required for Edge Function if public
          },
          body: JSON.stringify({
            table,
            ...insertObj
          })
        });
      } catch (notifyErr) {
        // Fail silently, report still submits
        console.warn("Admin notification failed", notifyErr);
      }

      feedback.innerHTML = `<span style="color:#4caf50;">Report submitted! Thank you.</span>`;
      setTimeout(closeReportModal, 1200);
    } catch (err) {
      feedback.innerHTML = `<span style="color:#f33;">Failed to submit report. Please try again later.</span>`;
      console.error("Insert error:", err);
    }
  };
}

window.openReportModal = openReportModal;
window.closeReportModal = closeReportModal;

export { openReportModal, closeReportModal };
