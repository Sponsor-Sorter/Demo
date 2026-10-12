import { supabase } from "./supabaseClient.js";

export const packageFields =
  "id,creator_user_id,title,deliverables,price_cents,currency,platforms,revisions,turnaround_days,usage_rights,availability,published";
export function packageTerms(p) {
  return `${p.deliverables}\n\nPlatforms: ${
    p.platforms.join(", ")
  }\nRevisions included: ${p.revisions}\nTurnaround: ${p.turnaround_days} days after acceptance and receipt of the brief.\nUsage permissions: ${p.usage_rights}`;
}
export function packageCard(p, username, { onEdit = null, base = "../" } = {}) {
  const card = document.createElement("article");
  card.className = "creator-package-card";
  const title = document.createElement("h3");
  title.textContent = p.title;
  const price = document.createElement("strong");
  price.textContent = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: p.currency,
  }).format(p.price_cents / 100) + " " + p.currency.toUpperCase();
  const terms = document.createElement("p");
  terms.textContent = packageTerms(p);
  terms.className = "creator-package-terms";
  const state = document.createElement("p");
  state.textContent = "Availability: " + p.availability +
    (onEdit ? (p.published ? " · Published" : " · Draft") : "");
  card.append(title, price, terms, state);
  if (onEdit) {
    const edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = "Edit package";
    edit.addEventListener("click", () => onEdit(p));
    card.append(edit);
  } else if (p.availability !== "paused") {
    const proposal = document.createElement("a");
    proposal.href = base + "newoffer.html?username=" +
      encodeURIComponent(username) + "&package_id=" + encodeURIComponent(p.id);
    proposal.textContent = "Request this package";
    proposal.className = "button";
    card.append(proposal);
  }
  return card;
}
export async function mountPublicPackages(profile) {
  const host = document.getElementById("creator-packages");
  if (!host || profile.user_type !== "besponsored") return;
  const { data, error } = await supabase.from("creator_packages").select(
    packageFields,
  ).eq("creator_user_id", profile.user_id).eq("published", true).order(
    "created_at",
  ).limit(20);
  if (error) {
    host.hidden = false;
    host.textContent = "Sponsorship packages could not be loaded.";
    return;
  }
  if (!data?.length) return;
  const heading = document.createElement("h2");
  heading.textContent = "Sponsorship packages";
  const note = document.createElement("p");
  note.textContent =
    "Creator-listed starting prices in USD. A request starts a proposal; deliverables, dates and permissions must be agreed before payment. Platform fees are shown separately at checkout.";
  const grid = document.createElement("div");
  grid.className = "creator-package-grid";
  for (const p of data) grid.append(packageCard(p, profile.username));
  host.replaceChildren(heading, note, grid);
  host.hidden = false;
}
