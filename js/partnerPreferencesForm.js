import { supabase } from "./supabaseClient.js";
import { loadPartnerPreferences } from "./partnerPreferences.js?v=20261011-prefs1";

const host = document.getElementById("partner-preferences");
async function mount() {
  if (!host) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) return;
  host.hidden = false;
  const form = document.createElement("form");
  form.className = "partner-preference-form";
  const heading = document.createElement("h2");
  heading.textContent = "Your partner matching preferences";
  const intro = document.createElement("p");
  intro.textContent =
    "Choose what you want to find. These private preferences sync across devices and do not change your public profile. Use commas to separate interests.";
  form.append(heading, intro);
  const inputs = {};
  for (
    const [key, label, max] of [
      ["contenttype", "Content interests", 400],
      ["target_audience", "Audience interests", 400],
      ["preferred_content_format", "Content formats", 400],
      ["partnership_type", "Partnership types", 400],
      ["location", "Preferred location", 200],
      ["minfollowers", "Minimum combined followers (0 means no minimum)", 10],
    ]
  ) {
    const wrap = document.createElement("label");
    wrap.textContent = label;
    const input = document.createElement("input");
    input.name = key;
    input.maxLength = max;
    if (key === "minfollowers") {
      input.type = "number";
      input.min = "0";
      input.max = "1000000000";
      input.step = "1";
    }
    wrap.append(input);
    form.append(wrap);
    inputs[key] = input;
  }
  const platforms = document.createElement("fieldset");
  const legend = document.createElement("legend");
  legend.textContent = "Preferred platforms";
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
    label.append(
      input,
      document.createTextNode(name === "twitter" ? "X / Twitter" : name),
    );
    platforms.append(label);
  }
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  const save = document.createElement("button");
  save.type = "submit";
  save.textContent = "Save matching preferences";
  const reset = document.createElement("button");
  reset.type = "button";
  reset.textContent = "Use profile preferences again";
  const feedback = document.createElement("button");
  feedback.type = "button";
  feedback.textContent = "Restore dismissed partners";
  form.append(platforms, save, reset, feedback, status);
  host.replaceChildren(form);
  let loaded = false;
  try {
    const preferences = await loadPartnerPreferences(session.user.id);
    const { data: profile, error } = await supabase.from("users_extended_data")
      .select(
        "contenttype,target_audience,preferred_content_format,partnership_type,platforms,minfollowers,location",
      ).eq("user_id", session.user.id).single();
    if (error) throw Error("Profile preferences could not be loaded.");
    const values = preferences || profile;
    for (const [key, input] of Object.entries(inputs)) {
      input.value = key === "minfollowers"
        ? Number.isFinite(Number(values[key])) ? Number(values[key]) : 0
        : values[key] || "";
    }
    for (const input of platforms.querySelectorAll("input")) {
      input.checked = Array.isArray(values.platforms) &&
        values.platforms.includes(input.value);
    }
    loaded = true;
  } catch (error) {
    status.textContent = error.message;
    save.disabled = true;
  }
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!loaded) return;
    save.disabled = true;
    const values = { user_id: session.user.id };
    for (const [key, input] of Object.entries(inputs)) {
      values[key] = key === "minfollowers"
        ? Number(input.value)
        : input.value.trim();
    }
    values.platforms = [...platforms.querySelectorAll("input:checked")].map(
      (i) => i.value,
    );
    const { error } = await supabase.from("partner_preferences").upsert(
      values,
      { onConflict: "user_id" },
    );
    status.textContent = error
      ? "Preferences were not saved. Please retry."
      : "Preferences saved. Finder will use them on your next visit.";
    save.disabled = false;
  });
  reset.addEventListener("click", async () => {
    reset.disabled = true;
    const { error } = await supabase.from("partner_preferences").delete().eq(
      "user_id",
      session.user.id,
    );
    status.textContent = error
      ? "Could not reset preferences."
      : "Finder will use your profile preferences again. Reload to edit those values.";
    reset.disabled = false;
  });
  feedback.addEventListener("click", async () => {
    feedback.disabled = true;
    const { error } = await supabase.from("partner_feedback").delete().eq(
      "user_id",
      session.user.id,
    ).eq("status", "dismissed");
    status.textContent = error
      ? "Dismissed partners could not be restored."
      : "Dismissed partners restored.";
    feedback.disabled = false;
  });
}
mount().catch(() => {
  if (host) {
    host.textContent = "Matching settings are unavailable. Reload to retry.";
  }
});
