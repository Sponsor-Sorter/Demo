import { supabase } from "./supabaseClient.js";
import { initAdminWorkspace } from "./adminWorkspace.js";

const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
let bannedOnlyFilter = false;
let userRequest = 0,
  offerRequest = 0,
  logRequest = 0,
  reportRequest = 0;

// ========== Utilities ==========
function safeResultUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "#";
  } catch {
    return "#";
  }
}
function formatDate(d) {
  if (!d) return "-";
  const date = new Date(d);
  return (
    date.toLocaleDateString() +
    " " +
    date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );
}
let modalReturnFocus;
window.closeAdminModal = () => {
  document.getElementById("admin-modal-root").replaceChildren();
  modalReturnFocus?.focus();
};
function showModal(title, contentHtml) {
  modalReturnFocus = document.activeElement;
  const modalRoot = document.getElementById("admin-modal-root");
  modalRoot.innerHTML = `
    <div class="modal-backdrop" onclick="window.closeAdminModal()"></div>
    <div class="modal-content" role="dialog" aria-modal="true" aria-label="${esc(title)}" tabindex="-1">
      <div class="modal-header">${title}</div>
      <div>${contentHtml}</div>
      <button onclick="window.closeAdminModal()" style="margin-top:1rem;background:#F6C62E;color:#222;">Close</button>
    </div>
  `;
  modalRoot.querySelector(".modal-content").focus();
}
function exportToCSV(filename, rows) {
  if (!rows || !rows.length) return alert("Nothing to export.");
  const header = Object.keys(rows[0]);
  const csv = [header.join(",")]
    .concat(
      rows.map((r) =>
        header
          .map(
            (h) =>
              `"${(r[h] ?? "")
                .toString()
                .replace(/^[\s]*[=+@-]/, (value) => "'" + value)
                .replace(/"/g, '""')}"`,
          )
          .join(","),
      ),
    )
    .join("\r\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ========== Pagination States ==========
let usersPagination = { page: 1, pageSize: 10, data: [] };
let offersPagination = { page: 1, pageSize: 10, data: [] };
let reviewsPagination = { page: 1, pageSize: 10, data: [] };
let privacyPagination = { page: 1, pageSize: 10, data: [] };
let famBotPagination = { page: 1, pageSize: 10, data: [] };
let ipModerationPagination = { page: 1, pageSize: 10, data: [] };
let adminLogPagination = { page: 1, pageSize: 10, data: [] };
let adminNotifyPagination = { page: 1, pageSize: 10, data: [] };

let reportedPagination = {
  users: { page: 1, pageSize: 10, data: [] },
  offers: { page: 1, pageSize: 10, data: [] },
  reviews: { page: 1, pageSize: 10, data: [] },
  comments: { page: 1, pageSize: 10, data: [] },
};

// One authenticated entry point. No admin data is loaded before verification.
document.addEventListener("DOMContentLoaded", async () => {
  const access = document.getElementById("admin-access-status");
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user || user.is_anonymous) {
      location.replace("login.html");
      return;
    }
    const { data: admin, error: adminError } = await supabase
      .from("users_extended_data")
      .select("is_admin, username")
      .eq("user_id", user.id)
      .single();
    if (adminError || !admin?.is_admin) {
      access.textContent =
        "Administrator access is required to open this workspace.";
      return;
    }
    window.adminUserId = user.id;
    document.getElementById("admin-identity").textContent =
      admin.username || "Administrator";
    document.getElementById("admin-workspace").hidden = false;
    access.hidden = true;
    bindAdminControls();
    const workspace = initAdminWorkspace({
      overview: loadAdminStats,
      users: () => loadAdminUsers(),
      offers: () => loadAdminOffers(),
      reviews: loadAdminReviews,
      reported: () =>
        loadReported(
          document.querySelector(".reported-tab.active")?.dataset.type ||
            "users",
        ),
      payouts: loadPayoutLogs,
      privacy: loadPrivacyRequests,
      log: loadAdminLog,
      notify: loadAdminNotifications,
      moderation: () => Promise.all([loadFamBotLogs(), loadIpModerationLogs()]),
      analytics: () => Promise.all([loadCharts(), loadAdvancedAnalytics()]),
      affiliates: async () =>
        (await import("./AffiliateAdmin.js?v=20261017-admin-affiliate3&notifications=20261012brand6")).initAffiliateAdmin(),
    });
    await workspace.start();
    supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        document.getElementById("admin-workspace").hidden = true;
        location.replace("login.html");
      }
    });
  } catch {
    access.hidden = false;
    document.getElementById("admin-workspace").hidden = true;
    access.textContent =
      "Could not verify administrator access. Reload the page to try again.";
  }
});

function bindAdminControls() {
  document.addEventListener("keydown", (event) => {
    const dialog = document.querySelector(
      "#admin-modal-root .modal-content, #admin-reject-modal-root .modal-content",
    );
    if (!dialog) return;
    if (event.key === "Escape") {
      window.closeAdminModal();
      closeRejectModal();
    }
    if (event.key === "Tab") {
      const items = [
        ...dialog.querySelectorAll(
          'button:not(:disabled), a[href], input:not(:disabled), textarea, select, [tabindex="0"]',
        ),
      ];
      const first = items[0],
        last = items.at(-1);
      if (!first) {
        event.preventDefault();
        dialog.focus();
      } else if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === dialog)
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
  const bind = (id, event, action) =>
    document.getElementById(id).addEventListener(event, action);
  const debounce = (action) => {
    let timer;
    return () => {
      clearTimeout(timer);
      timer = setTimeout(action, 250);
    };
  };
  bind("logout-link", "click", async (event) => {
    event.preventDefault();
    localStorage.removeItem("impersonate_user_id");
    await supabase.auth.signOut({ scope: 'local' });
    location.replace("login.html");
  });
  const impersonating = Boolean(localStorage.getItem("impersonate_user_id"));
  document.getElementById("stop-impersonate-row").hidden = !impersonating;
  bind("stop-impersonate-btn", "click", () => {
    localStorage.removeItem("impersonate_user_id");
    location.reload();
  });
  bind(
    "admin-user-search",
    "input",
    debounce(() => loadAdminUsers()),
  );
  ["userType-filter", "admin-status-filter"].forEach((id) =>
    bind(id, "change", () => loadAdminUsers()),
  );
  bind("admin-banned-filter", "click", () => {
    bannedOnlyFilter = !bannedOnlyFilter;
    document
      .getElementById("admin-banned-filter")
      .setAttribute("aria-pressed", String(bannedOnlyFilter));
    loadAdminUsers();
  });
  bind("admin-clear-user-filters", "click", () => {
    ["admin-user-search", "userType-filter", "admin-status-filter"].forEach(
      (id) => (document.getElementById(id).value = ""),
    );
    bannedOnlyFilter = false;
    document
      .getElementById("admin-banned-filter")
      .setAttribute("aria-pressed", "false");
    loadAdminUsers();
  });
  bind(
    "admin-offer-search",
    "input",
    debounce(() => loadAdminOffers()),
  );
  [
    "offer-status-filter",
    "admin-offer-date-start",
    "admin-offer-date-end",
  ].forEach((id) => bind(id, "change", () => loadAdminOffers()));
  ["log-action-filter", "log-admin-filter", "log-type-filter"].forEach((id) =>
    bind(id, "input", debounce(loadAdminLog)),
  );
  ["log-date-start", "log-date-end"].forEach((id) =>
    bind(id, "change", loadAdminLog),
  );
  bind("admin-notify-form", "submit", sendAdminNotification);
  bind("admin-report-status", "change", () =>
    loadReported(
      document.querySelector(".reported-tab.active")?.dataset.type || "users",
    ),
  );
  const exports = {
    users: exportUsersCSV,
    offers: exportOffersCSV,
    reviews: exportReviewsCSV,
    log: exportLogCSV,
    payout: exportPayoutCSV,
  };
  Object.entries(exports).forEach(([name, action]) =>
    bind("export-" + name + "-csv", "click", action),
  );
  bind("ban-selected-users", "click", () => bulkBanUsers(true));
  bind("unban-selected-users", "click", () => bulkBanUsers(false));
  bind("delete-selected-offers", "click", bulkDeleteOffers);
  document.querySelectorAll(".reported-tab").forEach((button, index) => {
    if (!index) {
      button.classList.add("active");
      button.setAttribute("aria-pressed", "true");
    }
    button.addEventListener("click", () => {
      document.querySelectorAll(".reported-tab").forEach((tab) => {
        tab.classList.toggle("active", tab === button);
        tab.setAttribute("aria-pressed", String(tab === button));
      });
      loadReported(button.dataset.type);
    });
  });
  // Labels for legacy controls also provide meaningful names to screen readers.
  document
    .querySelectorAll(
      ".admin-section input:not([aria-label]), .admin-section textarea:not([aria-label]), .admin-section select:not([aria-label])",
    )
    .forEach((input) => {
      const label = document.querySelector('label[for="' + input.id + '"]');
      if (!label)
        input.setAttribute(
          "aria-label",
          input.placeholder || input.id.replace(/-/g, " "),
        );
    });
}

// ========== Modals ==========
function showRejectModal(payoutId) {
  const modalRoot = document.getElementById("admin-reject-modal-root");
  modalRoot.innerHTML = `
    <div class="modal-backdrop" onclick="closeRejectModal()"></div>
    <div class="modal-content" role="dialog" aria-modal="true" aria-label="Reject payout" tabindex="-1" style="max-width:430px;">
      <div class="modal-header">Reject Payout</div>
      <form id="reject-payout-form">
        <div style="margin-bottom:10px;">Please enter the reason for rejection:</div>
        <textarea id="reject-reason" style="width:100%;min-height:68px;" required placeholder="E.g. Not enough funds, invalid payout info..."></textarea>
        <div style="margin-top:16px;display:flex;gap:12px;justify-content:flex-end;">
          <button type="button" onclick="closeRejectModal()" style="background:#aaa;color:#222;">Cancel</button>
          <button type="submit" style="background:#ff1e40;color:#fff;">Reject</button>
        </div>
      </form>
    </div>
  `;
  document.getElementById("reject-payout-form").onsubmit = function (e) {
    e.preventDefault();
    const reason = document.getElementById("reject-reason").value.trim();
    if (!reason) return;
    window.confirmRejectPayout(payoutId, reason);
    closeRejectModal();
  };
}

function closeRejectModal() {
  const modalRoot = document.getElementById("admin-reject-modal-root");
  if (modalRoot) modalRoot.innerHTML = "";
}

// The rest of your file remains unchanged from your last version.
// (It was too large to fit within the message window in one go, but everything below this comment is *not modified* from your original file.)

// ========== Stats ==========
async function loadAdminStats() {
  const count = (table, column, filter) => {
    let query = supabase
      .from(table)
      .select(column, { count: "exact", head: true });
    if (filter) query = query.eq(...filter);
    return query;
  };
  const specs = [
    ["Users", "users_extended_data", "user_id"],
    ["Sponsorships", "private_offers", "id"],
    ["Reviews", "private_offer_reviews", "id"],
    ["Pending offers", "private_offers", "id", ["status", "pending"]],
    ["Accepted", "private_offers", "id", ["status", "accepted"]],
    ["In progress", "private_offers", "id", ["status", "in_progress"]],
    ["Live", "private_offers", "id", ["status", "live"]],
    ["Completed", "private_offers", "id", ["status", "completed"]],
  ];
  const reportTables = [
    "reported_users",
    "reported_offers",
    "reported_reviews",
    "reported_comments",
  ];
  const [stats, reports, payout, privacy, activity] = await Promise.all([
    Promise.all(
      specs.map(([, table, column, filter]) => count(table, column, filter)),
    ),
    Promise.all(
      reportTables.map((table) => count(table, "id", ["status", "pending"])),
    ),
    count("payouts", "id", ["status", "pending"]),
    count("user_privacy_requests", "id", ["status", "pending"]),
    supabase
      .from("admin_activity_log")
      .select("action, target_type, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);
  const value = (result) =>
    result.error ? "—" : Number(result.count || 0).toLocaleString();
  document.getElementById("admin-stats-cards").innerHTML = specs
    .map(
      ([title], i) =>
        '<div class="admin-stat-card"><span>' +
        title +
        "</span><strong>" +
        value(stats[i]) +
        "</strong><small>" +
        (stats[i].error
          ? "Unavailable · refresh to retry"
          : "Current platform total") +
        "</small></div>",
    )
    .join("");
  const reportError = reports.some((result) => result.error);
  const reportCount = reportError
    ? null
    : reports.reduce((sum, result) => sum + (result.count || 0), 0);
  const queue = [
    [
      "reported",
      "Pending reports",
      reportCount,
      "Investigate flagged content and accounts",
    ],
    [
      "payouts",
      "Pending payouts",
      payout.error ? null : payout.count || 0,
      "Review payment requests",
    ],
    [
      "privacy",
      "Privacy requests",
      privacy.error ? null : privacy.count || 0,
      "Review pending export and deletion requests",
    ],
  ];
  document.getElementById("admin-attention-queue").innerHTML = queue
    .map(
      ([view, title, number, description]) =>
        '<button type="button" class="admin-queue-card" data-admin-view="' +
        view +
        '"><span>' +
        title +
        "</span><strong>" +
        (number === null ? "—" : Number(number).toLocaleString()) +
        "</strong><small>" +
        (number === null ? "Unavailable · refresh to retry" : description) +
        "</small><span>Open queue →</span></button>",
    )
    .join("");
  queue.forEach(([view, , number]) => {
    const badge = document.querySelector('[data-admin-count="' + view + '"]');
    badge.hidden = number === null || number === 0;
    badge.textContent = number === null ? "" : Number(number).toLocaleString();
  });
  const banner = document.getElementById("unread-reports-banner");
  banner.hidden = !reportCount;
  banner.innerHTML = reportCount
    ? "<strong>" +
      reportCount +
      (reportCount === 1 ? " report awaits review." : " reports await review.") +
      '</strong><button type="button" data-admin-view="reported">Review reports →</button>'
    : "";
  document.getElementById("admin-recent-activity").innerHTML = activity.error
    ? '<p class="admin-empty-state">Recent activity could not be loaded.</p>'
    : activity.data?.length
      ? activity.data
          .map(
            (item) =>
              '<div class="admin-activity-item"><strong>' +
              esc(item.action) +
              "</strong><small>" +
              esc(item.target_type || "Platform") +
              " · " +
              esc(formatDate(item.created_at)) +
              "</small></div>",
          )
          .join("")
      : '<p class="admin-empty-state">No admin actions recorded yet.</p>';
  if (
    stats.some((result) => result.error) ||
    reportError ||
    payout.error ||
    privacy.error ||
    activity.error
  ) {
    throw new Error("Some overview data is unavailable. Refresh to try again.");
  }
}

// ========== User Management with Advanced Filters & Bulk & Pagination ==========
async function loadAdminUsers(
  searchTerm = document.getElementById("admin-user-search").value.trim(),
  bannedOnly = bannedOnlyFilter,
) {
  const request = ++userRequest;
  let query = supabase
    .from("users_extended_data")
    .select("user_id, email, username, userType, is_admin, banned, profile_pic")
    .order("username", { ascending: true });

  const userType = document.getElementById("userType-filter").value;
  const adminStatus = document.getElementById("admin-status-filter").value;
  if (searchTerm) query = query.ilike("username", `%${searchTerm}%`);
  if (bannedOnly) query = query.eq("banned", true);
  if (userType) query = query.eq("userType", userType);
  if (adminStatus === "admins") query = query.eq("is_admin", true);
  if (adminStatus === "notadmins") query = query.eq("is_admin", false);

  const { data: users, error } = await query;
  if (request !== userRequest) return;
  if (error) {
    document.getElementById("admin-users-table").innerHTML =
      `<span class="admin-data-error" role="alert">Could not load users.</span>`;
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
        ${pageSizes.map((size) => `<option value="${size}"${size === pageSize ? " selected" : ""}>${size}</option>`).join("")}
      </select>
    </div>
  `;

  let html = `<div class="admin-table-scroll">`;
  html += `<table class="admin-table"><thead>
    <tr>
      <th><input type="checkbox" id="select-all-users"></th>
      <th>Profile</th><th>Username</th><th>Email</th><th>Role</th><th>Admin?</th><th>Banned?</th><th>Actions</th>
    </tr></thead><tbody>`;

  for (const user of pageData) {
    const profileUrl = user.profile_pic
      ? `https://mqixtrnhotqqybaghgny.supabase.co/storage/v1/object/public/logos/${user.profile_pic}`
      : `https://mqixtrnhotqqybaghgny.supabase.co/storage/v1/object/public/logos/logos.png`; // fallback hosted image
    html += `<tr>
      <td><input type="checkbox" class="user-checkbox" data-userid="${user.user_id}"></td>
      <td><img src="${esc(profileUrl)}" alt="pic" style="width:32px;height:32px;border-radius:50%;"></td>
      <td>${esc(user.username)}</td>
      <td>${esc(user.email)}</td>
      <td>${esc({ sponsor: "Sponsor", besponsored: "Sponsee", sponsee: "Sponsee" }[user.userType] || user.userType)}</td>
      <td>${user.is_admin ? "✅" : "❌"}</td>
      <td>${user.banned ? "🚫" : ""}</td>
      <td class="admin-actions">
        <button onclick="window.toggleAdmin('${user.user_id}',${user.is_admin})">${user.is_admin ? "Revoke" : "Make"} Admin</button>
        <button onclick="window.banUser('${user.user_id}',${user.banned})">${user.banned ? "Unban" : "Ban"}</button>
        <button onclick="window.viewUserDetails('${user.user_id}')">Details</button>
        <button onclick="window.impersonateUser('${user.user_id}')">Impersonate</button>
      </td>
    </tr>`;
  }
  html += "</tbody></table></div>";

  let paginationHTML = "";
  if (totalPages > 1) {
    paginationHTML += `<div style="text-align:center;margin:13px 0 3px 0;">`;
    if (page > 1) {
      paginationHTML += `<button class="pagination-btn" onclick="window.changeUsersPage(${page - 1})">Previous</button>`;
    }
    for (let i = 1; i <= totalPages; i++) {
      if (i === page || totalPages <= 5 || (i >= page - 2 && i <= page + 2)) {
        paginationHTML += `<button class="pagination-btn${i === page ? " active" : ""}" onclick="window.changeUsersPage(${i})" ${i === page ? "disabled" : ""}>${i}</button>`;
      } else if (
        (i === page - 3 && i > 1) ||
        (i === page + 3 && i < totalPages)
      ) {
        paginationHTML += "...";
      }
    }
    if (page < totalPages) {
      paginationHTML += `<button class="pagination-btn" onclick="window.changeUsersPage(${page + 1})">Next</button>`;
    }
    paginationHTML += `</div>`;
  }
  document.getElementById("admin-users-table").innerHTML =
    dropdown + html + paginationHTML;

  document.getElementById("select-all-users").onclick = function () {
    document
      .querySelectorAll(".user-checkbox")
      .forEach((cb) => (cb.checked = this.checked));
  };
  document.getElementById("users-page-size").onchange = function () {
    usersPagination.pageSize = parseInt(this.value, 10);
    usersPagination.page = 1;
    renderAdminUsersTable();
  };
}
window.changeUsersPage = (page) => {
  usersPagination.page = page;
  renderAdminUsersTable();
};
async function updateAdminAccounts(ids, changes, action) {
  try {
    const { data, error } = await supabase
      .from("users_extended_data")
      .update(changes)
      .in("user_id", ids)
      .select("user_id");
    if (error || data?.length !== ids.length)
      throw new Error(
        "The account update did not complete. Refresh the list and try again.",
      );
    const { error: logError } = await supabase
      .from("admin_activity_log")
      .insert(
        ids.map((id) => ({
          action,
          performed_by: window.adminUserId,
          target_id: id,
          target_type: "user",
        })),
      );
    if (logError)
      alert("Accounts updated, but the audit log could not be saved.");
    await loadAdminUsers();
  } catch (error) {
    alert(error.message || "Could not update the selected accounts.");
  }
}
window.toggleAdmin = async (uid, isAdmin) => {
  if (uid === window.adminUserId && isAdmin)
    return alert("You cannot revoke your own admin access here.");
  if (
    !confirm(
      "Are you sure you want to " +
        (isAdmin ? "revoke" : "grant") +
        " administrator access?",
    )
  )
    return;
  await updateAdminAccounts(
    [uid],
    { is_admin: !isAdmin },
    isAdmin ? "Revoke Admin" : "Grant Admin",
  );
};
window.banUser = async (uid, isBanned) => {
  if (uid === window.adminUserId && !isBanned)
    return alert("You cannot ban your own administrator account.");
  if (!confirm((isBanned ? "Unban" : "Ban") + " this account?")) return;
  await updateAdminAccounts(
    [uid],
    { banned: !isBanned },
    isBanned ? "Unban User" : "Ban User",
  );
};
window.viewUserDetails = async (uid) => {
  const { data: user, error } = await supabase
    .from("users_extended_data")
    .select(
      "username, email, userType, about_yourself, contenttype, platforms, banned, is_admin, created_at",
    )
    .eq("user_id", uid)
    .single();
  if (error || !user) return alert("Could not load user details.");
  let platforms = user.platforms ? JSON.stringify(user.platforms) : "-";
  let html = `
    <p><b>Username:</b> ${esc(user.username)}</p>
    <p><b>Email:</b> ${esc(user.email)}</p>
    <p><b>Type:</b> ${esc(user.userType)}</p>
    <p><b>Bio:</b> ${esc(user.about_yourself || "-")}</p>
    <p><b>Content Type:</b> ${esc(user.contenttype || "-")}</p>
    <p><b>Platforms:</b> ${esc(platforms)}</p>
    <p><b>Banned:</b> ${user.banned ? "Yes" : "No"}</p>
    <p><b>Admin:</b> ${user.is_admin ? "Yes" : "No"}</p>
    <p><b>Created:</b> ${formatDate(user.created_at)}</p>
  `;
  showModal("User Details", html);
};
window.impersonateUser = async (uid) => {
  if (
    !confirm("Impersonate this user? You will act as them until logging out.")
  )
    return;
  localStorage.setItem("impersonate_user_id", uid);
  alert(
    "Impersonation set. Log out or use the Stop Impersonating button to return to your own admin account.",
  );
  window.location.reload();
};
async function bulkBanUsers(ban = true) {
  const ids = [...document.querySelectorAll(".user-checkbox:checked")].map(
    (box) => box.dataset.userid,
  );
  if (!ids.length) return alert("Select at least one account.");
  if (ban && ids.includes(window.adminUserId))
    return alert("Remove your own administrator account from the selection.");
  if (!confirm((ban ? "Ban " : "Unban ") + ids.length + " selected accounts?"))
    return;
  await updateAdminAccounts(
    ids,
    { banned: ban },
    ban ? "Ban User (bulk)" : "Unban User (bulk)",
  );
}
async function exportUsersCSV() {
  exportToCSV("users.csv", usersPagination.data);
}

// ========== Offer Management with Filters & Bulk & Pagination ==========
async function loadAdminOffers(
  _unused,
  searchTerm = document.getElementById("admin-offer-search").value.trim(),
) {
  const request = ++offerRequest;
  const status = document.getElementById("offer-status-filter").value;
  const dateStart = document.getElementById("admin-offer-date-start").value;
  const dateEnd = document.getElementById("admin-offer-date-end").value;
  let query = supabase
    .from("private_offers")
    .select(
      "id, offer_title, sponsor_username, sponsor_email, sponsee_username, sponsee_email, status, stage, offer_amount, created_at, offer_description",
    )
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);
  if (searchTerm) query = query.ilike("offer_title", "%" + searchTerm + "%");
  if (dateStart) query = query.gte("created_at", dateStart + "T00:00:00");
  if (dateEnd) query = query.lte("created_at", dateEnd + "T23:59:59");

  const { data: offers, error } = await query;
  if (request !== offerRequest) return;
  if (error) {
    document.getElementById("admin-offers-table").innerHTML =
      `<span class="admin-data-error" role="alert">Could not load offers.</span>`;
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
        ${pageSizes.map((size) => `<option value="${size}"${size === pageSize ? " selected" : ""}>${size}</option>`).join("")}
      </select>
    </div>
  `;

  let html = `<div class="admin-table-scroll">`;
  html += `<table class="admin-table"><thead>
    <tr>
      <th><input type="checkbox" id="select-all-offers"></th>
      <th>ID</th><th>Title</th><th>Sponsor</th><th>Sponsee</th><th>Status</th><th>Stage</th><th>Amount</th><th>Created</th><th>Actions</th>
    </tr></thead><tbody>`;
  for (const offer of pageData) {
    html += `<tr>
      <td><input type="checkbox" class="offer-checkbox" data-offerid="${offer.id}"></td>
      <td style="font-size:0.85em;">${offer.id.substring(0, 8)}...</td>
      <td>${esc(offer.offer_title || "")}</td>
      <td>${offer.sponsor_username || offer.sponsor_email || ""}</td>
      <td>${offer.sponsee_username || offer.sponsee_email || ""}</td>
      <td>${esc(offer.status)}</td>
      <td>${offer.stage ?? ""}</td>
      <td>$${offer.offer_amount ?? "-"}</td>
      <td>${offer.created_at ? formatDate(offer.created_at) : ""}</td>
      <td class="admin-actions">
        <button onclick="window.deleteOffer('${offer.id}')">Delete</button>
        <button onclick="window.viewOfferModal('${offer.id}')">Details</button>
      </td>
    </tr>`;
  }
  html += "</tbody></table></div>";

  let paginationHTML = "";
  if (totalPages > 1) {
    paginationHTML += `<div style="text-align:center;margin:13px 0 3px 0;">`;
    if (page > 1) {
      paginationHTML += `<button class="pagination-btn" onclick="window.changeOffersPage(${page - 1})">Previous</button>`;
    }
    for (let i = 1; i <= totalPages; i++) {
      if (i === page || totalPages <= 5 || (i >= page - 2 && i <= page + 2)) {
        paginationHTML += `<button class="pagination-btn${i === page ? " active" : ""}" onclick="window.changeOffersPage(${i})" ${i === page ? "disabled" : ""}>${i}</button>`;
      } else if (
        (i === page - 3 && i > 1) ||
        (i === page + 3 && i < totalPages)
      ) {
        paginationHTML += "...";
      }
    }
    if (page < totalPages) {
      paginationHTML += `<button class="pagination-btn" onclick="window.changeOffersPage(${page + 1})">Next</button>`;
    }
    paginationHTML += `</div>`;
  }
  document.getElementById("admin-offers-table").innerHTML =
    dropdown + html + paginationHTML;

  document.getElementById("select-all-offers").onclick = function () {
    document
      .querySelectorAll(".offer-checkbox")
      .forEach((cb) => (cb.checked = this.checked));
  };
  document.getElementById("offers-page-size").onchange = function () {
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
  await supabase.from("private_offer_comments").delete().eq("offer_id", id);
  await supabase.from("private_offer_reviews").delete().eq("offer_id", id);
  await supabase.from("private_offers").delete().eq("id", id);
  await supabase.from("admin_activity_log").insert({
    action: "Delete Offer",
    performed_by: window.adminUserId,
    target_id: id,
    target_type: "offer",
  });
  loadAdminOffers();
  loadAdminLog();
};
window.viewOfferModal = async (id) => {
  const { data: offer, error } = await supabase
    .from("private_offers")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !offer) return alert("Could not load offer details.");
  let html = `
    <p><b>Title:</b> ${esc(offer.offer_title)}</p>
    <p><b>Sponsor:</b> ${offer.sponsor_username || offer.sponsor_email}</p>
    <p><b>Sponsee:</b> ${offer.sponsee_username || offer.sponsee_email}</p>
    <p><b>Status:</b> ${esc(offer.status)} | <b>Stage:</b> ${offer.stage}</p>
    <p><b>Amount:</b> $${offer.offer_amount}</p>
    <p><b>Created:</b> ${formatDate(offer.created_at)}</p>
    <p><b>Description:</b><br>${esc(offer.offer_description)}</p>
    <hr>
    <button onclick="window.open('/reviewThread.html?offer_id=${offer.id}','_blank')">Open Thread</button>
  `;
  showModal("Offer Details", html);
};
async function bulkDeleteOffers() {
  const selected = [
    ...document.querySelectorAll(".offer-checkbox:checked"),
  ].map((cb) => cb.dataset.offerid);
  if (!selected.length) return alert("No offers selected.");
  if (!confirm(`Delete ${selected.length} offers and their comments/reviews?`))
    return;
  for (const id of selected) {
    await supabase.from("private_offer_comments").delete().eq("offer_id", id);
    await supabase.from("private_offer_reviews").delete().eq("offer_id", id);
    await supabase.from("private_offers").delete().eq("id", id);
    await supabase.from("admin_activity_log").insert({
      action: "Delete Offer (bulk)",
      performed_by: window.adminUserId,
      target_id: id,
      target_type: "offer",
    });
  }
  loadAdminOffers();
  loadAdminLog();
}
async function exportOffersCSV() {
  exportToCSV("offers.csv", offersPagination.data);
}

// ========== Review Moderation with Pagination ==========
// ========== Review Moderation with Pagination ==========
async function loadAdminReviews() {
  const { data: reviews, error } = await supabase
    .from("private_offer_reviews")
    .select(
      "id, offer_id, reviewer_id, reviewer_role, review_text, overall, communication, punctuality, work_output, reply, created_at",
    )
    .order("created_at", { ascending: false });

  if (error) {
    document.getElementById("admin-reviews-table").innerHTML =
      `<span class="admin-data-error" role="alert">Could not load reviews.</span>`;
    return;
  }

  // Fetch reviewer usernames
  const reviewerIds = [...new Set(reviews.map((r) => r.reviewer_id))];
  const offerIds = [...new Set(reviews.map((r) => r.offer_id))];

  const [{ data: users = [] }, { data: offers = [] }] = await Promise.all([
    supabase
      .from("users_extended_data")
      .select("user_id, username")
      .in("user_id", reviewerIds),
    supabase
      .from("private_offers")
      .select("id, offer_title")
      .in("id", offerIds),
  ]);

  const userMap = {};
  users.forEach((u) => {
    userMap[u.user_id] = u.username;
  });

  const offerMap = {};
  offers.forEach((o) => {
    offerMap[o.id] = o.offer_title;
  });

  reviewsPagination.data = reviews.map((r) => ({
    ...r,
    reviewer_username: userMap[r.reviewer_id] ?? "(Unknown)",
    offer_title: offerMap[r.offer_id] ?? "(Unknown Offer)",
  }));

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
        ${pageSizes.map((size) => `<option value="${size}"${size === pageSize ? " selected" : ""}>${size}</option>`).join("")}
      </select>
    </div>
  `;

  let html = `<div class="admin-table-scroll">`;
  html += `<table class="admin-table"><thead>
    <tr>
      <th>Offer Title</th><th>Reviewer</th><th>Role</th><th>Overall</th><th>Review</th><th>Reply</th><th>Created</th><th>Actions</th>
    </tr></thead><tbody>`;
  for (const r of pageData) {
    html += `<tr>
      <td>${esc(r.offer_title)}</td>
      <td>${r.reviewer_username}</td>
      <td>${r.reviewer_role}</td>
      <td>${"★".repeat(r.overall) + "☆".repeat(5 - r.overall)}</td>
      <td>${r.review_text}</td>
      <td>${r.reply ? r.reply : "-"}</td>
      <td>${formatDate(r.created_at)}</td>
      <td class="admin-actions">
        <button onclick="window.deleteReview('${r.id}')">Delete</button>
        <button onclick="window.replyReview('${r.id}', '${r.reply ? encodeURIComponent(r.reply) : ""}')">Reply</button>
      </td>
    </tr>`;
  }
  html += "</tbody></table></div>";

  let paginationHTML = "";
  if (totalPages > 1) {
    paginationHTML += `<div style="text-align:center;margin:13px 0 3px 0;">`;
    if (page > 1) {
      paginationHTML += `<button class="pagination-btn" onclick="window.changeReviewsPage(${page - 1})">Previous</button>`;
    }
    for (let i = 1; i <= totalPages; i++) {
      if (i === page || totalPages <= 5 || (i >= page - 2 && i <= page + 2)) {
        paginationHTML += `<button class="pagination-btn${i === page ? " active" : ""}" onclick="window.changeReviewsPage(${i})" ${i === page ? "disabled" : ""}>${i}</button>`;
      } else if (
        (i === page - 3 && i > 1) ||
        (i === page + 3 && i < totalPages)
      ) {
        paginationHTML += "...";
      }
    }
    if (page < totalPages) {
      paginationHTML += `<button class="pagination-btn" onclick="window.changeReviewsPage(${page + 1})">Next</button>`;
    }
    paginationHTML += `</div>`;
  }
  document.getElementById("admin-reviews-table").innerHTML =
    dropdown + html + paginationHTML;

  document.getElementById("reviews-page-size").onchange = function () {
    reviewsPagination.pageSize = parseInt(this.value, 10);
    reviewsPagination.page = 1;
    renderAdminReviewsTable();
  };
}

async function exportReviewsCSV() {
  exportToCSV("reviews.csv", reviewsPagination.data);
}

// ========== Notification Sender ==========
async function sendAdminNotification(event) {
  event.preventDefault();
  const form = document.getElementById("admin-notify-form");
  const feedback = document.getElementById("admin-notify-status");
  const button = form.querySelector('[type="submit"]');
  const title = document.getElementById("notify-title").value.trim();
  const message = document.getElementById("notify-message").value.trim();
  const email = document.getElementById("notify-email").value.trim();
  if (!title || !message) return;
  if (!email && !confirm("Send this in-app notification to every account?"))
    return;
  button.disabled = true;
  feedback.textContent = "Sending notifications…";
  try {
    const users = [];
    for (let offset = 0; ; offset += 500) {
      let query = supabase
        .from("users_extended_data")
        .select("email, notification_uuid")
        .order("user_id", { ascending: true })
        .range(offset, offset + 499);
      if (email) query = query.eq("email", email);
      const { data, error } = await query;
      if (error)
        throw new Error("Could not load recipients. Nothing was sent.");
      users.push(...(data || []));
      if (!data || data.length < 500) break;
    }
    if (!users.length)
      throw new Error("No matching accounts found. Nothing was sent.");
    const recipients = users.filter((user) => user.notification_uuid);
    if (!recipients.length)
      throw new Error(
        "These accounts have no notification inbox. Nothing was sent.",
      );
    let sent = 0;
    let failed = 0;
    // Bound simultaneous requests and report partial failures accurately.
    for (let offset = 0; offset < recipients.length; offset += 25) {
      const results = await Promise.allSettled(
        recipients.slice(offset, offset + 25).map((user) =>
          supabase.from("user_notifications").insert({
            notification_uuid: user.notification_uuid,
            email: user.email,
            type: "admin",
            title,
            message,
            read: false,
            created_at: new Date().toISOString(),
          }),
        ),
      );
      results.forEach((result) =>
        result.status === "fulfilled" && !result.value.error
          ? sent++
          : failed++,
      );
    }
    const skipped = users.length - recipients.length;
    const { error: logError } = await supabase
      .from("admin_activity_log")
      .insert({
        action: "Send Notification",
        performed_by: window.adminUserId,
        target_id: email || "all",
        target_type: "user",
        message:
          title +
          " (sent: " +
          sent +
          ", failed: " +
          failed +
          ", skipped: " +
          skipped +
          ")",
      });
    feedback.textContent =
      "Sent: " +
      sent +
      ". Failed: " +
      failed +
      ". Accounts without an inbox: " +
      skipped +
      "." +
      (logError ? " The activity log could not be saved." : "");
    if (sent && !failed && !skipped) form.reset();
    await loadAdminNotifications();
  } catch (error) {
    feedback.textContent = error.message || "Could not send notifications.";
  } finally {
    button.disabled = false;
  }
}

// ========== Admin Notifications Table ==========
async function loadAdminNotifications() {
  const { data, error } = await supabase
    .from("user_notifications")
    .select("id, email, title, message, created_at")
    .eq("type", "admin")
    .order("created_at", { ascending: false });

  if (error) {
    document.getElementById("admin-notify-table").innerHTML =
      `<span class="admin-data-error" role="alert">Could not load admin notifications.</span>`;
    return;
  }

  adminNotifyPagination.data = data || [];
  adminNotifyPagination.page = 1;
  renderAdminNotifyTable();
}

function renderAdminNotifyTable() {
  const el = document.getElementById("admin-notify-table");
  const { page, pageSize, data } = adminNotifyPagination;
  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  const startIdx = (page - 1) * pageSize;
  const pageData = data.slice(startIdx, startIdx + pageSize);

  const pageSizes = [5, 10, 20, 50, 100];
  const dropdown = `
    <div style="margin-bottom:8px;">
      <label for="notify-page-size" style="font-weight:500;margin-right:6px;">Rows per page:</label>
      <select id="notify-page-size" style="padding:2px 10px; border-radius:5px;">
        ${pageSizes.map((size) => `<option value="${size}"${size === pageSize ? " selected" : ""}>${size}</option>`).join("")}
      </select>
    </div>
  `;

  let html = `<div class="admin-table-scroll">`;
  html += `<table class="admin-table"><thead>
    <tr><th>Title</th><th>Message</th><th>Email</th><th>Created</th><th>Action</th></tr></thead><tbody>`;

  for (const n of pageData) {
    html += `<tr>
      <td>${esc(n.title)}</td>
      <td>${esc(n.message)}</td>
      <td>${esc(n.email || "(All Users)")}</td>
      <td>${formatDate(n.created_at)}</td>
      <td><button onclick="window.deleteAdminNotification('${n.id}')">Delete</button></td>
    </tr>`;
  }

  html += "</tbody></table></div>";

  let paginationHTML = "";
  if (totalPages > 1) {
    paginationHTML += `<div style="text-align:center;margin:13px 0 3px 0;">`;
    if (page > 1) {
      paginationHTML += `<button class="pagination-btn" onclick="window.changeAdminNotifyPage(${page - 1})">Previous</button>`;
    }
    for (let i = 1; i <= totalPages; i++) {
      paginationHTML += `<button class="pagination-btn${i === page ? " active" : ""}" onclick="window.changeAdminNotifyPage(${i})">${i}</button>`;
    }
    if (page < totalPages) {
      paginationHTML += `<button class="pagination-btn" onclick="window.changeAdminNotifyPage(${page + 1})">Next</button>`;
    }
    paginationHTML += `</div>`;
  }

  el.innerHTML = dropdown + html + paginationHTML;

  document.getElementById("notify-page-size").onchange = function () {
    adminNotifyPagination.pageSize = parseInt(this.value, 10);
    adminNotifyPagination.page = 1;
    renderAdminNotifyTable();
  };
}

window.changeAdminNotifyPage = (page) => {
  adminNotifyPagination.page = page;
  renderAdminNotifyTable();
};

window.deleteAdminNotification = async (id) => {
  if (!confirm("Delete this notification?")) return;
  await supabase.from("user_notifications").delete().eq("id", id);
  await loadAdminNotifications();
};

// ========== Admin Activity Log with Full Pagination + Filters ==========

// Declare pagination state

async function loadAdminLog() {
  const request = ++logRequest;
  const actionFilter = document.getElementById("log-action-filter")?.value;
  const adminFilter = document.getElementById("log-admin-filter")?.value;
  const typeFilter = document.getElementById("log-type-filter")?.value;
  const dateStart = document.getElementById("log-date-start")?.value;
  const dateEnd = document.getElementById("log-date-end")?.value;

  let query = supabase
    .from("admin_activity_log")
    .select(
      "id, action, performed_by, target_id, target_type, message, created_at",
    )
    .order("created_at", { ascending: false });

  if (actionFilter) query = query.ilike("action", `%${actionFilter}%`);
  if (adminFilter) query = query.eq("performed_by", adminFilter);
  if (typeFilter) query = query.eq("target_type", typeFilter);
  if (dateStart) query = query.gte("created_at", dateStart + "T00:00:00");
  if (dateEnd) query = query.lte("created_at", dateEnd + "T23:59:59");

  const { data: logs, error } = await query;
  if (request !== logRequest) return;

  if (error) {
    const logTable = document.getElementById("admin-log-table");
    if (logTable)
      logTable.innerHTML = `<span class="admin-data-error" role="alert">Could not load admin log.</span>`;
    return;
  }

  adminLogPagination.data = logs || [];
  adminLogPagination.page = 1;
  renderAdminLogTable();
}

function renderAdminLogTable() {
  const el = document.getElementById("admin-log-table");
  const { page, pageSize, data } = adminLogPagination;
  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  const startIdx = (page - 1) * pageSize;
  const pageData = data.slice(startIdx, startIdx + pageSize);

  const pageSizes = [5, 10, 20, 50, 100];
  const dropdown = `
    <div style="margin-bottom:8px;">
      <label for="log-page-size" style="font-weight:500;margin-right:6px;">Rows per page:</label>
      <select id="log-page-size" style="padding:2px 10px; border-radius:5px;">
        ${pageSizes.map((size) => `<option value="${size}"${size === pageSize ? " selected" : ""}>${size}</option>`).join("")}
      </select>
    </div>
  `;

  let html = `<div class="admin-table-scroll">`;
  html += `<table class="admin-table"><thead>
    <tr><th>When</th><th>Action</th><th>Admin</th><th>Target</th><th>Type</th><th>Details</th></tr></thead><tbody>`;

  for (const log of pageData) {
    html += `<tr>
      <td>${formatDate(log.created_at)}</td>
      <td>${esc(log.action)}</td>
      <td>${esc(log.performed_by || "-")}</td>
      <td>${esc(log.target_id || "-")}</td>
      <td>${esc(log.target_type)}</td>
      <td>${esc(log.message || "")}</td>
    </tr>`;
  }

  html += "</tbody></table></div>";

  let paginationHTML = "";
  if (totalPages > 1) {
    paginationHTML += `<div style="text-align:center;margin:13px 0 3px 0;">`;
    if (page > 1) {
      paginationHTML += `<button class="pagination-btn" onclick="window.changeAdminLogPage(${page - 1})">Previous</button>`;
    }
    for (let i = 1; i <= totalPages; i++) {
      paginationHTML += `<button class="pagination-btn${i === page ? " active" : ""}" onclick="window.changeAdminLogPage(${i})">${i}</button>`;
    }
    if (page < totalPages) {
      paginationHTML += `<button class="pagination-btn" onclick="window.changeAdminLogPage(${page + 1})">Next</button>`;
    }
    paginationHTML += `</div>`;
  }

  el.innerHTML = dropdown + html + paginationHTML;

  document.getElementById("log-page-size").onchange = function () {
    adminLogPagination.pageSize = parseInt(this.value, 10);
    adminLogPagination.page = 1;
    renderAdminLogTable();
  };
}

window.changeAdminLogPage = (page) => {
  adminLogPagination.page = page;
  renderAdminLogTable();
};

async function exportLogCSV() {
  exportToCSV("admin_log.csv", adminLogPagination.data);
}

// ========== Payout/Transaction Log ==========
async function loadPayoutLogs() {
  const { data: payouts, error } = await supabase
    .from("payouts")
    .select(
      "id, offer_id, sponsee_id, sponsee_email, payout_amount, payout_method, payout_reference, paid_by_admin_id, paid_at, notes, status, created_at, payout_user_role",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    document.getElementById("admin-payout-table").innerHTML =
      `<span class="admin-data-error" role="alert">Could not load payouts.</span>`;
    return;
  }

  if (!payouts || !payouts.length) {
    document.getElementById("admin-payout-table").innerHTML =
      `<span>No payouts found.</span>`;
    return;
  }

  // Fetch mappings for offer titles and sponsee usernames
  const offerIds = [...new Set(payouts.map((p) => p.offer_id))].filter(Boolean);
  const sponseeIds = [...new Set(payouts.map((p) => p.sponsee_id))].filter(
    Boolean,
  );

  const [
    { data: offers = [] },
    { data: sponsees = [] },
    { data: wallets = [] },
  ] = await Promise.all([
    offerIds.length > 0
      ? supabase
          .from("private_offers")
          .select("id, offer_title")
          .in("id", offerIds)
      : { data: [] },
    sponseeIds.length > 0
      ? supabase
          .from("users_extended_data")
          .select("user_id, username")
          .in("user_id", sponseeIds)
      : { data: [] },
    sponseeIds.length > 0
      ? supabase
          .from("users_extended_data")
          .select("user_id, wallet")
          .in("user_id", sponseeIds)
      : { data: [] },
  ]);

  const offerMap = {};
  offers.forEach((o) => (offerMap[o.id] = o.offer_title));
  const sponseeMap = {};
  sponsees.forEach((u) => (sponseeMap[u.user_id] = u.username));
  const walletMap = {};
  wallets.forEach((u) => (walletMap[u.user_id] = Number(u.wallet) || 0));

  let html = `<table class="admin-table"><thead>
    <tr>
      <th>ID</th><th>Offer</th><th>Sponsee</th><th>Email</th><th>Amount</th>
      <th>Wallet</th>
      <th>Method</th><th>Reference</th><th>Status</th><th>Created</th><th>Paid</th>
      <th>Paid By</th><th>Notes</th><th>Actions</th>
    </tr></thead><tbody>`;

  for (const p of payouts) {
    // Only show wallet for sponsor withdrawals; otherwise blank (or use sponsee if you want)
    const walletVal = walletMap[p.sponsee_id] ?? 0;
    const isInsufficient =
      p.status === "pending" &&
      p.payout_user_role === "sponsor" &&
      Number(p.payout_amount) > walletVal;
    const walletCell = `<td>$${walletVal.toFixed(2)}</td>`;

    // Button disables if payout_amount > wallet for sponsor withdrawals and payout is pending
    const disableMarkPaid = isInsufficient;
    const markPaidBtn = `<button onclick="window.markPayoutPaid('${p.id}')"${disableMarkPaid ? " disabled title='Insufficient wallet'" : ""}>Record External Payment</button>`;

    // If insufficient funds, highlight row red
    const rowStyle = isInsufficient
      ? "background:#ff1e40!important;color:red;font-weight:bold;"
      : "";

    html += `<tr style="${rowStyle}">
    <td>${p.id}</td>
    <td>${esc(offerMap[p.offer_id] ?? "(Unknown Offer)")}</td>
    <td>${esc(sponseeMap[p.sponsee_id] ?? "(Unknown Sponsee)")}</td>
    <td>${esc(p.sponsee_email ?? "-")}</td>
    <td>$${p.payout_amount}</td>
    ${walletCell}
    <td>${esc(p.payout_method ?? "-")}</td>
    <td>${esc(p.payout_reference ?? "-")}</td>
    <td>${esc(p.status)}</td>
    <td>${formatDate(p.created_at)}</td>
    <td>${p.paid_at ? formatDate(p.paid_at) : "-"}</td>
    <td>${p.paid_by_admin_id ?? "-"}</td>
    <td>${esc(p.notes ?? "-")}</td>
    <td>
      ${
        p.status === "pending"
          ? `${markPaidBtn}
           <button onclick="showRejectModal('${p.id}')">Reject</button>`
          : ""
      }
    </td>
  </tr>`;
  }

  html += "</tbody></table>";

  document.getElementById("admin-payout-table").innerHTML = html;
}

async function exportPayoutCSV() {
  const { data: payouts, error } = await supabase
    .from("payouts")
    .select(
      "id, offer_id, sponsee_id, sponsee_email, payout_amount, payout_method, payout_reference, status, created_at, paid_at, notes, paid_by_admin_id",
    )
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error || !payouts) return alert("Could not export payouts.");

  // Fetch offer titles & sponsee usernames
  const offerIds = [...new Set(payouts.map((p) => p.offer_id))].filter(Boolean);
  const sponseeIds = [...new Set(payouts.map((p) => p.sponsee_id))].filter(
    Boolean,
  );

  const [{ data: offers = [] }, { data: sponsees = [] }] = await Promise.all([
    offerIds.length > 0
      ? supabase
          .from("private_offers")
          .select("id, offer_title")
          .in("id", offerIds)
      : { data: [] },
    sponseeIds.length > 0
      ? supabase
          .from("users_extended_data")
          .select("user_id, username")
          .in("user_id", sponseeIds)
      : { data: [] },
  ]);

  const offerMap = {};
  offers.forEach((o) => (offerMap[o.id] = o.offer_title));
  const sponseeMap = {};
  sponsees.forEach((u) => (sponseeMap[u.user_id] = u.username));

  const exportData = payouts.map((p) => ({
    ID: p.id,
    OfferTitle: offerMap[p.offer_id] ?? "(Unknown Offer)",
    Sponsee: sponseeMap[p.sponsee_id] ?? "(Unknown Sponsee)",
    SponseeEmail: p.sponsee_email ?? "-",
    Amount: p.payout_amount,
    Method: p.payout_method ?? "-",
    Reference: p.payout_reference ?? "-",
    Status: p.status,
    CreatedAt: p.created_at,
    PaidAt: p.paid_at,
    PaidBy: p.paid_by_admin_id ?? "-",
    Notes: p.notes ?? "-",
  }));

  exportToCSV("payouts.csv", exportData);
}

// Approve/Reject payout actions for admin
window.markPayoutPaid = async function (id) {
  if (!confirm("Record this payout as paid? Confirm the external payment has already succeeded. This action does not send money.")) return;
  const { data: payout, error } = await supabase.rpc("decide_admin_payout", {
    p_payout_id: id, p_decision: "paid", p_reason: null,
  });
  if (error) { alert("Payout was not recorded: " + error.message); return; }
  if (payout.already_processed) { loadPayoutLogs(); alert("This payout was already processed."); return; }

  loadPayoutLogs();
  alert("External payment recorded. No funds were sent by this action.");
};

window.confirmRejectPayout = async function (id, reason) {
  const { data: payout, error } = await supabase.rpc("decide_admin_payout", {
    p_payout_id: id, p_decision: "rejected", p_reason: reason,
  });
  if (error) { alert("Payout was not rejected: " + error.message); return; }
  if (payout.already_processed) { loadPayoutLogs(); return; }

  loadPayoutLogs();
};

// ========== Analytics/Charts ==========
async function loadCharts() {
  function makeChart(id, label, rows, color) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 29);
    cutoff.setHours(0, 0, 0, 0);
    const filtered = rows.filter(
      (row) => new Date(row.day) >= cutoff && new Date(row.day) <= new Date(),
    );
    const labels = filtered.map((row) => row.day),
      dataset = filtered.map((row) => Number(row.count));
    if (!window.Chart)
      throw new Error("Charts could not be loaded. Refresh this section.");
    const ctx = document.getElementById(id).getContext("2d");
    if (window[id + "Obj"]) window[id + "Obj"].destroy();
    window[id + "Obj"] = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [{ label, data: dataset, borderColor: color, tension: 0.35 }],
      },
      options: { responsive: true, plugins: { legend: { display: false } } },
    });
  }
  const { data: userStats, error: signupError } = await supabase.rpc(
    "signup_stats_by_day",
  );
  const { data: offerStats, error: offerError } =
    await supabase.rpc("offer_stats_by_day");
  const { data: reviewStats, error: reviewError } = await supabase.rpc(
    "review_stats_by_day",
  );
  if (signupError || offerError || reviewError)
    throw new Error("Chart data could not be loaded. Please refresh.");
  if (userStats) {
    makeChart("chart-users", "Signups", userStats, "#F6C62E");
  }
  if (offerStats) {
    makeChart("chart-offers", "Offers", offerStats, "#0cf");
  }
  if (reviewStats) {
    makeChart("chart-reviews", "Reviews", reviewStats, "#e86");
  }
}
// ======= ADVANCED ANALYTICS & WIDGETS =======
async function loadAdvancedAnalytics() {
  const root = document.getElementById("admin-advanced-analytics-section");
  root.innerHTML = "<p>Loading participation analytics…</p>";
  const [profilesResult, offersResult, reviewsResult] = await Promise.all([
    supabase
      .from("users_extended_data")
      .select("user_id, username")
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
      .from("private_offers")
      .select("id, sponsor_id, sponsee_id, status, created_at")
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
      .from("private_offer_reviews")
      .select("offer_id, reviewer_id")
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);
  if (profilesResult.error || offersResult.error || reviewsResult.error) {
    root.innerHTML =
      '<p class="admin-data-error" role="alert">Participation analytics could not be loaded.</p>';
    return;
  }
  const profiles = new Map(
    (profilesResult.data || []).map((user) => [user.user_id, user.username]),
  );
  const offers = offersResult.data || [];
  const offerIds = new Set(offers.map((offer) => offer.id));
  const reviews = (reviewsResult.data || []).filter((review) =>
    offerIds.has(review.offer_id),
  );
  const reviewed = new Set(reviews.map((review) => review.offer_id));
  const reviewers = new Map();
  reviews.forEach((review) => {
    if (!reviewers.has(review.offer_id))
      reviewers.set(review.offer_id, new Set());
    if (review.reviewer_id)
      reviewers.get(review.offer_id).add(review.reviewer_id);
  });
  const sponsors = new Map(),
    creators = new Map(),
    recent = new Set();
  const now = Date.now();
  const addParticipant = (map, id, completed) => {
    if (!id) return;
    const entry = map.get(id) || {
      username: profiles.get(id) || "Account not in loaded profiles",
      offers: 0,
      completed: 0,
    };
    entry.offers++;
    if (completed) entry.completed++;
    map.set(id, entry);
  };
  offers.forEach((offer) => {
    const completed = ["completed", "review_completed"].includes(offer.status);
    addParticipant(sponsors, offer.sponsor_id, completed);
    addParticipant(creators, offer.sponsee_id, completed);
    const age = now - new Date(offer.created_at).getTime();
    if (age >= 0 && age < 7 * 864e5)
      [offer.sponsor_id, offer.sponsee_id]
        .filter(Boolean)
        .forEach((id) => recent.add(id));
  });
  const cards = [
    ["Loaded sponsorships", offers.length],
    [
      "Completed sponsorships",
      offers.filter((offer) =>
        ["completed", "review_completed"].includes(offer.status),
      ).length,
    ],
    ["Participants · last 7 days", recent.size],
    ["Offers with a loaded review", reviewed.size],
    [
      "Offers with 2+ reviewers",
      [...reviewers.values()].filter((set) => set.size >= 2).length,
    ],
    ["Distinct sponsors", sponsors.size],
  ];
  const leaderboard = (entries, title) => {
    const sorted = [...entries.values()]
      .sort(
        (a, b) => b.offers - a.offers || a.username.localeCompare(b.username),
      )
      .slice(0, 10);
    return (
      '<div class="admin-overview-card"><h3>' +
      title +
      "</h3>" +
      (sorted.length
        ? '<ol class="admin-leaderboard">' +
          sorted
            .map(
              (user) =>
                "<li><span>" +
                esc(user.username) +
                "</span><strong>" +
                user.offers +
                " offers</strong><small>" +
                user.completed +
                " completed</small></li>",
            )
            .join("") +
          "</ol>"
        : '<p class="admin-empty-state">No participants in the loaded records.</p>') +
      "</div>"
    );
  };
  root.innerHTML =
    '<h2>Sponsorship participation</h2><p class="admin-section-copy">Based on up to 1,000 latest private offers, reviews and profiles. These are offer participants, not login activity. Counts describe loaded records; full platform totals are in Overview.</p>' +
    '<div class="admin-stats">' +
    cards
      .map(
        ([title, number]) =>
          '<div class="admin-stat-card"><span>' +
          title +
          "</span><strong>" +
          number.toLocaleString() +
          "</strong></div>",
      )
      .join("") +
    "</div>" +
    '<div class="admin-overview-grid">' +
    leaderboard(sponsors, "Top 10 sponsors") +
    leaderboard(creators, "Top 10 sponsees") +
    "</div>";
}

// FamBot !!
async function loadFamBotLogs() {
  // Fetch logs first
  const { data: logs, error } = await supabase
    .from("admin_activity_log")
    .select(
      "id, performed_by, target_id, action, target_type, message, created_at",
    )
    .eq("action", "auto-strike")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    document.getElementById("admin-fambot-table").innerHTML =
      `<span class="admin-data-error" role="alert">Could not load moderation logs.</span>`;
    return;
  }

  // Fetch user map
  const userIds = [
    ...new Set([
      ...logs.map((row) => row.performed_by).filter(Boolean),
      ...logs.map((row) => row.target_id).filter(Boolean),
    ]),
  ];

  const { data: users, error: userErr } = await supabase
    .from("users_extended_data")
    .select("user_id, username, email")
    .in("user_id", userIds);

  const userMap = {};
  if (users) {
    users.forEach((u) => {
      userMap[u.user_id] = u;
    });
  }

  famBotPagination.data = logs.map((row) => ({
    ...row,
    performed_by_username: userMap[row.performed_by]?.username ?? "-",
    target_email: userMap[row.target_id]?.email ?? "-",
  }));

  famBotPagination.page = 1;
  renderFamBotTable();
}

function renderFamBotTable() {
  const { page, pageSize, data } = famBotPagination;
  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  const startIdx = (page - 1) * pageSize;
  const pageData = data.slice(startIdx, startIdx + pageSize);

  const pageSizes = [5, 10, 20, 50, 100];
  const dropdown = `
    <div style="margin-bottom:8px;">
      <label for="fambot-page-size" style="font-weight:500;margin-right:6px;">Rows per page:</label>
      <select id="fambot-page-size" style="padding:2px 10px; border-radius:5px;">
        ${pageSizes.map((size) => `<option value="${size}"${size === pageSize ? " selected" : ""}>${size}</option>`).join("")}
      </select>
    </div>
  `;

  let html = `<div class="admin-table-scroll">`;
  html += `<table class="admin-table"><thead>
    <tr><th>ID</th><th>Performed By</th><th>Target Email</th><th>Action</th><th>Message</th><th>Created</th></tr>
  </thead><tbody>`;

  for (const row of pageData) {
    html += `<tr>
      <td>${row.id}</td>
      <td>${esc(row.performed_by_username)}</td>
      <td>${esc(row.target_email)}</td>
      <td>${esc(row.action)}</td>
      <td>${esc(row.message ?? "-")}</td>
      <td>${formatDate(row.created_at)}</td>
    </tr>`;
  }

  html += "</tbody></table></div>";

  let paginationHTML = "";
  if (totalPages > 1) {
    paginationHTML += `<div style="text-align:center;margin:13px 0 3px 0;">`;
    if (page > 1) {
      paginationHTML += `<button class="pagination-btn" onclick="window.changeFamBotPage(${page - 1})">Previous</button>`;
    }
    for (let i = 1; i <= totalPages; i++) {
      paginationHTML += `<button class="pagination-btn${i === page ? " active" : ""}" onclick="window.changeFamBotPage(${i})">${i}</button>`;
    }
    if (page < totalPages) {
      paginationHTML += `<button class="pagination-btn" onclick="window.changeFamBotPage(${page + 1})">Next</button>`;
    }
    paginationHTML += `</div>`;
  }

  document.getElementById("admin-fambot-table").innerHTML =
    dropdown + html + paginationHTML;

  document.getElementById("fambot-page-size").onchange = function () {
    famBotPagination.pageSize = parseInt(this.value, 10);
    famBotPagination.page = 1;
    renderFamBotTable();
  };
}

window.changeFamBotPage = (page) => {
  famBotPagination.page = page;
  renderFamBotTable();
};

async function loadIpModerationLogs() {
  const { data, error } = await supabase
    .from("ip_moderation_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    document.getElementById("admin-ip-table").innerHTML =
      `<span class="admin-data-error" role="alert">Could not load IP logs.</span>`;
    return;
  }
  ipModerationPagination.data = data || [];
  ipModerationPagination.page = 1;
  renderIpModerationTable();
}

function renderIpModerationTable() {
  const { page, pageSize, data } = ipModerationPagination;
  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  const startIdx = (page - 1) * pageSize;
  const endIdx = startIdx + pageSize;
  const pageData = data.slice(startIdx, endIdx);

  const pageSizes = [5, 10, 20, 50, 100];
  const dropdown = `
    <div style="margin-bottom:8px;">
      <label for="ip-page-size" style="font-weight:500;margin-right:6px;">Rows per page:</label>
      <select id="ip-page-size" style="padding:2px 10px; border-radius:5px;">
        ${pageSizes.map((size) => `<option value="${size}"${size === pageSize ? " selected" : ""}>${size}</option>`).join("")}
      </select>
    </div>
  `;

  let html = `<div class="admin-table-scroll">`;
  html += `<table class="admin-table"><thead>
    <tr><th>IP Address</th><th>Attempt Count</th><th>Blocked</th><th>Created</th></tr>
  </thead><tbody>`;

  for (const row of pageData) {
    html += `<tr>
      <td>${esc(row.ip)}</td>
      <td>${row.attempts}</td>
      <td>${row.blocked ? "🚫" : "✅"}</td>
      <td>${formatDate(row.created_at)}</td>
    </tr>`;
  }

  html += "</tbody></table></div>";

  let paginationHTML = "";
  if (totalPages > 1) {
    paginationHTML += `<div style="text-align:center;margin:13px 0 3px 0;">`;
    if (page > 1) {
      paginationHTML += `<button class="pagination-btn" onclick="window.changeIpPage(${page - 1})">Previous</button>`;
    }
    for (let i = 1; i <= totalPages; i++) {
      paginationHTML += `<button class="pagination-btn${i === page ? " active" : ""}" onclick="window.changeIpPage(${i})">${i}</button>`;
    }
    if (page < totalPages) {
      paginationHTML += `<button class="pagination-btn" onclick="window.changeIpPage(${page + 1})">Next</button>`;
    }
    paginationHTML += `</div>`;
  }

  document.getElementById("admin-ip-table").innerHTML =
    dropdown + html + paginationHTML;

  document.getElementById("ip-page-size").onchange = function () {
    ipModerationPagination.pageSize = parseInt(this.value, 10);
    ipModerationPagination.page = 1;
    renderIpModerationTable();
  };
}
window.changeIpPage = (page) => {
  ipModerationPagination.page = page;
  renderIpModerationTable();
};

// ========== Reported tables with pagination/scroll ==========
// ========== Reported tables with pagination/scroll ==========
async function loadReported(type) {
  const el = document.getElementById("reported-content");
  el.innerHTML = "Loading...";

  const request = ++reportRequest;
  const tables = {
    users: "reported_users",
    offers: "reported_offers",
    reviews: "reported_reviews",
    comments: "reported_comments",
  };
  if (!tables[type]) return;
  let query = supabase
    .from(tables[type])
    .select("*")
    .order("created_at", { ascending: false });
  const status = document.getElementById("admin-report-status").value;
  if (status) query = query.eq("status", status);
  let { data, error } = await query;
  if (request !== reportRequest) return;
  if (error) {
    el.innerHTML =
      '<p class="admin-data-error" role="alert">Could not load reports. Please refresh.</p>';
    return;
  }
  data = data || [];

  if (type === "users") {
    if (!error && data.length > 0) {
      const userIds = [
        ...new Set([
          ...data.map((row) => row.reported_user_id),
          ...data.map((row) => row.reporter_user_id),
        ]),
      ];

      const { data: users } = await supabase
        .from("users_extended_data")
        .select("user_id, username")
        .in("user_id", userIds);

      const userMap = {};
      if (users) {
        users.forEach((u) => {
          userMap[u.user_id] = u.username;
        });
      }

      data = data.map((row) => ({
        ...row,
        reported_username: userMap[row.reported_user_id] ?? "(Unknown)",
        reporter_username: userMap[row.reporter_user_id] ?? "(Unknown)",
      }));
    }
  } else if (type === "offers") {
    if (!error && data.length > 0) {
      const offerIds = [...new Set(data.map((row) => row.offer_id))];
      const { data: offers } = await supabase
        .from("private_offers")
        .select("id, offer_title")
        .in("id", offerIds);

      const offerMap = {};
      if (offers) {
        offers.forEach((o) => {
          offerMap[o.id] = o.offer_title;
        });
      }

      data = data.map((row) => ({
        ...row,
        offer_title: offerMap[row.offer_id] ?? "(Unknown Offer)",
      }));
    }
  } else if (type === "reviews") {
    if (!error && data.length > 0) {
      const reviewIds = [...new Set(data.map((row) => row.review_id))].filter(
        Boolean,
      );
      const reporterIds = [
        ...new Set(data.map((row) => row.reporter_user_id)),
      ].filter(Boolean);

      // First, fetch the actual reviews to get reviewer_id and offer_id
      const { data: reviews = [] } =
        reviewIds.length > 0
          ? await supabase
              .from("private_offer_reviews")
              .select("id, offer_id, reviewer_id")
              .in("id", reviewIds)
          : { data: [] };

      const offerIds = [...new Set(reviews.map((r) => r.offer_id))].filter(
        Boolean,
      );
      const reviewerIds = [
        ...new Set(reviews.map((r) => r.reviewer_id)),
      ].filter(Boolean);

      // Parallel fetch for usernames and offers
      const [
        { data: reviewers = [] },
        { data: reporters = [] },
        { data: offers = [] },
      ] = await Promise.all([
        reviewerIds.length > 0
          ? supabase
              .from("users_extended_data")
              .select("user_id, username")
              .in("user_id", reviewerIds)
          : { data: [] },
        reporterIds.length > 0
          ? supabase
              .from("users_extended_data")
              .select("user_id, username")
              .in("user_id", reporterIds)
          : { data: [] },
        offerIds.length > 0
          ? supabase
              .from("private_offers")
              .select("id, offer_title")
              .in("id", offerIds)
          : { data: [] },
      ]);

      const reviewerMap = {};
      reviewers.forEach((u) => {
        reviewerMap[u.user_id] = u.username;
      });
      const reporterMap = {};
      reporters.forEach((u) => {
        reporterMap[u.user_id] = u.username;
      });
      const offerMap = {};
      offers.forEach((o) => {
        offerMap[o.id] = o.offer_title;
      });

      const reviewMap = {};
      reviews.forEach((r) => {
        reviewMap[r.id] = r;
      });

      data = data.map((row) => {
        const linkedReview = reviewMap[row.review_id] || {};
        return {
          ...row,
          offer_title: offerMap[linkedReview.offer_id] ?? "(Unknown Offer)",
          reviewer_username:
            reviewerMap[linkedReview.reviewer_id] ?? "(Unknown Reviewer)",
          reporter_username:
            reporterMap[row.reporter_user_id] ?? "(Unknown Reporter)",
        };
      });
    }
  } else if (type === "comments") {
    if (!error && data.length > 0) {
      const commentIds = [...new Set(data.map((row) => row.comment_id))].filter(
        Boolean,
      );
      const reporterIds = [
        ...new Set(data.map((row) => row.reporter_id)),
      ].filter(Boolean);

      // Fetch private_offer_comments to get user_id and comment_text
      const { data: comments = [] } =
        commentIds.length > 0
          ? await supabase
              .from("private_offer_comments")
              .select("id, user_id, comment_text")
              .in("id", commentIds)
          : { data: [] };

      const commenterIds = [...new Set(comments.map((c) => c.user_id))].filter(
        Boolean,
      );

      // Fetch usernames for commenters & reporters
      const [{ data: users = [] }, { data: reporters = [] }] =
        await Promise.all([
          commenterIds.length > 0
            ? supabase
                .from("users_extended_data")
                .select("user_id, username")
                .in("user_id", commenterIds)
            : { data: [] },
          reporterIds.length > 0
            ? supabase
                .from("users_extended_data")
                .select("user_id, username")
                .in("user_id", reporterIds)
            : { data: [] },
        ]);

      const commenterMap = {};
      users.forEach((u) => {
        commenterMap[u.user_id] = u.username;
      });
      const reporterMap = {};
      reporters.forEach((u) => {
        reporterMap[u.user_id] = u.username;
      });

      const commentMap = {};
      comments.forEach((c) => {
        commentMap[c.id] = c;
      });

      data = data.map((row) => {
        const linkedComment = commentMap[row.comment_id] || {};
        return {
          ...row,
          comment_text: linkedComment.comment_text ?? "(Unknown Text)",
          commenter_username:
            commenterMap[linkedComment.user_id] ?? "(Unknown Commenter)",
          reporter_username:
            reporterMap[row.reporter_id] ?? "(Unknown Reporter)",
        };
      });
    }
  }

  if (request !== reportRequest) return;
  if (!data.length)
    return (el.innerHTML = `<p class="admin-empty-state">No matching reports in this queue.</p>`);

  reportedPagination[type].data = data;
  reportedPagination[type].page = 1;
  renderReportedTable(type);
}

function renderReportedTable(type) {
  const el = document.getElementById("reported-content");
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
        ${pageSizes.map((size) => `<option value="${size}"${size === pageSize ? " selected" : ""}>${size}</option>`).join("")}
      </select>
    </div>
  `;

  let tableHTML = `<div class="admin-table-scroll">`;

  if (type === "users") {
    tableHTML += `<table class="admin-table"><thead>
      <tr><th>ID</th><th>Reported User</th><th>Reporter</th><th>Reason</th><th>Status</th><th>Created</th><th>Actions</th></tr>
    </thead><tbody>`;
    for (const item of pageData) {
      tableHTML += `<tr>
        <td>${item.id}</td>
        <td>${esc(item.reported_username)}</td>
        <td>${esc(item.reporter_username)}</td>
        <td>${esc(item.reason)}</td>
        <td>${esc(item.status)}</td>
        <td>${formatDate(item.created_at)}</td>
        <td><button onclick="window.resolveReported('${type}','${item.id}')">Resolve</button></td>
      </tr>`;
    }
  } else if (type === "offers") {
    tableHTML += `<table class="admin-table"><thead>
      <tr><th>ID</th><th>Offer Title</th><th>Reason</th><th>Status</th><th>Created</th><th>Actions</th></tr>
    </thead><tbody>`;
    for (const item of pageData) {
      tableHTML += `<tr>
        <td>${item.id}</td>
        <td>${esc(item.offer_title)}</td>
        <td>${esc(item.reason)}</td>
        <td>${esc(item.status)}</td>
        <td>${formatDate(item.created_at)}</td>
        <td><button onclick="window.resolveReported('${type}','${item.id}')">Resolve</button></td>
      </tr>`;
    }
  } else if (type === "reviews") {
    tableHTML += `<table class="admin-table"><thead>
      <tr><th>ID</th><th>Offer Title</th><th>Reviewer</th><th>Reason</th><th>Status</th><th>Created</th><th>Actions</th></tr>
    </thead><tbody>`;
    for (const item of pageData) {
      tableHTML += `<tr>
        <td>${item.id}</td>
        <td>${esc(item.offer_title)}</td>
        <td>${esc(item.reviewer_username)}</td>
        <td>${esc(item.reason)}</td>
        <td>${esc(item.status)}</td>
        <td>${formatDate(item.created_at)}</td>
        <td><button onclick="window.resolveReported('${type}','${item.id}')">Resolve</button></td>
      </tr>`;
    }
  } else if (type === "comments") {
    tableHTML += `<table class="admin-table"><thead>
    <tr>
      <th>ID</th>
      <th>Reporter</th>
      <th>Reported User</th>
      <th>Reported Comment</th>
      <th>Reason</th>
      <th>Details</th>
      <th>Status</th>
      <th>Created</th>
      <th>Actions</th>
    </tr></thead><tbody>`;

    for (const item of pageData) {
      tableHTML += `<tr>
      <td>${item.id}</td>
      <td>${esc(item.reporter_username ?? "(Unknown Reporter)")}</td>
      <td>${esc(item.reported_username ?? "(Unknown User)")}</td>
      <td>${esc(item.reported_message ?? "(No Message)")}</td>
      <td>${esc(item.reason ?? "-")}</td>
      <td>${esc(item.details ?? "-")}</td>
      <td>${esc(item.status ?? "-")}</td>
      <td>${formatDate(item.created_at)}</td>
      <td><button onclick="window.resolveReported('${type}','${item.id}')">Resolve</button></td>
    </tr>`;
    }

    tableHTML += `</tbody></table></div>`;
  }

  tableHTML += `</tbody></table></div>`;

  let paginationHTML = "";
  if (totalPages > 1) {
    paginationHTML += `<div style="text-align:center;margin:13px 0 3px 0;">`;
    if (page > 1) {
      paginationHTML += `<button class="pagination-btn" onclick="window.changeReportedPage('${type}',${page - 1})">Previous</button>`;
    }
    for (let i = 1; i <= totalPages; i++) {
      paginationHTML += `<button class="pagination-btn${i === page ? " active" : ""}" onclick="window.changeReportedPage('${type}',${i})" ${i === page ? "disabled" : ""}>${i}</button>`;
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
  const tables = {
    users: "reported_users",
    offers: "reported_offers",
    reviews: "reported_reviews",
    comments: "reported_comments",
  };
  if (
    !tables[type] ||
    !confirm("Mark this report as resolved? Its record will be retained.")
  )
    return;
  const { data, error } = await supabase
    .from(tables[type])
    .update({ status: "resolved" })
    .eq("id", id)
    .select("id");
  if (error || data?.length !== 1)
    return alert("The report could not be resolved. Refresh and try again.");
  const { error: logError } = await supabase.from("admin_activity_log").insert({
    action: "Resolve Report",
    performed_by: window.adminUserId,
    target_id: id,
    target_type: type,
  });
  if (logError) alert("Report resolved, but the audit log could not be saved.");
  await Promise.all([loadReported(type), loadAdminStats()]).catch(() => {});
};

async function loadPrivacyRequests() {
  const { data, error } = await supabase
    .from("user_privacy_requests")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    document.getElementById("admin-privacy-table").innerHTML =
      `<span class="admin-data-error" role="alert">Could not load privacy requests.</span>`;
    return;
  }
  privacyPagination.data = data || [];
  privacyPagination.page = 1;

  // === FETCH USERNAMES FOR DISPLAY ===
  const userIds = [
    ...new Set((data || []).map((req) => req.user_id).filter(Boolean)),
  ];
  let userMap = {};
  if (userIds.length) {
    const { data: users } = await supabase
      .from("users_extended_data")
      .select("user_id, username")
      .in("user_id", userIds);
    if (users)
      users.forEach((u) => {
        userMap[u.user_id] = u.username;
      });
  }
  privacyPagination.userMap = userMap;

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
        ${pageSizes.map((size) => `<option value="${size}"${size === pageSize ? " selected" : ""}>${size}</option>`).join("")}
      </select>
    </div>
  `;

  let html = `<div class="admin-table-scroll">`;
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
      <td>${req.id ? req.id.toString().substring(0, 8) : "-"}</td>
      <td>${esc(privacyPagination.userMap?.[req.user_id] || req.user_id || "-")}</td>
      <td>${esc(req.email || "-")}</td>
      <td>${esc(req.type ? req.type.toUpperCase() : "-")}</td>
      <td>${esc(req.status || "-")}</td>
      <td>${req.created_at ? formatDate(req.created_at) : "-"}</td>
      <td>${
        req.result_url
          ? `<a href="${esc(safeResultUrl(req.result_url))}" download>Download</a>`
          : "-"
      }</td>
      <td>
        <button onclick="window.exportAllUserData('${req.user_id}')">Export available records</button>
        <button type="button" disabled title="Account deletion needs a verified server workflow to remove all records safely.">Account deletion unavailable</button>
        ${req.status === "pending" ? `<button onclick="window.resolvePrivacyRequest('${req.id}')">Mark Complete</button>` : ""}
        <button onclick="window.deletePrivacyRequest('${req.id}')">Remove Request</button>
      </td>
    </tr>`;
  }
  html += "</tbody></table></div>";

  let paginationHTML = "";
  if (totalPages > 1) {
    paginationHTML += `<div style="text-align:center;margin:13px 0 3px 0;">`;
    if (page > 1) {
      paginationHTML += `<button class="pagination-btn" onclick="window.changePrivacyPage(${page - 1})">Previous</button>`;
    }
    for (let i = 1; i <= totalPages; i++) {
      if (i === page || totalPages <= 5 || (i >= page - 2 && i <= page + 2)) {
        paginationHTML += `<button class="pagination-btn${i === page ? " active" : ""}" onclick="window.changePrivacyPage(${i})" ${i === page ? "disabled" : ""}>${i}</button>`;
      } else if (
        (i === page - 3 && i > 1) ||
        (i === page + 3 && i < totalPages)
      ) {
        paginationHTML += "...";
      }
    }
    if (page < totalPages) {
      paginationHTML += `<button class="pagination-btn" onclick="window.changePrivacyPage(${page + 1})">Next</button>`;
    }
    paginationHTML += `</div>`;
  }
  document.getElementById("admin-privacy-table").innerHTML =
    dropdown + html + paginationHTML;

  document.getElementById("privacy-page-size").onchange = function () {
    privacyPagination.pageSize = parseInt(this.value, 10);
    privacyPagination.page = 1;
    renderPrivacyTable();
  };
}

// =========== GDPR/CCPA Export/Delete Actions ===========

// Export all user data as JSON (GDPR/CCPA)
window.exportAllUserData = async function (user_id) {
  if (
    !confirm(
      "Export available profile, sponsorship, comment, review and payout records? This is not a complete account export.",
    )
  )
    return;

  // Fetch user email for logging
  const { data: userData } = await supabase
    .from("users_extended_data")
    .select("email")
    .eq("user_id", user_id)
    .single();
  const userEmail = userData ? userData.email : "";

  const tables = [
    { name: "users_extended_data", key: "user_id" },
    { name: "private_offers", key: "sponsor_id" },
    { name: "private_offers", key: "sponsee_id" },
    { name: "private_offer_comments", key: "user_id" },
    { name: "private_offer_reviews", key: "reviewer_id" },
    { name: "payouts", key: "sponsee_id" },
    // Add other tables if needed
  ];

  let allData = {};
  for (const table of tables) {
    const { data, error } = await supabase
      .from(table.name)
      .select("*")
      .eq(table.key, user_id);
    if (error)
      return alert("Could not load export records. No export was downloaded.");
    if (data && data.length)
      allData[table.name + ":" + table.key] = data.map((row) =>
        Object.fromEntries(
          Object.entries(row).filter(
            ([key]) => !/token|secret|password|twofa_code|2fa_code/i.test(key),
          ),
        ),
      );
  }

  const fileName = `user_export_${user_id}_${Date.now()}.json`;
  const blob = new Blob([JSON.stringify(allData, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  // Log admin action
  await supabase.from("admin_activity_log").insert({
    action: "Export User Data",
    performed_by: window.adminUserId,
    target_id: user_id,
    target_type: "user",
    message: `Exported available records for user: ${user_id} (${userEmail})`,
    created_at: new Date().toISOString(),
  });

  alert(
    "Available records exported. Other services and tables are not included.",
  );
};

// Account deletion is intentionally unavailable until a complete server workflow exists.
window.deleteAllUserData = () =>
  alert(
    "Account deletion requires a verified server workflow. No data was deleted.",
  );

window.changePrivacyPage = (page) => {
  privacyPagination.page = page;
  renderPrivacyTable();
};

window.resolvePrivacyRequest = async (id) => {
  // Mark as complete (and set a result_url if you want)
  if (!confirm("Mark this request as completed?")) return;
  await supabase
    .from("user_privacy_requests")
    .update({ status: "completed" })
    .eq("id", id);
  loadPrivacyRequests();
};
window.deletePrivacyRequest = async (id) => {
  if (!confirm("Delete this privacy request?")) return;
  await supabase.from("user_privacy_requests").delete().eq("id", id);
  loadPrivacyRequests();
};

window.showRejectModal = showRejectModal;
window.closeRejectModal = closeRejectModal;
