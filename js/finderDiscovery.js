// Discovery uses the public directory only. Shortlists stay on this device.
export function cleanFinderFilters(values = {}) {
  const text = (key) =>
    String(values[key] || "")
      .trim()
      .slice(0, 100);
  const platforms = [
    "youtube",
    "instagram",
    "twitch",
    "tiktok",
    "twitter",
    "facebook",
    "snapchat",
  ];
  return {
    name: text("name"),
    contenttype: text("contenttype"),
    location: text("location"),
    platform: platforms.includes(values.platform) ? values.platform : "",
    sort: values.sort === "za" ? "za" : "az",
  };
}
export function finderMatchReasons(filters) {
  return [
    filters.contenttype && "Content: " + filters.contenttype,
    filters.location && "Location: " + filters.location,
    filters.platform && "Linked platform: " + filters.platform,
  ].filter(Boolean);
}
export function buildFinderQuery(
  client,
  type,
  filters,
  page,
  shortlist = null,
) {
  let query = client
    .from("public_user_directory")
    .select(
      "user_id, username, location, profile_pic, contenttype, social_handles, planType",
      { count: "exact" },
    )
    .eq("userType", type);
  for (const [key, column] of [
    ["name", "username"],
    ["contenttype", "contenttype"],
    ["location", "location"],
  ]) {
    if (filters[key])
      query = query.ilike(
        column,
        "%" +
          filters[key]
            .replaceAll(String.fromCharCode(92), String.fromCharCode(92, 92))
            .replace(
              /[%_]/g,
              (character) => String.fromCharCode(92) + character,
            ) +
          "%",
      );
  }
  if (filters.platform)
    query = query
      .filter("social_handles->>" + filters.platform, "not.is", null)
      .filter("social_handles->>" + filters.platform, "neq", "");
  if (shortlist) query = query.in("user_id", shortlist);
  return query
    .order("username", { ascending: filters.sort !== "za", nullsFirst: false })
    .order("user_id", { ascending: true })
    .range((page - 1) * 12, page * 12 - 1);
}
export function mountFinderDiscovery({
  client,
  accountId,
  isSponsor,
  fetchFollowerMap,
  safePublicUrl,
}) {
  const form = document.getElementById("searchForm");
  const results = document.getElementById("searchResults");
  const previous = document.getElementById("prevPage"),
    next = document.getElementById("nextPage"),
    pageLabel = document.getElementById("currentPage");
  const status = document.createElement("p");
  status.className = "finder-result-status";
  status.setAttribute("role", "status");
  form.after(status);
  const options = document.createElement("div");
  options.className = "finder-discovery-options";
  options.innerHTML =
    '<label class="workspace-filter" for="finder-sort"><span>Order profiles</span><select id="finder-sort"><option value="az">Name A–Z</option><option value="za">Name Z–A</option></select></label><label class="finder-shortlist-filter"><input type="checkbox" id="finder-shortlist-only"> My shortlist <span id="finder-shortlist-count"></span></label><p>Save profiles to compare later. Your shortlist is kept in this browser for this account.</p>';
  status.before(options);
  const sort = options.querySelector("select"),
    shortlistOnly = options.querySelector("input"),
    countLabel = options.querySelector("span#finder-shortlist-count");
  const key = "ss:finder-shortlist:" + accountId;
  let saved = new Set();
  try {
    const stored = JSON.parse(localStorage.getItem(key) || "[]");
    if (Array.isArray(stored))
      saved = new Set(
        stored
          .filter(
            (id) => typeof id === "string" && /^[a-zA-Z0-9-]{1,64}$/.test(id),
          )
          .slice(0, 50),
      );
  } catch {}
  const updateCount = () => {
    countLabel.textContent = "(" + saved.size + ")";
  };
  updateCount();
  let page = 1,
    version = 0;
  const field = (key) => document.getElementById("search-" + key);
  const filters = () =>
    cleanFinderFilters({
      name: field("name").value,
      contenttype: field("contenttype").value,
      location: field("location").value,
      platform: field("platform").value,
      sort: sort.value,
    });
  function renderCard(user, followers, activeFilters) {
    const card = document.createElement("article");
    card.className = "user-profile finder-discovery-card";
    const image = document.createElement("img");
    image.className = "profile-pic";
    image.alt = (user.username || "Account") + " profile";
    image.loading = "lazy";
    const source = safePublicUrl("logos", user.profile_pic);
    try {
      const url = new URL(source || "./logos.png", location.href);
      image.src = ["http:", "https:"].includes(url.protocol)
        ? url.href
        : "./logos.png";
    } catch {
      image.src = "./logos.png";
    }
    image.addEventListener(
      "error",
      () => {
        image.src = "./logos.png";
      },
      { once: true },
    );
    const content = document.createElement("div");
    content.className = "user-profile-content";
    const heading = document.createElement("h4");
    heading.textContent = user.username || "Unnamed account";
    const plan = document.createElement("span");
    plan.className = "finder-plan";
    plan.textContent =
      String(user.planType || "free").toLowerCase() === "pro"
        ? "Pro plan"
        : "Free plan";
    const meta = document.createElement("p");
    meta.textContent = [
      user.contenttype || "Content type not provided",
      user.location || "Location not provided",
    ].join(" · ");
    const platforms = document.createElement("p");
    let handles = user.social_handles;
    try {
      if (typeof handles === "string") handles = JSON.parse(handles);
    } catch {
      handles = {};
    }
    const linked = Object.entries(handles || {})
      .filter(
        ([name, handle]) =>
          handle &&
          [
            "youtube",
            "instagram",
            "twitch",
            "tiktok",
            "twitter",
            "facebook",
            "snapchat",
          ].includes(name.toLowerCase()),
      )
      .map(([name]) => name);
    platforms.textContent = linked.length
      ? "Linked: " + linked.join(" · ")
      : "No linked platforms listed";
    const audience = document.createElement("p");
    const total = Number(followers);
    audience.className = "finder-audience";
    audience.textContent =
      Number.isFinite(total) && total > 0
        ? Math.round(total).toLocaleString() +
          " combined followers · may overlap across platforms"
        : "Audience data unavailable";
    const reasons = document.createElement("p");
    reasons.className = "finder-match-reasons";
    reasons.textContent = finderMatchReasons(activeFilters).join(" · ");
    const actions = document.createElement("div");
    actions.className = "finder-card-actions";
    const view = document.createElement("a");
    view.className = "finder-profile-link";
    view.textContent = "View profile";
    view.href =
      (isSponsor ? "viewprofile.html" : "viewprofiles.html") +
      "?username=" +
      encodeURIComponent(user.username || "");
    actions.append(view);
    if (isSponsor) {
      const offer = document.createElement("a");
      offer.className = "finder-offer-link";
      offer.textContent = "Make an offer";
      offer.href =
        "newoffer.html?username=" + encodeURIComponent(user.username || "");
      actions.append(offer);
    }
    const save = document.createElement("button");
    save.type = "button";
    const updateSave = () => {
      save.textContent = saved.has(user.user_id)
        ? "Saved to shortlist"
        : "Save to shortlist";
      save.setAttribute("aria-pressed", String(saved.has(user.user_id)));
    };
    updateSave();
    save.addEventListener("click", () => {
      if (!saved.has(user.user_id) && saved.size >= 50) {
        status.textContent =
          "Your shortlist holds up to 50 profiles. Remove one before adding another.";
        return;
      }
      saved.has(user.user_id)
        ? saved.delete(user.user_id)
        : saved.add(user.user_id);
      try {
        localStorage.setItem(key, JSON.stringify([...saved]));
      } catch {
        status.textContent =
          "Browser storage is unavailable. Shortlist changes last for this page visit only.";
      }
      updateCount();
      updateSave();
      if (shortlistOnly.checked) {
        page = 1;
        load();
      }
    });
    actions.append(save);
    content.append(heading, plan, meta, platforms, audience, reasons, actions);
    card.append(image, content);
    return card;
  }
  async function load() {
    const request = ++version,
      active = filters();
    status.textContent = "Finding partnerships…";
    results.setAttribute("aria-busy", "true");
    previous.disabled = true;
    next.disabled = true;
    try {
      const response =
        shortlistOnly.checked && !saved.size
          ? { data: [], count: 0, error: null }
          : await buildFinderQuery(
              client,
              isSponsor ? "besponsored" : "sponsor",
              active,
              page,
              shortlistOnly.checked ? [...saved] : null,
            );
      if (request !== version) return;
      if (response.error) throw response.error;
      const rows = response.data || [],
        total = Number.isFinite(response.count) ? response.count : null;
      const followers = await fetchFollowerMap(
        rows.map((row) => row.user_id).filter(Boolean),
      );
      if (request !== version) return;
      results.replaceChildren();
      for (const user of rows)
        results.append(renderCard(user, followers[user.user_id], active));
      if (!rows.length) {
        const empty = document.createElement("div");
        empty.className = "finder-empty";
        empty.textContent = shortlistOnly.checked
          ? "No saved profiles match these filters. Clear filters or browse all profiles to add to your shortlist."
          : "No profiles match yet. Try a broader content type, location or platform.";
        results.append(empty);
      }
      const pages = total === null ? null : Math.max(1, Math.ceil(total / 12));
      status.textContent =
        total === null
          ? rows.length + " profiles on this page"
          : total +
            " matching " +
            (isSponsor ? "creator" : "sponsor") +
            (total === 1 ? "" : "s") +
            (shortlistOnly.checked ? " in your shortlist" : "");
      pageLabel.textContent =
        "Page " + page + (pages === null ? "" : " of " + pages);
      previous.disabled = page === 1;
      next.disabled = total === null ? rows.length < 12 : page * 12 >= total;
    } catch {
      if (request !== version) return;
      results.replaceChildren();
      status.textContent =
        "Profiles could not be loaded. Please try Search again.";
    } finally {
      if (request === version) results.setAttribute("aria-busy", "false");
    }
  }
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    page = 1;
    load();
  });
  sort.addEventListener("change", () => {
    page = 1;
    load();
  });
  shortlistOnly.addEventListener("change", () => {
    page = 1;
    load();
  });
  form.addEventListener("reset", () => {
    sort.value = "az";
    shortlistOnly.checked = false;
  });
  previous.addEventListener("click", () => {
    if (page > 1) {
      page--;
      load();
    }
  });
  next.addEventListener("click", () => {
    page++;
    load();
  });
  load();
}

export function escapeFinderText(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ],
  );
}
