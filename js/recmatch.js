import { supabase } from "./supabaseClient.js";
import { rankPartners } from "./partnerMatching.js?v=20261011-match1";
import { supportingProfileCard } from "./finderSupporting.js?v=20261011-match1";
import {
  loadPartnerFeedback,
  loadPartnerPreferences,
  preferenceProfile,
  setPartnerFeedback,
} from "./partnerPreferences.js?v=20261011-prefs1";
const container = document.getElementById("recommendedMatches");
const helpLabel = document.getElementById("help-accounts-label");
function showLoading() {
  container.textContent = "Finding compatible partners…";
}
async function buildRecommendations(signal) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    throw new Error("Sign in to see partners selected for your profile.");
  }
  const fields =
    "user_id,username,userType,contenttype,platforms,target_audience,preferred_content_format,partnership_type,minfollowers,location,social_handles";
  const { data: profile, error } = await supabase
    .from("users_extended_data")
    .select(fields)
    .eq("user_id", session.user.id)
    .abortSignal(signal)
    .single();
  if (error || !profile) {
    throw new Error("Your matching preferences could not be loaded.");
  }
  if (!["sponsor", "besponsored"].includes(profile.userType)) {
    throw new Error("Complete your account type to find partners.");
  }
  const role = profile.userType === "sponsor" ? "besponsored" : "sponsor";
  // Read only the public directory, in stable pages. No private candidate profiles.
  const candidates = [];
  for (let start = 0; start < 5000; start += 500) {
    const { data, error } = await supabase
      .from("public_user_directory")
      .select(fields + ",profile_pic,planType")
      .eq("userType", role)
      .order("user_id")
      .range(start, start + 499)
      .abortSignal(signal);
    if (error) {
      throw new Error("Partner profiles could not be loaded. Please retry.");
    }
    candidates.push(...data);
    if (data.length < 500) break;
  }
  const ids = [profile.user_id, ...candidates.map((p) => p.user_id)];
  const followers = {};
  for (let start = 0; start < ids.length; start += 100) {
    const { data } = await supabase
      .from("user_social_followers")
      .select("user_id,total_followers")
      .in("user_id", ids.slice(start, start + 100))
      .abortSignal(signal);
    for (const row of data || []) {
      if (row.total_followers != null) {
        followers[row.user_id] = Number(row.total_followers);
      }
    }
  }
  const [preferences, feedback] = await Promise.all([
    loadPartnerPreferences(session.user.id, signal),
    loadPartnerFeedback(session.user.id, signal),
  ]);
  const dismissed = new Set(
    feedback.filter((f) => f.status === "dismissed").map((f) => f.partner_id),
  );
  const saved = new Set(
    feedback.filter((f) => f.status === "saved").map((f) => f.partner_id),
  );
  const matches = rankPartners(
    preferenceProfile(profile, preferences),
    candidates.filter((p) => !dismissed.has(p.user_id)),
    { followers },
  );
  if (!matches.length) {
    throw new Error(
      "No supported partner matches yet. Add content interests, preferred platforms and partnership preferences to your profile, or explore profiles below.",
    );
  }
  if (helpLabel) {
    helpLabel.textContent =
      "partners selected from your saved profile preferences";
  }
  const fragment = document.createDocumentFragment();
  const summary = document.createElement("p");
  summary.className = "finder-support-muted";
  summary.style.gridColumn = "1 / -1";
  summary.textContent =
    "Selected using your saved interests and preferences. Reasons reflect profile information, not guaranteed results. Combined followers may include overlapping audiences.";
  fragment.appendChild(summary);
  const preferencesLink = document.createElement("a");
  preferencesLink.href = "settings.html";
  preferencesLink.textContent = "Update matching preferences";
  preferencesLink.style.gridColumn = "1 / -1";
  fragment.appendChild(preferencesLink);
  for (const match of matches) {
    const p = match.profile;
    const card = supportingProfileCard(p, {
      isSponsor: profile.userType === "sponsor",
      followers: followers[p.user_id],
      imageUrl: p.profile_pic
        ? "https://mqixtrnhotqqybaghgny.supabase.co/storage/v1/object/public/logos/" +
          p.profile_pic
        : "logos.png",
    });
    const heading = document.createElement("strong");
    heading.textContent = "Why this partner fits";
    const reasons = document.createElement("ul");
    reasons.className = "partner-match-reasons";
    for (const reason of match.reasons) {
      const item = document.createElement("li");
      item.textContent = reason;
      reasons.append(item);
    }
    card.insertBefore(heading, card.lastChild);
    card.insertBefore(reasons, card.lastChild);
    if (match.missing.length) {
      const note = document.createElement("p");
      note.className = "finder-support-muted";
      note.textContent = match.missing.join(" · ");
      card.insertBefore(note, card.lastChild);
    }
    const choices = document.createElement("div");
    choices.className = "finder-support-actions";
    const save = document.createElement("button");
    save.type = "button";
    save.textContent = saved.has(p.user_id) ? "Saved partner" : "Save partner";
    save.setAttribute("aria-pressed", String(saved.has(p.user_id)));
    const dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.textContent = "Not interested";
    const state = document.createElement("p");
    state.setAttribute("role", "status");
    save.addEventListener("click", async () => {
      save.disabled = true;
      try {
        const value = saved.has(p.user_id) ? null : "saved";
        await setPartnerFeedback(session.user.id, p.user_id, value);
        value ? saved.add(p.user_id) : saved.delete(p.user_id);
        save.textContent = value ? "Saved partner" : "Save partner";
        save.setAttribute("aria-pressed", String(!!value));
        state.textContent = "Partner choice saved.";
      } catch (error) {
        state.textContent = error.message;
      } finally {
        save.disabled = false;
      }
    });
    dismiss.addEventListener("click", async () => {
      dismiss.disabled = true;
      try {
        await setPartnerFeedback(session.user.id, p.user_id, "dismissed");
        const notice = document.createElement("p");
        notice.textContent = "Partner dismissed. ";
        const undo = document.createElement("button");
        undo.type = "button";
        undo.textContent = "Undo";
        undo.addEventListener("click", async () => {
          undo.disabled = true;
          try {
            await setPartnerFeedback(session.user.id, p.user_id, null);
            loadRecommendations();
          } catch (error) {
            notice.textContent = error.message;
          }
        });
        notice.append(undo);
        card.replaceChildren(notice);
      } catch (error) {
        state.textContent = error.message;
        dismiss.disabled = false;
      }
    });
    choices.append(save, dismiss);
    card.append(choices, state);
    fragment.appendChild(card);
  }
  return fragment;
}
let recommendationRun = 0;
async function loadRecommendations() {
  if (!container) return;
  const run = ++recommendationRun;
  const controller = new AbortController();
  let timer;
  showLoading();
  container.setAttribute("aria-busy", "true");
  try {
    const fragment = await Promise.race([
      buildRecommendations(controller.signal),
      new Promise((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                "Recommendations are taking too long. Try again or use the search above.",
              ),
            ),
          12000,
        );
      }),
    ]);
    if (run === recommendationRun) container.replaceChildren(fragment);
  } catch (error) {
    if (run !== recommendationRun) return;
    const state = document.createElement("div");
    state.className = "finder-support-empty";
    const message = document.createElement("p");
    message.textContent = error.message ||
      "Recommendations are unavailable. Please try again.";
    const retry = document.createElement("button");
    retry.type = "button";
    retry.textContent = "Retry recommendations";
    retry.addEventListener("click", loadRecommendations);
    state.append(message, retry);
    container.replaceChildren(state);
  } finally {
    clearTimeout(timer);
    controller.abort();
    if (run === recommendationRun) container.setAttribute("aria-busy", "false");
  }
}
document.addEventListener("DOMContentLoaded", loadRecommendations);
