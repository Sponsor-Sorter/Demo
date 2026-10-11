// Compact public-profile cards shared by Finder's supporting sections.
export function supportingProfileCard(
  profile,
  { isSponsor = false, imageUrl, followers = null } = {},
) {
  const card = document.createElement("article");
  card.className = "finder-support-card";
  const header = document.createElement("div");
  header.className = "finder-support-card-header";
  const image = document.createElement("img");
  image.alt = (profile.username || "Account") + " profile";
  image.loading = "lazy";
  try {
    const url = new URL(imageUrl || "./logos.png", location.href);
    image.src = ["https:", "http:"].includes(url.protocol)
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
  const identity = document.createElement("div");
  const name = document.createElement("h4");
  name.textContent = profile.username || "Unnamed account";
  const plan = document.createElement("span");
  plan.className = "finder-plan";
  plan.textContent =
    String(profile.planType || "free").toLowerCase() === "pro"
      ? "Pro plan"
      : "Free plan";
  identity.append(name, plan);
  header.append(image, identity);
  const meta = document.createElement("p");
  meta.textContent =
    [profile.contenttype, profile.location].filter(Boolean).join(" · ") ||
    "Profile details not provided";
  let handles = profile.social_handles;
  try {
    if (typeof handles === "string") handles = JSON.parse(handles);
  } catch {
    handles = {};
  }
  const platforms = Object.entries(handles || {})
    .filter(
      ([key, value]) =>
        value &&
        [
          "youtube",
          "instagram",
          "twitch",
          "tiktok",
          "twitter",
          "facebook",
          "snapchat",
        ].includes(key.toLowerCase()),
    )
    .map(([key]) => key);
  const linked = document.createElement("p");
  linked.className = "finder-support-muted";
  linked.textContent = platforms.length
    ? "Linked: " + platforms.join(" · ")
    : "No linked platforms listed";
  const audience = document.createElement("p");
  audience.className = "finder-support-muted";
  audience.textContent =
    Number(followers) > 0
      ? Math.round(Number(followers)).toLocaleString() + " combined followers"
      : "Audience data unavailable";
  const actions = document.createElement("div");
  actions.className = "finder-support-actions";
  const view = document.createElement("a");
  view.href =
    (isSponsor ? "viewprofile.html" : "viewprofiles.html") +
    "?username=" +
    encodeURIComponent(profile.username || "");
  view.textContent = "View profile";
  actions.append(view);
  if (isSponsor) {
    const offer = document.createElement("a");
    offer.href =
      "newoffer.html?username=" + encodeURIComponent(profile.username || "");
    offer.textContent = "Make an offer";
    actions.append(offer);
  }
  card.append(header, meta, linked, audience, actions);
  return card;
}
