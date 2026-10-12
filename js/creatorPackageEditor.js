import { supabase } from "./supabaseClient.js";
import {
  packageCard,
  packageFields,
} from "./creatorPackages.js?v=20261011-packages1";
const host = document.getElementById("creator-package-editor");
async function mount() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    host.textContent = "Sign in to manage your sponsorship packages.";
    return;
  }
  const { data: profile, error } = await supabase.from("users_extended_data")
    .select("userType,username").eq("user_id", session.user.id).single();
  if (error || profile?.userType !== "besponsored") {
    host.textContent =
      "Sponsorship packages are available to creator accounts.";
    return;
  }
  const heading = document.createElement("h1");
  heading.textContent = "Your sponsorship packages";
  const intro = document.createElement("p");
  intro.textContent =
    "Offer clear starting points for brands. Publish packages on your enabled public profile. Requests become proposals, not automatic bookings. Accepted agreements retain the original package terms.";
  const form = document.createElement("form");
  form.className = "creator-package-form";
  const fields = {};
  let editing = null;
  for (
    const [key, label, type, max] of [
      ["title", "Package name", "text", 120],
      [
        "deliverables",
        "Deliverables: what the sponsor receives",
        "textarea",
        4000,
      ],
      ["price", "Starting price in USD (before platform fee)", "number", 20],
      ["revisions", "Included revision rounds", "number", 2],
      ["turnaround_days", "Turnaround in days", "number", 3],
      ["usage_rights", "Usage permissions and any limits", "textarea", 2000],
    ]
  ) {
    const wrap = document.createElement("label");
    wrap.textContent = label;
    const input = document.createElement(
      type === "textarea" ? "textarea" : "input",
    );
    input.name = key;
    input.required = true;
    if (type === "number") {
      input.type = "number";
      input.min = key === "revisions" ? "0" : "1";
      input.max = key === "price"
        ? "909090.90"
        : key === "revisions"
        ? "20"
        : "365";
      input.step = key === "price" ? "0.01" : "1";
    } else {
      input.maxLength = max;
      input.minLength = key === "title" ? 3 : key === "deliverables" ? 10 : 1;
      if (type === "textarea") input.rows = 4;
    }
    wrap.append(input);
    fields[key] = input;
    form.append(wrap);
  }
  const platforms = document.createElement("fieldset");
  const legend = document.createElement("legend");
  legend.textContent = "Included platforms";
  platforms.append(legend);
  for (
    const name of [
      "youtube",
      "instagram",
      "tiktok",
      "twitch",
      "facebook",
      "twitter",
      "snapchat",
    ]
  ) {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = name;
    label.append(input, document.createTextNode(name));
    platforms.append(label);
  }
  const availability = document.createElement("select");
  for (const value of ["open", "limited", "paused"]) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    availability.append(option);
  }
  const availabilityLabel = document.createElement("label");
  availabilityLabel.textContent = "Availability";
  availabilityLabel.append(availability);
  const published = document.createElement("input");
  published.type = "checkbox";
  const publishedLabel = document.createElement("label");
  publishedLabel.append(
    published,
    document.createTextNode("Publish on my public profile"),
  );
  const save = document.createElement("button");
  save.type = "submit";
  save.textContent = "Save package";
  const fresh = document.createElement("button");
  fresh.type = "button";
  fresh.textContent = "Start a new package";
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  const grid = document.createElement("div");
  grid.className = "creator-package-grid";
  form.append(
    platforms,
    availabilityLabel,
    publishedLabel,
    save,
    fresh,
    status,
  );
  host.replaceChildren(heading, intro, form, grid);
  function reset() {
    editing = null;
    form.reset();
    fields.revisions.value = 1;
    fields.turnaround_days.value = 7;
    fields.usage_rights.value = "Agree usage permissions in the proposal.";
  }
  function edit(p) {
    editing = p.id;
    for (const [key, input] of Object.entries(fields)) {
      input.value = key === "price" ? p.price_cents / 100 : p[key];
    }
    availability.value = p.availability;
    published.checked = p.published;
    for (const input of platforms.querySelectorAll("input")) {
      input.checked = p.platforms.includes(input.value);
    }
    form.scrollIntoView({ behavior: "smooth", block: "start" });
    fields.title.focus();
  }
  async function load() {
    const { data, error } = await supabase.from("creator_packages").select(
      packageFields,
    ).eq("creator_user_id", session.user.id).order("created_at").limit(100);
    if (error) {
      status.textContent = "Packages could not be loaded. Reload to retry.";
      return;
    }
    grid.replaceChildren(
      ...data.map((p) =>
        packageCard(p, profile.username, { onEdit: edit, base: "./" })
      ),
    );
  }
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const selected = [...platforms.querySelectorAll("input:checked")].map((i) =>
      i.value
    );
    if (!selected.length) {
      status.textContent = "Choose at least one platform.";
      return;
    }
    save.disabled = true;
    const values = {
      creator_user_id: session.user.id,
      platforms: selected,
      availability: availability.value,
      published: published.checked,
    };
    for (const [key, input] of Object.entries(fields)) {
      if (key === "price") {
        values.price_cents = Math.round(Number(input.value) * 100);
      } else {values[key] = ["revisions", "turnaround_days"].includes(key)
          ? Number(input.value)
          : input.value.trim();}
    }
    if (!Number.isSafeInteger(values.price_cents) || values.price_cents < 100 ||
        values.price_cents > 90909090 ||
        !Number.isInteger(values.revisions) || values.revisions < 0 || values.revisions > 20 ||
        !Number.isInteger(values.turnaround_days) || values.turnaround_days < 1 || values.turnaround_days > 365 ||
        values.title.length < 3 || values.deliverables.length < 10 || !values.usage_rights) {
      status.textContent = "Check the package name, deliverables, price and delivery terms.";
      save.disabled = false;
      return;
    }
    const query = editing
      ? supabase.from("creator_packages").update(values).eq("id", editing).eq(
        "creator_user_id",
        session.user.id,
      )
      : supabase.from("creator_packages").insert(values);
    let error;
    try {
      // Require a returned row: an RLS-filtered update must not report success.
      const result = await query.select("id").single();
      error = result.error || (!result.data?.id ? new Error("No package saved") : null);
    } catch (failure) {
      error = failure;
    } finally {
      save.disabled = false;
    }
    status.textContent = error
      ? "Package could not be saved. Check the fields and retry."
      : "Package saved.";
    save.disabled = false;
    if (!error) {
      reset();
      await load();
    }
  });
  fresh.addEventListener("click", reset);
  reset();
  await load();
}
mount().catch(() => {
  host.textContent = "Package tools are unavailable. Reload to retry.";
});
