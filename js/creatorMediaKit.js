import { publicProfileUrl } from "./publicProfileSharing.js";
const allowedPlatforms = [
  "youtube",
  "instagram",
  "tiktok",
  "twitch",
  "facebook",
  "twitter",
  "snapchat",
];
export function mediaKitData(profile, origin) {
  let handles = profile.social_handles;
  try {
    if (typeof handles === "string") handles = JSON.parse(handles);
  } catch {
    handles = {};
  }
  let listed = profile.platforms;
  try {
    if (typeof listed === "string") listed = JSON.parse(listed);
  } catch {
    listed = [];
  }
  const platforms = [
    ...new Set(
      [
        ...(Array.isArray(listed) ? listed : []),
        ...Object.keys(handles || {}).filter((k) => handles[k]),
      ].map((v) => String(v).toLowerCase()),
    ),
  ].filter((p) => allowedPlatforms.includes(p));
  const count = Number(profile.review_count),
    rating = Number(profile.avg_rating);
  return {
    name: String(profile.username || profile.company_name || "Public profile"),
    role: profile.user_type === "besponsored" ? "Creator" : "Sponsor",
    about: String(profile.about_yourself || ""),
    content: String(profile.contenttype || ""),
    location: String(profile.location || ""),
    url: publicProfileUrl(profile.slug, origin),
    platforms,
    reviews: Number.isInteger(count) && count > 0 ? count : 0,
    rating:
      profile.avg_rating != null &&
      profile.avg_rating !== "" &&
      Number.isFinite(rating) &&
      rating >= 0 &&
      rating <= 5
        ? rating
        : null,
  };
}
export function mountMediaKit(profile) {
  const host = document.getElementById("creator-media-kit");
  if (!host) return;
  const data = mediaKitData(profile, location.origin);
  host.hidden = false;
  host.replaceChildren();
  const heading = document.createElement("h2");
  heading.textContent = "Media kit";
  const intro = document.createElement("p");
  intro.textContent =
    "A concise profile to share with potential partners. Preview it or print to save a PDF.";
  const controls = document.createElement("div");
  controls.className = "share-controls";
  const preview = document.createElement("button");
  preview.type = "button";
  preview.textContent = "Preview media kit";
  preview.setAttribute("aria-expanded", "false");
  preview.setAttribute("aria-controls", "media-kit-content");
  const print = document.createElement("button");
  print.type = "button";
  print.textContent = "Print / save PDF";
  const content = document.createElement("article");
  content.id = "media-kit-content";
  content.className = "media-kit-document";
  content.hidden = true;
  const add = (tag, value) => {
    const node = document.createElement(tag);
    node.textContent = value;
    content.append(node);
  };
  add("p", "SPONSOR SORTER · " + data.role.toUpperCase() + " MEDIA KIT");
  add("h2", data.name);
  if (data.content || data.location)
    add("p", [data.content, data.location].filter(Boolean).join(" · "));
  add("h3", "About");
  add("p", data.about || "This account has not added an introduction yet.");
  add("h3", "Platforms");
  add(
    "p",
    data.platforms.length ? data.platforms.join(" · ") : "No platforms listed.",
  );
  if (data.reviews && data.rating !== null) {
    add("h3", "Partner feedback");
    add(
      "p",
      data.rating.toFixed(2) + " / 5 from " + data.reviews + " public reviews",
    );
  }
  add("h3", "Start a conversation");
  add(
    "p",
    "View the current profile and propose a partnership through Sponsor Sorter. Scope, pricing and availability are agreed directly for each campaign.",
  );
  if (data.url) {
    const link = document.createElement("a");
    link.href = data.url;
    link.textContent = data.url;
    content.append(link);
  }
  add(
    "p",
    "Prepared " +
      new Date().toLocaleDateString() +
      ". Profile information is account-provided. This snapshot does not verify audience size, availability or future results.",
  );
  preview.addEventListener("click", () => {
    content.hidden = !content.hidden;
    preview.setAttribute("aria-expanded", String(!content.hidden));
    preview.textContent = content.hidden ? "Preview media kit" : "Hide preview";
  });
  print.addEventListener("click", () => {
    document.getElementById("media-kit-print")?.remove();
    const sheet = content.cloneNode(true);
    sheet.id = "media-kit-print";
    sheet.hidden = false;
    document.body.append(sheet);
    document.body.classList.add("media-kit-printing");
    window.print();
  });
  window.addEventListener("afterprint", () => {
    document.getElementById("media-kit-print")?.remove();
    document.body.classList.remove("media-kit-printing");
  });
  controls.append(preview, print);
  host.append(heading, intro, controls, content);
}
