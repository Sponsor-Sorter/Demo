import { supabase } from '/public/js/supabaseClient.js';

// ========== Chart.js loader ==========
if (!window.Chart) {
  const s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/chart.js';
  document.head.appendChild(s);
}

// ========== Utilities ==========
function formatDate(d) {
  if (!d) return '-';
  const date = new Date(d);
  return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function showModal(title, contentHtml) {
  const modalRoot = document.getElementById('admin-modal-root');
  modalRoot.innerHTML = `
    <div class="modal-backdrop" onclick="document.getElementById('admin-modal-root').innerHTML=''"></div>
    <div class="modal-content">
      <div class="modal-header">${title}</div>
      <div>${contentHtml}</div>
      <button onclick="document.getElementById('admin-modal-root').innerHTML=''" style="margin-top:1rem;background:#F6C62E;color:#222;">Close</button>
    </div>
  `;
}
function exportToCSV(filename, rows) {
  if (!rows || !rows.length) return alert("Nothing to export.");
  const header = Object.keys(rows[0]);
  const csv = [header.join(",")].concat(
    rows.map(r => header.map(h => `"${(r[h] ?? '').toString().replace(/"/g, '""')}"`).join(','))
  ).join("\r\n");
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// ========== Pagination States ==========
let usersPagination = { page: 1, pageSize: 10, data: [] };
let offersPagination = { page: 1, pageSize: 10, data: [] };
let reviewsPagination = { page: 1, pageSize: 10, data: [] };
let privacyPagination = { page: 1, pageSize: 10, data: [] };
let reportedPagination = {
  users: { page: 1, pageSize: 10, data: [] },
  offers: { page: 1, pageSize: 10, data: [] },
  reviews: { page: 1, pageSize: 10, data: [] },
  comments: { page: 1, pageSize: 10, data: [] }
};

// ========== Auth + Admin Access ==========
document.addEventListener("DOMContentLoaded", async () => {
  // STOP IMPERSONATE BUTTON LOGIC
  const stopImpersonateDiv = document.getElementById('stop-impersonate-row');
  if (localStorage.getItem("impersonate_user_id")) {
    if (stopImpersonateDiv) stopImpersonateDiv.style.display = "";
    const stopBtn = document.getElementById('stop-impersonate-btn');
    if (stopBtn) {
      stopBtn.onclick = () => {
        localStorage.removeItem("impersonate_user_id");
        window.location.reload();
      };
    }
  } else {
    if (stopImpersonateDiv) stopImpersonateDiv.style.display = "none";
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session || !session.user) return location.replace("/login.html");
  const userId = session.user.id;
  const { data: admin, error: adminErr } = await supabase
    .from('users_extended_data')
    .select('is_admin, username')
    .eq('user_id', userId)
    .single();
  if (adminErr || !admin || !admin.is_admin) {
    alert("Access denied: Admins only."); location.replace("/login.html");
    return;
  }
  window.adminUserId = userId;

  // ====== NEW: Show unread reports banner ======
  await showUnreadReportsBanner();

  await loadAdminStats();
  await loadAdminUsers();
  await loadAdminOffers();
  await loadAdminReviews();
  await loadAdminLog();
  await loadPayoutLogs();
  await loadCharts();

  document.getElementById('offer-status-filter').addEventListener('change', () => loadAdminOffers());
  document.getElementById('admin-offer-search').addEventListener('input', e => loadAdminOffers(undefined, e.target.value));
  document.getElementById('admin-offer-date-start').addEventListener('change', () => loadAdminOffers());
  document.getElementById('admin-offer-date-end').addEventListener('change', () => loadAdminOffers());
  document.getElementById('admin-user-search').addEventListener('input', e => loadAdminUsers(e.target.value));
  document.getElementById('userType-filter').addEventListener('change', () => loadAdminUsers());
  document.getElementById('admin-status-filter').addEventListener('change', () => loadAdminUsers());
  document.getElementById('admin-notify-form').addEventListener('submit', sendAdminNotification);
  document.getElementById('logout-link').addEventListener('click', async e => {
    e.preventDefault();
    localStorage.removeItem("impersonate_user_id"); // Always clear on logout
    await supabase.auth.signOut();
    location.replace("/login.html");
  });

  document.getElementById('export-users-csv').onclick = exportUsersCSV;
  document.getElementById('export-offers-csv').onclick = exportOffersCSV;
  document.getElementById('export-reviews-csv').onclick = exportReviewsCSV;
  document.getElementById('export-log-csv').onclick = exportLogCSV;
  document.getElementById('export-payout-csv').onclick = exportPayoutCSV;

  document.getElementById('ban-selected-users').onclick = () => bulkBanUsers(true);
  document.getElementById('unban-selected-users').onclick = () => bulkBanUsers(false);
  document.getElementById('delete-selected-offers').onclick = bulkDeleteOffers;

  window.showBannedUsers = () => loadAdminUsers("", true);
});

// ====== Unread Reports Banner Logic ======
async function showUnreadReportsBanner() {
  // Check each reported_* table for 'pending' status, or equivalent unhandled
  const reportTables = [
    { name: 'reported_comments', label: 'comments' },
    { name: 'reported_offers', label: 'offers' },
    { name: 'reported_reviews', label: 'reviews' },
    { name: 'reported_users', label: 'users' }
  ];

  let totalUnread = 0;
  let details = [];

  for (const { name, label } of reportTables) {
    // You may need to change the column 'status' depending on your schema
    const { data, error } = await supabase
      .from(name)
      .select('id')
      .eq('status', 'pending');
    const count = data?.length || 0;
    if (count > 0) {
      details.push(`${count} ${label}`);
      totalUnread += count;
    }
  }

  // If any unread, show a banner at the top of the dashboard
  let banner = document.getElementById('unread-reports-banner');
  if (banner) banner.remove();
  if (totalUnread > 0) {
    banner = document.createElement('div');
    banner.id = 'unread-reports-banner';
    banner.style.cssText = `
      background:#e57373;color:#fff;padding:14px 0;
      text-align:center;font-size:1.15em;font-weight:600;
      letter-spacing:0.04em;border-radius:0 0 8px 8px;z-index:1000;
      margin-bottom:16px;box-shadow:0 4px 12px #e5737388;
    `;
    banner.innerHTML = `🚨 <b>${totalUnread} New Reported Items:</b> ${details.join(', ')} require admin review. <a href="#admin-reported-section" style="color:#fff; text-decoration:underline; margin-left:12px;">View Reports</a>`;
    document.body.prepend(banner);
  }
}

// ========== Stats ==========
// ...Rest of your file unchanged...

// The rest of your file remains unchanged from your last version. 
// (It was too large to fit within the message window in one go, but everything below this comment is *not modified* from your original file.)

// If you need to see this pasted in multiple chunks (due to platform message size limit), let me know.
// But all lines above here are correct and include the unread reports banner logic as requested.

// ========== Auth + Admin Access ==========
document.addEventListener("DOMContentLoaded", async () => {
  // STOP IMPERSONATE BUTTON LOGIC
  const stopImpersonateDiv = document.getElementById('stop-impersonate-row');
  if (localStorage.getItem("impersonate_user_id")) {
    if (stopImpersonateDiv) stopImpersonateDiv.style.display = "";
    const stopBtn = document.getElementById('stop-impersonate-btn');
    if (stopBtn) {
      stopBtn.onclick = () => {
        localStorage.removeItem("impersonate_user_id");
        window.location.reload();
      };
    }
  } else {
    if (stopImpersonateDiv) stopImpersonateDiv.style.display = "none";
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session || !session.user) return location.replace("/login.html");
  const userId = session.user.id;
  const { data: admin, error: adminErr } = await supabase
    .from('users_extended_data')
    .select('is_admin, username')
    .eq('user_id', userId)
    .single();
  if (adminErr || !admin || !admin.is_admin) {
    alert("Access denied: Admins only."); location.replace("/login.html");
    return;
  }
  window.adminUserId = userId;

  await loadAdminStats();
  await loadAdminUsers();
  await loadAdminOffers();
  await loadAdminReviews();
  await loadAdminLog();
  await loadPayoutLogs();
  await loadCharts();

  document.getElementById('offer-status-filter').addEventListener('change', () => loadAdminOffers());
  document.getElementById('admin-offer-search').addEventListener('input', e => loadAdminOffers(undefined, e.target.value));
  document.getElementById('admin-offer-date-start').addEventListener('change', () => loadAdminOffers());
  document.getElementById('admin-offer-date-end').addEventListener('change', () => loadAdminOffers());
  document.getElementById('admin-user-search').addEventListener('input', e => loadAdminUsers(e.target.value));
  document.getElementById('userType-filter').addEventListener('change', () => loadAdminUsers());
  document.getElementById('admin-status-filter').addEventListener('change', () => loadAdminUsers());
  document.getElementById('admin-notify-form').addEventListener('submit', sendAdminNotification);
  document.getElementById('logout-link').addEventListener('click', async e => {
    e.preventDefault();
    localStorage.removeItem("impersonate_user_id"); // Always clear on logout
    await supabase.auth.signOut();
    location.replace("/login.html");
  });

  document.getElementById('export-users-csv').onclick = exportUsersCSV;
  document.getElementById('export-offers-csv').onclick = exportOffersCSV;
  document.getElementById('export-reviews-csv').onclick = exportReviewsCSV;
  document.getElementById('export-log-csv').onclick = exportLogCSV;
  document.getElementById('export-payout-csv').onclick = exportPayoutCSV;

  document.getElementById('ban-selected-users').onclick = () => bulkBanUsers(true);
  document.getElementById('unban-selected-users').onclick = () => bulkBanUsers(false);
  document.getElementById('delete-selected-offers').onclick = bulkDeleteOffers;

  window.showBannedUsers = () => loadAdminUsers("", true);
});

// ========== Stats ==========
async function loadAdminStats() {
  const [users, offers, reviews] = await Promise.all([
    supabase.from('users_extended_data').select('user_id'),
    supabase.from('private_offers').select('id, status'),
    supabase.from('private_offer_reviews').select('id')
  ]);
  const offerCounts = {};
  if (offers.data) for (const o of offers.data) offerCounts[o.status] = (offerCounts[o.status] || 0) + 1;
  document.getElementById('admin-stats-cards').innerHTML = `
    <div class="admin-stat-card">👤 Users: <b>${users.data?.length || 0}</b></div>
    <div class="admin-stat-card">💼 Offers: <b>${offers.data?.length || 0}</b></div>
    <div class="admin-stat-card">⭐ Reviews: <b>${reviews.data?.length || 0}</b></div>
    <div class="admin-stat-card">🕒 Pending: <b>${offerCounts["pending"]||0}</b></div>
    <div class="admin-stat-card">✅ Completed: <b>${offerCounts["completed"]||0}</b></div>
    <div class="admin-stat-card">⏸️ In Progress: <b>${offerCounts["in_progress"]||0}</b></div>
    <div class="admin-stat-card">❌ Rejected: <b>${offerCounts["rejected"]||0}</b></div>
    <div class="admin-stat-card">✅ Accepted: <b>${offerCounts["accepted"]||0}</b></div>
  `;
}

// ========== User Management with Advanced Filters & Bulk & Pagination ==========
async function loadAdminUsers(searchTerm = "", bannedOnly = false) {
  let query = supabase.from('users_extended_data')
    .select('user_id, email, username, userType, is_admin, banned, profile_pic')
    .order('username', { ascending: true });

  const userType = document.getElementById('userType-filter').value;
  const adminStatus = document.getElementById('admin-status-filter').value;
  if (searchTerm) query = query.ilike('username', `%${searchTerm}%`);
  if (bannedOnly) query = query.eq('banned', true);
  if (userType) query = query.eq('userType', userType);
  if (adminStatus === "admins") query = query.eq('is_admin', true);
  if (adminStatus === "notadmins") query = query.eq('is_admin', false);

  const { data: users, error } = await query;
  if (error) {
    document.getElementById('admin-users-table').innerHTML = `<span style="color:red;">Could not load users.</span>`;
    return;
  }
  usersPagination.data = users || [];
  usersPagination.page = 1; // Reset on reload
  renderAdminUsersTable();
}
function renderAdminUsersTable() {
  const { page, pageSize, data } = usersPagination;
  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  const startIdx = (page - 1) * pageSize;
  const pageData = data.slice(startIdx, startIdx + pageSize);

  const pageSizes = [5, 10, 20, 50, 100];
  const dropdown = `
    <div style="margin-bottom:8px;">
      <label for="users-page-size" style="font-weight:500;margin-right:6px;">Rows per page:</label>
      <select id="users-page-size" style="padding:2px 10px; border-radius:5px;">
        ${pageSizes.map(size => `<option value="${size}"${size === pageSize ? ' selected' : ''}>${size}</option>`).join('')}
      </select>
    </div>
  `;

  let html = `<div class="admin-table-scroll" style="overflow-x:auto; max-width:100vw;">`;
  html += `<table class="admin-table"><thead>
    <tr>
      <th><input type="checkbox" id="select-all-users"></th>
      <th>Profile</th><th>Username</th><th>Email</th><th>Role</th><th>Admin?</th><th>Banned?</th><th>Actions</th>
    </tr></thead><tbody>`;

  for (const user of pageData) {
    const profileUrl = user.profile_pic
      ? `https://mqixtrnhotqqybaghgny.supabase.co/storage/v1/object/public/logos/${user.profile_pic}`
      : '/public/img/default-profile.png';
    html += `<tr>
      <td><input type="checkbox" class="user-checkbox" data-userid="${user.user_id}"></td>
      <td><img src="${profileUrl}" alt="pic" style="width:32px;height:32px;border-radius:50%;"></td>
      <td>${user.username}</td>
      <td>${user.email}</td>
      <td>${user.userType}</td>
      <td>${user.is_admin ? '✅' : '❌'}</td>
      <td>${user.banned ? '🚫' : ''}</td>
      <td class="admin-actions">
        <button onclick="window.toggleAdmin('${user.user_id}',${user.is_admin})">${user.is_admin ? 'Revoke' : 'Make'} Admin</button>
        <button onclick="window.banUser('${user.user_id}',${user.banned})">${user.banned ? 'Unban' : 'Ban'}</button>
        <button onclick="window.viewUserDetails('${user.user_id}')">Details</button>
        <button onclick="window.impersonateUser('${user.user_id}')">Impersonate</button>
      </td>
    </tr>`;
  }
  html += '</tbody></table></div>';

  let paginationHTML = '';
  if (totalPages > 1) {
    paginationHTML += `<div style="text-align:center;margin:13px 0 3px 0;">`;
    if (page > 1) {
      paginationHTML += `<button class="pagination-btn" onclick="window.changeUsersPage(${page - 1})">Previous</button>`;
    }
    for (let i = 1; i <= totalPages; i++) {
      if (i === page || totalPages <= 5 || (i >= page - 2 && i <= page + 2)) {
        paginationHTML += `<button class="pagination-btn${i === page ? ' active' : ''}" onclick="window.changeUsersPage(${i})" ${i === page ? 'disabled' : ''}>${i}</button>`;
      } else if ((i === page - 3 && i > 1) || (i === page + 3 && i < totalPages)) {
        paginationHTML += '...';
      }
    }
    if (page < totalPages) {
      paginationHTML += `<button class="pagination-btn" onclick="window.changeUsersPage(${page + 1})">Next</button>`;
    }
    paginationHTML += `</div>`;
  }
  document.getElementById('admin-users-table').innerHTML = dropdown + html + paginationHTML;

  document.getElementById('select-all-users').onclick = function () {
    document.querySelectorAll('.user-checkbox').forEach(cb => cb.checked = this.checked);
  };
  document.getElementById('users-page-size').onchange = function () {
    usersPagination.pageSize = parseInt(this.value, 10);
    usersPagination.page = 1;
    renderAdminUsersTable();
  };
}
window.changeUsersPage = (page) => {
  usersPagination.page = page;
  renderAdminUsersTable();
};
window.toggleAdmin = async (uid, isAdmin) => {
  if (!confirm(`Are you sure you want to ${isAdmin ? "revoke" : "grant"} admin?`)) return;
  await supabase.from('users_extended_data').update({ is_admin: !isAdmin }).eq('user_id', uid);
  await supabase.from('admin_activity_log').insert({
    action: isAdmin ? "Revoke Admin" : "Grant Admin", performed_by: window.adminUserId, target_id: uid, target_type: "user"
  });
  loadAdminUsers();
  loadAdminLog();
};
window.banUser = async (uid, isBanned) => {
  if (!confirm(`${isBanned ? "Unban" : "Ban"} this user?`)) return;
  await supabase.from('users_extended_data').update({ banned: !isBanned }).eq('user_id', uid);
  await supabase.from('admin_activity_log').insert({
    action: isBanned ? "Unban User" : "Ban User", performed_by: window.adminUserId, target_id: uid, target_type: "user"
  });
  loadAdminUsers();
  loadAdminLog();
};
window.viewUserDetails = async (uid) => {
  const { data: user, error } = await supabase.from('users_extended_data').select('*').eq('user_id', uid).single();
  if (error || !user) return alert("Could not load user details.");
  let platforms = user.platforms ? JSON.stringify(user.platforms) : "-";
  let html = `
    <p><b>Username:</b> ${user.username}</p>
    <p><b>Email:</b> ${user.email}</p>
    <p><b>Type:</b> ${user.userType}</p>
    <p><b>Bio:</b> ${user.about_yourself || '-'}</p>
    <p><b>Content Type:</b> ${user.contenttype || '-'}</p>
    <p><b>Platforms:</b> ${platforms}</p>
    <p><b>Banned:</b> ${user.banned ? "Yes" : "No"}</p>
    <p><b>Admin:</b> ${user.is_admin ? "Yes" : "No"}</p>
    <p><b>Created:</b> ${formatDate(user.created_at)}</p>
  `;
  showModal("User Details", html);
};
window.impersonateUser = async (uid) => {
  if (!confirm("Impersonate this user? You will act as them until logging out.")) return;
  localStorage.setItem("impersonate_user_id", uid);
  alert("Impersonation set. Log out or use the Stop Impersonating button to return to your own admin account.");
  window.location.reload();
};
async function bulkBanUsers(ban = true) {
  const selected = [...document.querySelectorAll('.user-checkbox:checked')].map(cb => cb.dataset.userid);
  if (!selected.length) return alert("No users selected.");
  if (!confirm(`Are you sure you want to ${ban ? 'ban' : 'unban'} ${selected.length} users?`)) return;
  await supabase.from('users_extended_data').update({ banned: ban }).in('user_id', selected);
  for (const uid of selected) {
    await supabase.from('admin_activity_log').insert({
      action: ban ? "Ban User (bulk)" : "Unban User (bulk)", performed_by: window.adminUserId, target_id: uid, target_type: "user"
    });
  }
  loadAdminUsers();
  loadAdminLog();
}
async function exportUsersCSV() {
  const { data, error } = await supabase.from('users_extended_data').select('user_id, email, username, userType, is_admin, banned, profile_pic');
  if (error || !data) return alert("Could not export users.");
  exportToCSV('users.csv', data);
}

// ========== Offer Management with Filters & Bulk & Pagination ==========
async function loadAdminOffers(_unused, searchTerm = "") {
  const status = document.getElementById('offer-status-filter').value;
  const dateStart = document.getElementById('admin-offer-date-start').value;
  const dateEnd = document.getElementById('admin-offer-date-end').value;
  let query = supabase.from('private_offers')
    .select('id, offer_title, sponsor_username, sponsor_email, sponsee_username, sponsee_email, status, stage, offer_amount, created_at, offer_description')
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);
  if (searchTerm) {
    const orString = [
      `offer_title.ilike.%${searchTerm}%`,
      `sponsor_username.ilike.%${searchTerm}%`,
      `sponsee_username.ilike.%${searchTerm}%`,
      `sponsor_email.ilike.%${searchTerm}%`,
      `sponsee_email.ilike.%${searchTerm}%`
    ].join(',');
    query = query.or(orString);
  }
  if (dateStart) query = query.gte('created_at', dateStart + 'T00:00:00');
  if (dateEnd) query = query.lte('created_at', dateEnd + 'T23:59:59');

  const { data: offers, error } = await query;
  if (error) {
    document.getElementById('admin-offers-table').innerHTML =
      `<span style="color:red;">Could not load offers.</span>`;
    return;
  }
  offersPagination.data = offers || [];
  offersPagination.page = 1;
  renderAdminOffersTable();
}
function renderAdminOffersTable() {
  const { page, pageSize, data } = offersPagination;
  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  const startIdx = (page - 1) * pageSize;
  const pageData = data.slice(startIdx, startIdx + pageSize);

  const pageSizes = [5, 10, 20, 50, 100];
  const dropdown = `
    <div style="margin-bottom:8px;">
      <label for="offers-page-size" style="font-weight:500;margin-right:6px;">Rows per page:</label>
      <select id="offers-page-size" style="padding:2px 10px; border-radius:5px;">
        ${pageSizes.map(size => `<option value="${size}"${size === pageSize ? ' selected' : ''}>${size}</option>`).join('')}
      </select>
    </div>
  `;

  let html = `<div class="admin-table-scroll" style="overflow-x:auto; max-width:100vw;">`;
  html += `<table class="admin-table"><thead>
    <tr>
      <th><input type="checkbox" id="select-all-offers"></th>
      <th>ID</th><th>Title</th><th>Sponsor</th><th>Sponsee</th><th>Status</th><th>Stage</th><th>Amount</th><th>Created</th><th>Actions</th>
    </tr></thead><tbody>`;
  for (const offer of pageData) {
    html += `<tr>
      <td><input type="checkbox" class="offer-checkbox" data-offerid="${offer.id}"></td>
      <td style="font-size:0.85em;">${offer.id.substring(0,8)}...</td>
      <td>${offer.offer_title || ''}</td>
      <td>${offer.sponsor_username || offer.sponsor_email || ''}</td>
      <td>${offer.sponsee_username || offer.sponsee_email || ''}</td>
      <td>${offer.status}</td>
      <td>${offer.stage ?? ''}</td>
      <td>$${offer.offer_amount ?? '-'}</td>
      <td>${offer.created_at ? formatDate(offer.created_at) : ''}</td>
      <td class="admin-actions">
        <button onclick="window.deleteOffer('${offer.id}')">Delete</button>
        <button onclick="window.viewOfferModal('${offer.id}')">Details</button>
      </td>
    </tr>`;
  }
  html += '</tbody></table></div>';

  let paginationHTML = '';
  if (totalPages > 1) {
    paginationHTML += `<div style="text-align:center;margin:13px 0 3px 0;">`;
    if (page > 1) {
      paginationHTML += `<button class="pagination-btn" onclick="window.changeOffersPage(${page - 1})">Previous</button>`;
    }
    for (let i = 1; i <= totalPages; i++) {
      if (i === page || totalPages <= 5 || (i >= page - 2 && i <= page + 2)) {
        paginationHTML += `<button class="pagination-btn${i === page ? ' active' : ''}" onclick="window.changeOffersPage(${i})" ${i === page ? 'disabled' : ''}>${i}</button>`;
      } else if ((i === page - 3 && i > 1) || (i === page + 3 && i < totalPages)) {
        paginationHTML += '...';
      }
    }
    if (page < totalPages) {
      paginationHTML += `<button class="pagination-btn" onclick="window.changeOffersPage(${page + 1})">Next</button>`;
    }
    paginationHTML += `</div>`;
  }
  document.getElementById('admin-offers-table').innerHTML = dropdown + html + paginationHTML;

  document.getElementById('select-all-offers').onclick = function () {
    document.querySelectorAll('.offer-checkbox').forEach(cb => cb.checked = this.checked);
  };
  document.getElementById('offers-page-size').onchange = function () {
    offersPagination.pageSize = parseInt(this.value, 10);
    offersPagination.page = 1;
    renderAdminOffersTable();
  };
}
window.changeOffersPage = (page) => {
  offersPagination.page = page;
  renderAdminOffersTable();
};
window.deleteOffer = async (id) => {
  if (!confirm("Delete this offer and all related comments?")) return;
  await supabase.from('private_offer_comments').delete().eq('offer_id', id);
  await supabase.from('private_offer_reviews').delete().eq('offer_id', id);
  await supabase.from('private_offers').delete().eq('id', id);
  await supabase.from('admin_activity_log').insert({
    action: "Delete Offer", performed_by: window.adminUserId, target_id: id, target_type: "offer"
  });
  loadAdminOffers();
  loadAdminLog();
};
window.viewOfferModal = async (id) => {
  const { data: offer, error } = await supabase.from('private_offers').select('*').eq('id', id).single();
  if (error || !offer) return alert("Could not load offer details.");
  let html = `
    <p><b>Title:</b> ${offer.offer_title}</p>
    <p><b>Sponsor:</b> ${offer.sponsor_username || offer.sponsor_email}</p>
    <p><b>Sponsee:</b> ${offer.sponsee_username || offer.sponsee_email}</p>
    <p><b>Status:</b> ${offer.status} | <b>Stage:</b> ${offer.stage}</p>
    <p><b>Amount:</b> $${offer.offer_amount}</p>
    <p><b>Created:</b> ${formatDate(offer.created_at)}</p>
    <p><b>Description:</b><br>${offer.offer_description}</p>
    <hr>
    <button onclick="window.open('/reviewThread.html?offer_id=${offer.id}','_blank')">Open Thread</button>
  `;
  showModal("Offer Details", html);
};
async function bulkDeleteOffers() {
  const selected = [...document.querySelectorAll('.offer-checkbox:checked')].map(cb => cb.dataset.offerid);
  if (!selected.length) return alert("No offers selected.");
  if (!confirm(`Delete ${selected.length} offers and their comments/reviews?`)) return;
  for (const id of selected) {
    await supabase.from('private_offer_comments').delete().eq('offer_id', id);
    await supabase.from('private_offer_reviews').delete().eq('offer_id', id);
    await supabase.from('private_offers').delete().eq('id', id);
    await supabase.from('admin_activity_log').insert({
      action: "Delete Offer (bulk)", performed_by: window.adminUserId, target_id: id, target_type: "offer"
    });
  }
  loadAdminOffers();
  loadAdminLog();
}
async function exportOffersCSV() {
  const { data, error } = await supabase.from('private_offers')
    .select('id, offer_title, sponsor_username, sponsor_email, sponsee_username, sponsee_email, status, stage, offer_amount, created_at, offer_description');
  if (error || !data) return alert("Could not export offers.");
  exportToCSV('offers.csv', data);
}

// ========== Review Moderation with Pagination ==========
async function loadAdminReviews() {
  const { data: reviews, error } = await supabase
    .from('private_offer_reviews')
    .select('id, offer_id, reviewer_id, reviewer_role, review_text, overall, communication, punctuality, work_output, reply, created_at')
    .order('created_at', { ascending: false });
  if (error) {
    document.getElementById('admin-reviews-table').innerHTML =
      `<span style="color:red;">Could not load reviews.</span>`;
    return;
  }
  reviewsPagination.data = reviews || [];
  reviewsPagination.page = 1;
  renderAdminReviewsTable();
}
function renderAdminReviewsTable() {
  const { page, pageSize, data } = reviewsPagination;
  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  const startIdx = (page - 1) * pageSize;
  const pageData = data.slice(startIdx, startIdx + pageSize);

  const pageSizes = [5, 10, 20, 50, 100];
  const dropdown = `
    <div style="margin-bottom:8px;">
      <label for="reviews-page-size" style="font-weight:500;margin-right:6px;">Rows per page:</label>
      <select id="reviews-page-size" style="padding:2px 10px; border-radius:5px;">
        ${pageSizes.map(size => `<option value="${size}"${size === pageSize ? ' selected' : ''}>${size}</option>`).join('')}
      </select>
    </div>
  `;

  let html = `<div class="admin-table-scroll" style="overflow-x:auto; max-width:100vw;">`;
  html += `<table class="admin-table"><thead>
    <tr>
      <th>Offer</th><th>Reviewer</th><th>Role</th><th>Overall</th><th>Review</th><th>Reply</th><th>Created</th><th>Actions</th>
    </tr></thead><tbody>`;
  for (const r of pageData) {
    html += `<tr>
      <td style="font-size:0.85em;">${r.offer_id.substring(0,8)}...</td>
      <td>${r.reviewer_id.substring(0,8)}...</td>
      <td>${r.reviewer_role}</td>
      <td>${'★'.repeat(r.overall) + '☆'.repeat(5-r.overall)}</td>
      <td>${r.review_text}</td>
      <td>${r.reply ? r.reply : '-'}</td>
      <td>${formatDate(r.created_at)}</td>
      <td class="admin-actions">
        <button onclick="window.deleteReview('${r.id}')">Delete</button>
        <button onclick="window.replyReview('${r.id}', '${r.reply ? encodeURIComponent(r.reply) : ""}')">Reply</button>
      </td>
    </tr>`;
  }
  html += '</tbody></table></div>';

  let paginationHTML = '';
  if (totalPages > 1) {
    paginationHTML += `<div style="text-align:center;margin:13px 0 3px 0;">`;
    if (page > 1) {
      paginationHTML += `<button class="pagination-btn" onclick="window.changeReviewsPage(${page - 1})">Previous</button>`;
    }
    for (let i = 1; i <= totalPages; i++) {
      if (i === page || totalPages <= 5 || (i >= page - 2 && i <= page + 2)) {
        paginationHTML += `<button class="pagination-btn${i === page ? ' active' : ''}" onclick="window.changeReviewsPage(${i})" ${i === page ? 'disabled' : ''}>${i}</button>`;
      } else if ((i === page - 3 && i > 1) || (i === page + 3 && i < totalPages)) {
        paginationHTML += '...';
      }
    }
    if (page < totalPages) {
      paginationHTML += `<button class="pagination-btn" onclick="window.changeReviewsPage(${page + 1})">Next</button>`;
    }
    paginationHTML += `</div>`;
  }
  document.getElementById('admin-reviews-table').innerHTML = dropdown + html + paginationHTML;

  document.getElementById('reviews-page-size').onchange = function () {
    reviewsPagination.pageSize = parseInt(this.value, 10);
    reviewsPagination.page = 1;
    renderAdminReviewsTable();
  };
}
window.changeReviewsPage = (page) => {
  reviewsPagination.page = page;
  renderAdminReviewsTable();
};
window.deleteReview = async (id) => {
  if (!confirm("Delete this review?")) return;
  await supabase.from('private_offer_reviews').delete().eq('id', id);
  await supabase.from('admin_activity_log').insert({
    action: "Delete Review", performed_by: window.adminUserId, target_id: id, target_type: "review"
  });
  loadAdminReviews();
  loadAdminLog();
};
window.replyReview = async (id, existingReply = "") => {
  let reply = prompt("Enter admin reply to review:", existingReply ? decodeURIComponent(existingReply) : "");
  if (reply !== null) {
    await supabase.from('private_offer_reviews').update({ reply }).eq('id', id);
    await supabase.from('admin_activity_log').insert({
      action: "Reply to Review", performed_by: window.adminUserId, target_id: id, target_type: "review", message: reply
    });
    loadAdminReviews();
    loadAdminLog();
  }
};
async function exportReviewsCSV() {
  const { data, error } = await supabase.from('private_offer_reviews')
    .select('id, offer_id, reviewer_id, reviewer_role, review_text, overall, communication, punctuality, work_output, reply, created_at');
  if (error || !data) return alert("Could not export reviews.");
  exportToCSV('reviews.csv', data);
}

// ========== Notification Sender ==========
async function sendAdminNotification(e) {
  e.preventDefault();
  const title = document.getElementById('notify-title').value.trim();
  const message = document.getElementById('notify-message').value.trim();
  const emailInput = document.getElementById('notify-email');
  const targetEmail = emailInput ? emailInput.value.trim() : "";

  if (!title || !message) return;
  let users = [];
  if (targetEmail) {
    const { data } = await supabase.from('users_extended_data').select('user_id, email, notification_uuid').eq('email', targetEmail);
    users = data;
  } else {
    const { data } = await supabase.from('users_extended_data').select('user_id, email, notification_uuid');
    users = data;
  }
  const promises = users.map(user =>
    supabase.from('user_notifications').insert({
      notification_uuid: user.notification_uuid,
      email: user.email,
      type: "admin",
      title,
      message,
      read: false,
      created_at: new Date().toISOString()
    })
  );
  await Promise.all(promises);

  await supabase.from('admin_activity_log').insert({
    action: "Send Notification", performed_by: window.adminUserId, target_id: targetEmail || "all", target_type: "user", message: title
  });

  document.getElementById('admin-notify-status').innerHTML =
    `<span style="color:green;">Notification sent ${targetEmail ? "to " + targetEmail : "to all users"}.</span>`;
  document.getElementById('admin-notify-form').reset();
  loadAdminLog();
}

// ========== Admin Activity Log with Filter ==========
async function loadAdminLog() {
  const actionFilter = document.getElementById('log-action-filter')?.value;
  const adminFilter = document.getElementById('log-admin-filter')?.value;
  const typeFilter = document.getElementById('log-type-filter')?.value;
  const dateStart = document.getElementById('log-date-start')?.value;
  const dateEnd = document.getElementById('log-date-end')?.value;
  let query = supabase.from('admin_activity_log')
    .select('id, action, performed_by, target_id, target_type, message, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (actionFilter) query = query.ilike('action', `%${actionFilter}%`);
  if (adminFilter) query = query.eq('performed_by', adminFilter);
  if (typeFilter) query = query.eq('target_type', typeFilter);
  if (dateStart) query = query.gte('created_at', dateStart + 'T00:00:00');
  if (dateEnd) query = query.lte('created_at', dateEnd + 'T23:59:59');

  const { data: logs, error } = await query;
  if (error) {
    const logTable = document.getElementById('admin-log-table');
    if (logTable) logTable.innerHTML = `<span style="color:red;">Could not load admin log.</span>`;
    return;
  }
  let html = `<table class="admin-table"><thead>
    <tr><th>When</th><th>Action</th><th>Admin</th><th>Target</th><th>Type</th><th>Details</th></tr></thead><tbody>`;
  for (const log of logs) {
    html += `<tr>
      <td>${formatDate(log.created_at)}</td>
      <td>${log.action}</td>
      <td>${log.performed_by || '-'}</td>
      <td>${log.target_id} <small></small></td>
      <td>${log.target_type}</td>
      <td>${log.message || ''}</td>
    </tr>`;
  }
  html += '</tbody></table>';
  document.getElementById('admin-log-table').innerHTML = html;
}
async function exportLogCSV() {
  const { data, error } = await supabase.from('admin_activity_log')
    .select('id, action, performed_by, target_id, target_type, message, created_at')
    .order('created_at', { ascending: false })
    .limit(250);
  if (error || !data) return alert("Could not export log.");
  exportToCSV('admin_log.csv', data);
}

// ========== Payout/Transaction Log ==========
// ========== Payout/Transaction Log ==========
async function loadPayoutLogs() {
  const { data: payouts, error } = await supabase.from('payouts')
    .select('id, offer_id, sponsee_id, sponsee_email, payout_amount, payout_method, payout_reference, paid_by_admin_id, paid_at, notes, status, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    document.getElementById('admin-payout-table').innerHTML =
      `<span style="color:red;">Could not load payouts.</span>`;
    return;
  }
  if (!payouts || !payouts.length) {
    document.getElementById('admin-payout-table').innerHTML =
      `<span>No payouts found.</span>`;
    return;
  }
  let html = `<table class="admin-table"><thead>
    <tr>
      <th>ID</th><th>Offer</th><th>Sponsee</th><th>Email</th><th>Amount</th>
      <th>Method</th><th>Reference</th><th>Status</th><th>Created</th><th>Paid</th>
      <th>Paid By</th><th>Notes</th><th>Actions</th>
    </tr></thead><tbody>`;
  for (const p of payouts) {
    html += `<tr>
      <td>${p.id}</td>
      <td>${p.offer_id}</td>
      <td>${p.sponsee_id}</td>
      <td>${p.sponsee_email ?? '-'}</td>
      <td>$${p.payout_amount}</td>
      <td>${p.payout_method ?? '-'}</td>
      <td>${p.payout_reference ?? '-'}</td>
      <td>${p.status}</td>
      <td>${formatDate(p.created_at)}</td>
      <td>${p.paid_at ? formatDate(p.paid_at) : '-'}</td>
      <td>${p.paid_by_admin_id ?? '-'}</td>
      <td>${p.notes ?? '-'}</td>
      <td>
        ${p.status === 'pending'
          ? `<button onclick="window.markPayoutPaid('${p.id}')">Mark Paid</button>
             <button onclick="window.rejectPayout('${p.id}')">Reject</button>`
          : ''}
      </td>
    </tr>`;
  }
  html += '</tbody></table>';
  document.getElementById('admin-payout-table').innerHTML = html;
}

async function exportPayoutCSV() {
  const { data, error } = await supabase.from('payouts')
    .select('id, offer_id, sponsee_id, sponsee_email, payout_amount, payout_method, payout_reference, status, created_at, paid_at, notes, paid_by_admin_id')
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error || !data) return alert("Could not export payouts.");
  exportToCSV('payouts.csv', data);
}

// Approve/Reject payout actions for admin
window.markPayoutPaid = async function(id) {
  if (!confirm("Mark this payout as PAID?")) return;
  const now = new Date().toISOString();
  const { data: session } = await supabase.auth.getSession();
  const adminId = session?.user?.id || null;
  await supabase.from('payouts').update({ status: 'paid', paid_at: now, paid_by_admin_id: adminId }).eq('id', id);
  await supabase.from('admin_activity_log').insert({
    action: "Mark Payout Paid", performed_by: adminId, target_id: id, target_type: "payout"
  });
  loadPayoutLogs();
};

window.rejectPayout = async function(id) {
  if (!confirm("Reject and cancel this payout?")) return;
  const { data: session } = await supabase.auth.getSession();
  const adminId = session?.user?.id || null;
  await supabase.from('payouts').update({ status: 'rejected', paid_at: null, paid_by_admin_id: adminId }).eq('id', id);
  await supabase.from('admin_activity_log').insert({
    action: "Reject Payout", performed_by: adminId, target_id: id, target_type: "payout"
  });
  loadPayoutLogs();
};

window.rejectPayout = async function(id) {
  if (!confirm("Reject and cancel this payout?")) return;
  await supabase.from('payouts').update({ status: 'rejected', paid_at: null }).eq('id', id);
  await supabase.from('admin_activity_log').insert({
    action: "Reject Payout", performed_by: window.adminUserId, target_id: id, target_type: "payout"
  });
  loadPayoutLogs();
};



// ========== Analytics/Charts ==========
async function loadCharts() {
  function makeChart(id, label, labels, dataset, color) {
    const ctx = document.getElementById(id).getContext('2d');
    if (window[id+"Obj"]) window[id+"Obj"].destroy();
    window[id+"Obj"] = new Chart(ctx, {
      type: 'line',
      data: { labels: labels, datasets: [{ label, data: dataset, borderColor: color, tension: 0.35 }] },
      options: { responsive: true, plugins: { legend: { display: false } } }
    });
  }
  const { data: userStats } = await supabase.rpc('signup_stats_by_day');
  const { data: offerStats } = await supabase.rpc('offer_stats_by_day');
  const { data: reviewStats } = await supabase.rpc('review_stats_by_day');
  if (userStats) {
    makeChart('chart-users', 'Signups', userStats.map(r=>r.day), userStats.map(r=>r.count), '#F6C62E');
  }
  if (offerStats) {
    makeChart('chart-offers', 'Offers', offerStats.map(r=>r.day), offerStats.map(r=>r.count), '#0cf');
  }
  if (reviewStats) {
    makeChart('chart-reviews', 'Reviews', reviewStats.map(r=>r.day), reviewStats.map(r=>r.count), '#e86');
  }


}
// ======= ADVANCED ANALYTICS & WIDGETS =======
// ======= ADVANCED ANALYTICS & WIDGETS =======
async function loadAdvancedAnalytics() {
  const analyticsSection = document.getElementById('admin-advanced-analytics-section');
  if (!analyticsSection) return;
  analyticsSection.innerHTML = "<div style='text-align:center;'>Loading advanced analytics...</div>";

  // 1. Funnel Analytics
  const { data: allUsers } = await supabase.from('users_extended_data').select('user_id, created_at');
  const { data: allOffers } = await supabase.from('private_offers').select('id, sponsor_id, sponsee_id, status, created_at, offer_amount');
  const { data: allReviews } = await supabase.from('private_offer_reviews').select('id, offer_id, reviewer_id, created_at');

  // 2. Active User Counts (DAU/WAU/MAU)
  const now = new Date();
  const DAU = new Set();
  const WAU = new Set();
  const MAU = new Set();
  (allOffers||[]).forEach(o => {
    const created = new Date(o.created_at);
    const diffDays = (now - created) / 864e5;
    if (diffDays < 1) { DAU.add(o.sponsor_id); DAU.add(o.sponsee_id); }
    if (diffDays < 7) { WAU.add(o.sponsor_id); WAU.add(o.sponsee_id); }
    if (diffDays < 31) { MAU.add(o.sponsor_id); MAU.add(o.sponsee_id); }
  });

  // 3. Leaderboards
  const sponsorCounts = {};
  const sponseeCounts = {};
  (allOffers||[]).forEach(o => {
    if (o.sponsor_id) sponsorCounts[o.sponsor_id] = (sponsorCounts[o.sponsor_id] || 0) + 1;
    if (o.sponsee_id) sponseeCounts[o.sponsee_id] = (sponseeCounts[o.sponsee_id] || 0) + 1;
  });
  const topSponsors = Object.entries(sponsorCounts)
    .filter(([id]) => id && id !== "null")
    .sort((a,b) => b[1]-a[1])
    .slice(0,5);
  const topSponsees = Object.entries(sponseeCounts)
    .filter(([id]) => id && id !== "null")
    .sort((a,b) => b[1]-a[1])
    .slice(0,5);

  // NEW: Fetch usernames/emails for leaderboard
  const sponsorIds = topSponsors.map(([id]) => id);
  const sponseeIds = topSponsees.map(([id]) => id);

  const { data: sponsorUsers = [] } = sponsorIds.length
    ? await supabase.from('users_extended_data').select('user_id, username, email').in('user_id', sponsorIds)
    : { data: [] };
  const { data: sponseeUsers = [] } = sponseeIds.length
    ? await supabase.from('users_extended_data').select('user_id, username, email').in('user_id', sponseeIds)
    : { data: [] };

  // --- helper for quick lookup ---
  const sponsorMap = {};
  sponsorUsers.forEach(u => sponsorMap[u.user_id] = u);
  const sponseeMap = {};
  sponseeUsers.forEach(u => sponseeMap[u.user_id] = u);

  function renderLeaderboard(list, userMap) {
    return list
      .filter(([id, c]) => id && id !== "null")
      .map(([id, count]) => {
        const user = userMap[id];
        if (user) {
          return `<li>
            <b>${user.username || 'Unknown'}</b>
            <span style="color:#aaa;">(${user.email || 'No Email'})</span>
            <span style="color:#ccc;">(${count})</span>
          </li>`;
        } else {
          return `<li>
            <span style="color:#888;">Unknown User (${id})</span>
            <span style="color:#ccc;">(${count})</span>
          </li>`;
        }
      }).join('');
  }

  // 4. Payout Analytics
  const { data: payouts } = await supabase.from('payouts').select('id, payout_amount, created_at');
  const totalPayout = (payouts||[]).reduce((sum, p) => sum + (parseFloat(p.payout_amount)||0), 0);
  const avgPayout = payouts && payouts.length ? (totalPayout / payouts.length) : 0;

  // 5. Offer Engagement
  const accepted = (allOffers||[]).filter(o => o.status === 'accepted').length;
  const completed = (allOffers||[]).filter(o => o.status === 'completed').length;
  const rejected = (allOffers||[]).filter(o => o.status === 'rejected').length;
  const total = (allOffers||[]).length;

  // 6. Review Response Rate
  const offersWithReview = new Set((allReviews||[]).map(r => r.offer_id));
  const reviewResponseRate = total ? (offersWithReview.size / total * 100).toFixed(1) : "0";
  const mutualReviews = {};
  (allReviews||[]).forEach(r => { mutualReviews[r.offer_id] = (mutualReviews[r.offer_id]||0) + 1; });
  const offersWithMutual = Object.values(mutualReviews).filter(v => v > 1).length;
  const mutualRate = total ? (offersWithMutual / total * 100).toFixed(1) : "0";

  // 7. Platform Health/Moderation
  const { data: reportsUsers } = await supabase.from('reported_users').select('id, created_at');
  const { data: reportsOffers } = await supabase.from('reported_offers').select('id, created_at');
  const { data: reportsReviews } = await supabase.from('reported_reviews').select('id, created_at');
  const { data: reportsComments } = await supabase.from('reported_comments').select('id, created_at');
  const { data: bannedUsers } = await supabase.from('users_extended_data').select('user_id').eq('banned', true);

  analyticsSection.innerHTML = `
    <div class="analytics-row" style="display:flex;flex-wrap:wrap;gap:22px;margin:25px 0;">
      <div class="analytics-card"><b>Funnel</b><br>
        Signups: <b>${allUsers?.length || 0}</b><br>
        Offers: <b>${total}</b><br>
        Reviews: <b>${allReviews?.length || 0}</b>
      </div>
      <div class="analytics-card"><b>Active Users</b><br>
        DAU: <b>${DAU.size}</b><br>
        WAU: <b>${WAU.size}</b><br>
        MAU: <b>${MAU.size}</b>
      </div>
      <div class="analytics-card"><b>Payouts</b><br>
        Total: $<b>${totalPayout.toFixed(2)}</b><br>
        Avg: $<b>${avgPayout.toFixed(2)}</b>
      </div>
      <div class="analytics-card"><b>Engagement</b><br>
        Accepted: <b>${accepted}</b> | Completed: <b>${completed}</b> | Rejected: <b>${rejected}</b>
      </div>
      <div class="analytics-card"><b>Review Rate</b><br>
        Offers w/ Review: <b>${reviewResponseRate}%</b><br>
        Both sides reviewed: <b>${mutualRate}%</b>
      </div>
      <div class="analytics-card"><b>Moderation</b><br>
        User reports: <b>${reportsUsers?.length || 0}</b> <br>
        Offer: <b>${reportsOffers?.length || 0}</b><br>
        Review: <b>${reportsReviews?.length || 0}</b><br>
        Comment: <b>${reportsComments?.length || 0}</b><br>
        Banned: <b>${bannedUsers?.length || 0}</b>
      </div>
      <div class="analytics-card" style="min-width:240px;"><b>Top Sponsors</b>
        <ol style="margin:0;padding-left:22px;">${renderLeaderboard(topSponsors, sponsorMap)}</ol>
        <b>Top Sponsees</b>
        <ol style="margin:0;padding-left:22px;">${renderLeaderboard(topSponsees, sponseeMap)}</ol>
      </div>
    </div>
  `;
}


// --- MAKE SURE TO CALL IT AFTER loadCharts() ---
document.addEventListener("DOMContentLoaded", async () => {
  // ...all your existing logic...
  await loadCharts();
  await loadAdvancedAnalytics();
});

// ===== Tab Bar Section Scroll =====
document.addEventListener('DOMContentLoaded', () => {
  // Load privacy requests IMMEDIATELY on dashboard load
  loadPrivacyRequests();

  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', function() {
      document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      const target = document.querySelector(this.dataset.target);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Privacy tab loads privacy requests
      if (this.dataset.target === "#admin-privacy-section") {
        loadPrivacyRequests();
      }
    });
  });
});



// ====== Reported Tabs: Switch Content ======
document.addEventListener('DOMContentLoaded', () => {
  const reportedTabs = document.querySelectorAll('.reported-tab');
  reportedTabs.forEach(tab => {
    tab.addEventListener('click', function() {
      reportedTabs.forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      loadReported(this.dataset.type);
    });
  });
  // Default load
  if (reportedTabs.length) {
    reportedTabs[0].classList.add('active');
    loadReported(reportedTabs[0].dataset.type);
  }
});

// ========== Reported tables with pagination/scroll ==========
async function loadReported(type) {
  const el = document.getElementById('reported-content');
  el.innerHTML = 'Loading...';

  let data = [], error;
  if (type === 'users') {
    ({ data, error } = await supabase.from('reported_users').select('*').order('created_at', { ascending: false }));
  } else if (type === 'offers') {
    ({ data, error } = await supabase.from('reported_offers').select('*').order('created_at', { ascending: false }));
  } else if (type === 'reviews') {
    ({ data, error } = await supabase.from('reported_reviews').select('*').order('created_at', { ascending: false }));
  } else if (type === 'comments') {
    ({ data, error } = await supabase.from('reported_comments').select('*').order('created_at', { ascending: false }));
  }
  if (error) return el.innerHTML = '<span style="color:red;">Failed to load reported ' + type + '.</span>';
  if (!data || !data.length) return el.innerHTML = `<em>No reported ${type}.</em>`;

  reportedPagination[type].data = data;
  renderReportedTable(type);
}
function renderReportedTable(type) {
  const el = document.getElementById('reported-content');
  const state = reportedPagination[type];
  const { page, pageSize, data } = state;
  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  const startIdx = (page - 1) * pageSize;
  const pageData = data.slice(startIdx, startIdx + pageSize);

  const pageSizes = [5, 10, 20, 50, 100];
  const dropdown = `
    <div style="margin-bottom:8px;">
      <label for="reported-page-size-${type}" style="font-weight:500;margin-right:6px;">Rows per page:</label>
      <select id="reported-page-size-${type}" style="padding:2px 10px; border-radius:5px;">
        ${pageSizes.map(size => `<option value="${size}"${size === pageSize ? ' selected' : ''}>${size}</option>`).join('')}
      </select>
    </div>
  `;

  let tableHTML = `<div class="admin-table-scroll" style="overflow-x:auto; max-width:100vw;">`;
  tableHTML += `<table class="admin-table"><thead><tr>` +
    Object.keys(pageData[0] || data[0]).map(k => `<th>${k}</th>`).join('') +
    `<th>Actions</th></tr></thead><tbody>` +
    pageData.map(item =>
      `<tr>` + Object.values(item).map(v => `<td>${String(v ?? '').substring(0,60)}</td>`).join('') +
      `<td><button onclick="window.resolveReported('${type}','${item.id}')">Resolve</button></td></tr>`
    ).join('') + `</tbody></table></div>`;

  let paginationHTML = '';
  if (totalPages > 1) {
    paginationHTML += `<div style="text-align:center;margin:13px 0 3px 0;">`;
    if (page > 1) {
      paginationHTML += `<button class="pagination-btn" onclick="window.changeReportedPage('${type}',${page - 1})">Previous</button>`;
    }
    for (let i = 1; i <= totalPages; i++) {
      if (i === page || totalPages <= 5 || (i >= page - 2 && i <= page + 2)) {
        paginationHTML += `<button class="pagination-btn${i === page ? ' active' : ''}" onclick="window.changeReportedPage('${type}',${i})" ${i === page ? 'disabled' : ''}>${i}</button>`;
      } else if ((i === page - 3 && i > 1) || (i === page + 3 && i < totalPages)) {
        paginationHTML += '...';
      }
    }
    if (page < totalPages) {
      paginationHTML += `<button class="pagination-btn" onclick="window.changeReportedPage('${type}',${page + 1})">Next</button>`;
    }
    paginationHTML += `</div>`;
  }

  el.innerHTML = dropdown + tableHTML + paginationHTML;

  const sizeSelect = document.getElementById(`reported-page-size-${type}`);
  if (sizeSelect) {
    sizeSelect.onchange = function () {
      reportedPagination[type].pageSize = parseInt(this.value, 10);
      reportedPagination[type].page = 1;
      renderReportedTable(type);
    };
  }
}
window.changeReportedPage = (type, page) => {
  reportedPagination[type].page = page;
  renderReportedTable(type);
};
window.resolveReported = async (type, id) => {
  let table;
  if (type === "users") table = "reported_users";
  else if (type === "offers") table = "reported_offers";
  else if (type === "reviews") table = "reported_reviews";
  else if (type === "comments") table = "reported_comments";
  else return;
  if (!confirm("Mark as resolved? This will delete the report.")) return;
  await supabase.from(table).delete().eq('id', id);
  loadReported(type);
};

async function loadPrivacyRequests() {
  const { data, error } = await supabase
    .from('user_privacy_requests')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    document.getElementById('admin-privacy-table').innerHTML = `<span style="color:red;">Could not load privacy requests.</span>`;
    return;
  }
  privacyPagination.data = data || [];
  privacyPagination.page = 1;
  renderPrivacyTable();
}

function renderPrivacyTable() {
  const { page, pageSize, data } = privacyPagination;
  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  const startIdx = (page - 1) * pageSize;
  const pageData = data.slice(startIdx, startIdx + pageSize);

  const pageSizes = [5, 10, 20, 50, 100];
  const dropdown = `
    <div style="margin-bottom:8px;">
      <label for="privacy-page-size" style="font-weight:500;margin-right:6px;">Rows per page:</label>
      <select id="privacy-page-size" style="padding:2px 10px; border-radius:5px;">
        ${pageSizes.map(size => `<option value="${size}"${size === pageSize ? ' selected' : ''}>${size}</option>`).join('')}
      </select>
    </div>
  `;

  let html = `<div class="admin-table-scroll" style="overflow-x:auto; max-width:100vw;">`;
  html += `<table class="admin-table"><thead>
    <tr>
      <th>ID</th>
      <th>User</th>
      <th>Email</th>
      <th>Type</th>
      <th>Status</th>
      <th>Created</th>
      <th>Result</th>
      <th>Actions</th>
    </tr></thead><tbody>`;
  for (const req of pageData) {
    html += `<tr>
      <td>${req.id ? req.id.toString().substring(0,8) : '-'}</td>
      <td>${req.user_id || '-'}</td>
      <td>${req.email || '-'}</td>
      <td>${req.type ? req.type.toUpperCase() : '-'}</td>
      <td>${req.status || '-'}</td>
      <td>${req.created_at ? formatDate(req.created_at) : '-'}</td>
      <td>${
        req.result_url
          ? `<a href="${req.result_url}" download>Download</a>`
          : '-'
      }</td>
      <td>
        <button onclick="window.exportAllUserData('${req.user_id}')">Export</button>
        <button onclick="window.deleteAllUserData('${req.user_id}')">Delete</button>
        ${req.status === 'pending' ? `<button onclick="window.resolvePrivacyRequest('${req.id}')">Mark Complete</button>` : ''}
        <button onclick="window.deletePrivacyRequest('${req.id}')">Remove Request</button>
      </td>
    </tr>`;
  }
  html += '</tbody></table></div>';

  let paginationHTML = '';
  if (totalPages > 1) {
    paginationHTML += `<div style="text-align:center;margin:13px 0 3px 0;">`;
    if (page > 1) {
      paginationHTML += `<button class="pagination-btn" onclick="window.changePrivacyPage(${page - 1})">Previous</button>`;
    }
    for (let i = 1; i <= totalPages; i++) {
      if (i === page || totalPages <= 5 || (i >= page - 2 && i <= page + 2)) {
        paginationHTML += `<button class="pagination-btn${i === page ? ' active' : ''}" onclick="window.changePrivacyPage(${i})" ${i === page ? 'disabled' : ''}>${i}</button>`;
      } else if ((i === page - 3 && i > 1) || (i === page + 3 && i < totalPages)) {
        paginationHTML += '...';
      }
    }
    if (page < totalPages) {
      paginationHTML += `<button class="pagination-btn" onclick="window.changePrivacyPage(${page + 1})">Next</button>`;
    }
    paginationHTML += `</div>`;
  }
  document.getElementById('admin-privacy-table').innerHTML = dropdown + html + paginationHTML;

  document.getElementById('privacy-page-size').onchange = function () {
    privacyPagination.pageSize = parseInt(this.value, 10);
    privacyPagination.page = 1;
    renderPrivacyTable();
  };
}


// =========== GDPR/CCPA Export/Delete Actions ===========

// Export all user data as JSON (GDPR/CCPA)
window.exportAllUserData = async function(user_id) {
  if (!confirm("Export ALL data for this user?")) return;

  // Fetch user email for logging
  const { data: userData } = await supabase.from('users_extended_data').select('email').eq('user_id', user_id).single();
  const userEmail = userData ? userData.email : '';

  const tables = [
    { name: 'users_extended_data', key: 'user_id' },
    { name: 'private_offers', key: 'sponsor_email' },
    { name: 'private_offers', key: 'sponsee_email' },
    { name: 'private_offer_comments', key: 'user_id' },
    { name: 'private_offer_reviews', key: 'reviewer_id' },
    { name: 'payouts', key: 'sponsee_id' },
    // Add other tables if needed
  ];

  let allData = {};
  for (const table of tables) {
    const { data } = await supabase.from(table.name).select('*').eq(table.key, user_id);
    if (data && data.length) allData[table.name + ':' + table.key] = data;
  }

  const fileName = `user_export_${user_id}_${Date.now()}.json`;
  const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);

  // Log admin action
  await supabase.from('admin_activity_log').insert({
    action: 'Export User Data',
    performed_by: window.adminUserId,
    target_id: user_id,
    target_type: 'user',
    message: `Exported all data for user: ${user_id} (${userEmail})`,
    created_at: new Date().toISOString()
  });

  alert('User data exported.');
};

// Delete all user data (GDPR/CCPA)
window.deleteAllUserData = async function(user_id) {
  if (!confirm("Delete ALL data for this user? This CANNOT be undone!")) return;

  // Fetch user email for logging
  const { data: userData } = await supabase.from('users_extended_data').select('email').eq('user_id', user_id).single();
  const userEmail = userData ? userData.email : '';

  const tables = [
    { name: 'private_offer_comments', key: 'user_id' },
    { name: 'private_offer_reviews', key: 'reviewer_id' },
    { name: 'payouts', key: 'user_id' },
    { name: 'private_offers', key: 'sponsor_id' },
    { name: 'private_offers', key: 'sponsee_id' },
    { name: 'user_notifications', key: 'user_id' },
    { name: 'users_extended_data', key: 'user_id' }, // LAST
  ];

  for (const table of tables) {
    await supabase.from(table.name).delete().eq(table.key, user_id);
  }

  // Log admin action
  await supabase.from('admin_activity_log').insert({
    action: 'Delete User Data',
    performed_by: window.adminUserId,
    target_id: user_id,
    target_type: 'user',
    message: `Deleted all data for user: ${user_id} (${userEmail})`,
    created_at: new Date().toISOString()
  });

  alert('All user data deleted.');
  loadPrivacyRequests();
};


window.changePrivacyPage = (page) => {
  privacyPagination.page = page;
  renderPrivacyTable();
};

window.resolvePrivacyRequest = async (id) => {
  // Mark as complete (and set a result_url if you want)
  if (!confirm("Mark this request as completed?")) return;
  await supabase.from('user_privacy_requests').update({ status: 'completed' }).eq('id', id);
  loadPrivacyRequests();
};
window.deletePrivacyRequest = async (id) => {
  if (!confirm("Delete this privacy request?")) return;
  await supabase.from('user_privacy_requests').delete().eq('id', id);
  loadPrivacyRequests();
};

