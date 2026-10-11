// Presentation only: retain existing nodes, IDs, permissions and business handlers.
const dashboard = document.querySelector(".dashboard");
const finder = document.querySelector("fieldset.finder");
const root = dashboard || finder;
if (root) {
  document.body.classList.add("workspace-refresh");
  const sponsor = location.pathname.toLowerCase().includes("dashboardsponsor.");
  const intro = document.createElement("section");
  intro.className = "workspace-intro";
  const eyebrow = document.createElement("p");
  eyebrow.className = "workspace-eyebrow";
  eyebrow.textContent = finder
    ? "DISCOVER · CONNECT · COLLABORATE"
    : sponsor
      ? "SPONSOR WORKSPACE"
      : "CREATOR WORKSPACE";
  const title = document.createElement("h1");
  title.textContent = finder
    ? "Find your next partnership"
    : sponsor
      ? "Your sponsorships, in one place"
      : "Your creator business, in one place";
  const copy = document.createElement("p");
  copy.textContent = finder
    ? "Explore creators, open opportunities and groups. Choose a search below to find the right fit."
    : sponsor
      ? "Manage offers, review applicants and follow campaign performance."
      : "Track offers, manage collaborations and keep your connected platforms up to date.";
  const actions = document.createElement("div");
  actions.className = "workspace-actions";
  for (const [label, href] of finder
    ? [["How partnerships work", "./help.html"]]
    : [
        ["Find partnerships", "./finder.html"],
        ["Help & support", "./help.html"],
      ]) {
    const link = document.createElement("a");
    link.textContent = label;
    link.href = href;
    actions.append(link);
  }
  intro.append(eyebrow, title, copy, actions);
  root.before(intro);

  // Make long dashboards directly navigable, including role-specific sections.
  if (dashboard) {
    const nav = document.createElement("nav");
    nav.className = "workspace-sections";
    nav.setAttribute("aria-label", "Dashboard sections");
    const sections = [
      [
        "Profile",
        dashboard.querySelector(".profile-main-fieldset") ||
          dashboard.querySelector("fieldset"),
      ],
      [
        "Overview",
        dashboard.querySelector(".dashboard-cards")?.closest("fieldset"),
      ],
      [
        "Active offers",
        dashboard.querySelector("#listing-container")?.closest("fieldset"),
      ],
      [
        "Public offers",
        dashboard
          .querySelector(
            "#sponsor-offer-status-filter, #public-offer-status-filter",
          )
          ?.closest("fieldset"),
      ],
      ["Community", dashboard.querySelector("#friends-and-groups")],
      ["History", dashboard.querySelector(".Archived-deals")],
      ["Connected platforms", dashboard.querySelector(".oauth-platforms")],
      [
        "Analytics",
        dashboard.querySelector(".graph-section")?.closest("fieldset"),
      ],
    ];
    for (const [label, section] of sections) {
      if (!section) continue;
      if (!section.id)
        section.id = `workspace-${label.toLowerCase().replaceAll(" ", "-")}`;
      const link = document.createElement("a");
      link.href = `#${section.id}`;
      link.textContent = label;
      link.addEventListener("click", (event) => {
        event.preventDefault();
        section.scrollIntoView({ block: "start", behavior: "instant" });
        section.tabIndex = -1;
        section.focus({ preventScroll: true });
      });
      nav.append(link);
    }
    intro.after(nav);

    const gettingStarted = document.createElement('details');
    gettingStarted.className = 'workspace-start';
    const startHeading = document.createElement('summary');
    startHeading.textContent = 'Getting started · your next steps';
    const startCopy = document.createElement('p');
    startCopy.textContent = 'Start with your profile, then find a partner and work through the agreed brief. You can return to this guide at any time.';
    const startList = document.createElement('ol');
    const startSteps = sponsor ? [
      ['Introduce your brand', 'Add a logo, website and clear description in Settings so creators know who they will work with.', '#workspace-profile'],
      ['Find the right creator', 'Browse Finder, compare audiences and agree a realistic brief, platforms, budget and deadline.', './finder.html'],
      ['Review before publication', 'Use offer Comments to play private video drafts and approve the latest version or request specific changes.', '#workspace-active-offers'],
      ['Follow the results', 'Check published content links and available performance statistics. Payment and completion are separate steps.', '#workspace-history']
    ] : [
      ['Make your profile useful', 'Add a photo, description and content categories in Settings. Explain your audience and what you can offer brands.', '#workspace-profile'],
      ['Connect your platforms', 'Open Settings → Linked Accounts to connect supported platforms. Available metrics depend on permissions and the platform.', '#workspace-profile'],
      ['Find a suitable opportunity', 'Explore Finder and check deliverables, deadlines and payment terms before accepting an offer.', './finder.html'],
      ['Get your draft approved', 'Upload a private video through offer Comments. After approval, publish on the agreed platforms and submit the content links.', '#workspace-active-offers']
    ];
    for (const [heading, description, href] of startSteps) {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = href;
      link.textContent = heading;
      const detail = document.createElement('p');
      detail.textContent = description;
      item.append(link, detail);
      startList.append(item);
    }
    const tour = document.createElement('button');
    tour.type = 'button';
    tour.textContent = 'Take the dashboard tour';
    tour.addEventListener('click', () => window.restartOnboarding?.());
    gettingStarted.append(startHeading, startCopy, startList, tour);
    nav.after(gettingStarted);
    // Put work before the long profile/community sections; move, never clone.
    const profile =
      dashboard.querySelector(".top-profile-activity-layout") ||
      dashboard.querySelector("fieldset");
    if (profile) {
      for (const section of [
        dashboard.querySelector(".dashboard-cards")?.closest("fieldset"),
        dashboard.querySelector("#listing-container")?.closest("fieldset"),
        dashboard
          .querySelector(
            "#sponsor-offer-status-filter, #public-offer-status-filter",
          )
          ?.closest("fieldset"),
      ]) {
        if (section && section !== profile) profile.before(section);
      }
    }
  }

  // Keep guidance available without making it dominate every section.
  for (const help of root.querySelectorAll(".help-block")) {
    const details = document.createElement("details");
    details.className = "workspace-guidance";
    const summary = document.createElement("summary");
    summary.textContent = "How this section works";
    help.before(details);
    details.append(summary, help);
  }
  // Wide data tables scroll locally, never crop actions or widen the page.
  for (const table of root.querySelectorAll("table")) {
    const scroll = document.createElement("div");
    scroll.className = "workspace-table-scroll";
    scroll.tabIndex = 0;
    scroll.setAttribute("role", "region");
    scroll.setAttribute(
      "aria-label",
      `${table.closest("fieldset")?.querySelector("h2, legend")?.textContent.trim() || "Campaign"} table; scroll horizontally for more columns`,
    );
    table.before(scroll);
    scroll.append(table);
  }
}

if (finder) {
  const minimum = document.getElementById("offer-search-minamount");
  const maximum = document.getElementById("offer-search-maxamount");
  const validateRange = () => {
    if (!minimum || !maximum) return;
    maximum.setCustomValidity(
      minimum.value !== "" &&
        maximum.value !== "" &&
        Number(maximum.value) < Number(minimum.value)
        ? "Maximum amount must be at least the minimum amount."
        : "",
    );
  };
  minimum?.addEventListener("input", validateRange);
  maximum?.addEventListener("input", validateRange);
  const labels = {
    "search-name": "Name or username",
    "search-contenttype": "Content type",
    "search-location": "Location",
    "search-platform": "Platform",
    "offer-search-title": "Offer title",
    "offer-search-sponsor": "Sponsor username",
    "offer-search-platform": "Platform",
    "offer-search-minamount": "Minimum amount ($)",
    "offer-search-maxamount": "Maximum amount ($)",
    "group-search-input": "Group name or description",
  };
  for (const [id, text] of Object.entries(labels)) {
    const input = document.getElementById(id);
    if (!input) continue;
    const label = document.createElement("label");
    label.className = "workspace-filter";
    label.htmlFor = id;
    const caption = document.createElement("span");
    caption.textContent = text;
    input.before(label);
    label.append(caption, input);
  }
  for (const form of finder.querySelectorAll("form")) {
    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "workspace-reset";
    reset.textContent = "Clear filters";
    reset.addEventListener("click", () => {
      form.reset();
      validateRange();
      form.requestSubmit();
    });
    form.append(reset);
  }
  for (const id of ["searchResults", "offers-error", "group-results"]) {
    document.getElementById(id)?.setAttribute("aria-live", "polite");
  }
  const toggles = [
    ...finder.querySelectorAll(
      ".search-toggle-row > button:not(#create-public-offer-btn)",
    ),
  ];
  const sync = () =>
    toggles.forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.classList.contains("active-toggle")),
      ),
    );
  for (const button of toggles)
    new MutationObserver(sync).observe(button, {
      attributes: true,
      attributeFilter: ["class"],
    });
  sync();
}
