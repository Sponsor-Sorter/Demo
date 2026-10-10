// Presentation and navigation only. Called after adminLogic verifies access.
export const adminViews = {
  overview: [
    "Overview",
    "A clear view of your platform and the work that needs attention.",
  ],
  users: ["Users", "Find accounts, review profiles and manage access."],
  offers: [
    "Sponsorships",
    "Track offers, delivery progress and campaign details.",
  ],
  reviews: ["Reviews", "Review feedback and keep the marketplace trustworthy."],
  reported: [
    "Reports",
    "Investigate flagged users, sponsorships, reviews and comments.",
  ],
  moderation: [
    "Moderation",
    "Review automated moderation decisions and account checks.",
  ],
  privacy: [
    "Privacy requests",
    "Review data export and account deletion requests carefully.",
  ],
  payouts: [
    "Payouts",
    "Review the latest 100 payout requests and their transaction records.",
  ],
  affiliates: [
    "Affiliates",
    "Manage partner applications, referral links and conversions.",
  ],
  notify: [
    "Notifications",
    "Send in-app updates to an individual account or all users.",
  ],
  log: [
    "Activity log",
    "Trace administrative actions using account, action and date filters.",
  ],
  analytics: [
    "Analytics",
    "Explore sponsorship activity, participation and review coverage.",
  ],
};

export function initAdminWorkspace(loaders) {
  let current = "overview";
  let revision = 0;
  const loaded = new Set();
  const pending = new Map();
  const updated = new Map();
  const status = document.getElementById("admin-load-status");
  const refresh = document.getElementById("admin-refresh");

  // Legacy renderers replace table HTML; keep each new table accessible.
  const decorateTables = () => {
    document.querySelectorAll(".admin-table").forEach((table) => {
      const name =
        table.closest(".admin-section")?.querySelector("h2,h3")?.textContent ||
        "Admin records";
      if (!table.querySelector("caption")) {
        const caption = table.createCaption();
        caption.textContent = name;
        caption.className = "admin-sr-only";
      }
      const scroll =
        table.closest(".admin-table-scroll") ||
        table.closest(".table-responsive");
      if (scroll) {
        scroll.tabIndex = 0;
        scroll.setAttribute("role", "region");
        scroll.setAttribute(
          "aria-label",
          `${name} table. Scroll horizontally for more columns.`,
        );
      }
      table
        .querySelectorAll('input[type="checkbox"]:not([aria-label])')
        .forEach((box, index) => {
          box.setAttribute(
            "aria-label",
            box.id.startsWith("select-all")
              ? "Select all rows on this page"
              : `Select row ${index + 1}`,
          );
        });
      const body = table.tBodies[0];
      if (body && !body.rows.length) {
        const cell = body.insertRow().insertCell();
        cell.colSpan = table.querySelectorAll("thead th").length || 1;
        cell.className = "admin-empty-state";
        cell.textContent = "No matching records. Try adjusting your filters.";
      }
    });
  };
  new MutationObserver(decorateTables).observe(
    document.getElementById("admin-section-content"),
    { childList: true, subtree: true },
  );

  async function open(view, { force = false, focus = false } = {}) {
    if (!adminViews[view]) view = "overview";
    current = view;
    const ticket = ++revision;
    const [title, description] = adminViews[view];
    document.title = `${title} · Admin | Sponsor Sorter`;
    document.getElementById("admin-view-title").textContent = title;
    document.getElementById("admin-view-description").textContent = description;
    document.getElementById("admin-breadcrumb").textContent =
      title.toUpperCase();
    document.querySelectorAll("[data-admin-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.adminPanel !== view;
    });
    document.querySelectorAll(".admin-nav-item").forEach((button) => {
      if (button.dataset.adminView === view)
        button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    if (location.hash !== `#${view}`)
      history.replaceState(null, "", `#${view}`);
    if (focus)
      document.getElementById("admin-main").focus({ preventScroll: true });
    status.dataset.error = "false";
    document.getElementById("admin-last-updated").textContent =
      updated.get(view) || "";
    status.textContent =
      loaded.has(view) && !force ? "Section ready" : "Loading section…";
    if (loaded.has(view) && !force) {
      refresh.disabled = false;
      return;
    }
    refresh.disabled = true;
    const panels = [
      ...document.querySelectorAll(`[data-admin-panel="${view}"]`),
    ];
    panels.forEach((panel) => panel.setAttribute("aria-busy", "true"));
    try {
      if (!pending.has(view)) {
        pending.set(
          view,
          Promise.resolve()
            .then(() => loaders[view]?.())
            .finally(() => pending.delete(view)),
        );
      }
      await pending.get(view);
      if (panels.some((panel) => panel.querySelector(".admin-data-error"))) {
        throw new Error(
          "Some data could not be loaded. Refresh this section to try again.",
        );
      }
      loaded.add(view);
      updated.set(
        view,
        `Updated ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
      );
      if (ticket === revision) {
        status.textContent = "Section ready";
        document.getElementById("admin-last-updated").textContent =
          updated.get(view);
      }
    } catch (error) {
      loaded.delete(view);
      if (ticket === revision) {
        status.textContent =
          error.message || "Could not load this section. Please try again.";
        status.dataset.error = "true";
      }
    } finally {
      panels.forEach((panel) => panel.removeAttribute("aria-busy"));
      if (ticket === revision) refresh.disabled = false;
    }
  }

  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-admin-view]");
    if (target) open(target.dataset.adminView, { focus: true });
  });
  refresh.addEventListener("click", () => open(current, { force: true }));
  window.addEventListener("hashchange", () => {
    const view = location.hash.slice(1);
    if (adminViews[view]) open(view);
  });
  document
    .getElementById("admin-section-search")
    .addEventListener("input", (event) => {
      const query = event.target.value.trim().toLowerCase();
      let matches = 0;
      document.querySelectorAll(".admin-nav-group").forEach((group) => {
        group.querySelectorAll(".admin-nav-item").forEach((button) => {
          button.hidden = !button.textContent.toLowerCase().includes(query);
          if (!button.hidden) matches++;
        });
        group.hidden = ![...group.querySelectorAll(".admin-nav-item")].some(
          (button) => !button.hidden,
        );
      });
      document.getElementById("admin-section-no-results").hidden =
        matches !== 0;
    });
  return { open, start: () => open(location.hash.slice(1) || "overview") };
}
