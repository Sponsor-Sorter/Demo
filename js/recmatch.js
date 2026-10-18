import { supabase } from "./supabaseClient.js";
import { loadPartnerRecommendations } from "./partnerRecommendations.mjs?v=20261018-match2";
import { supportingProfileCard } from "./finderSupporting.js?v=20261018-match2";
import { setPartnerFeedback } from "./partnerPreferences.js?v=20261011-prefs1";
const container = document.getElementById("recommendedMatches");
const helpLabel = document.getElementById("help-accounts-label");
function showLoading() {
  container.textContent = "Finding compatible partners…";
}
async function buildRecommendations(signal) {
  const { viewerId, viewerRole, matches } = await loadPartnerRecommendations(supabase, { limit: 6, signal });
  const saved = new Set(matches.filter(match => match.saved).map(match => match.profile.user_id));
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
    "Selected using your saved interests and preferences. Reasons reflect profile information, not guaranteed results. Reported combined followers may include overlapping audiences. Missing or old counts need checking.";
  fragment.appendChild(summary);
  const preferencesLink = document.createElement("a");
  preferencesLink.href = "settings.html";
  preferencesLink.textContent = "Update matching preferences";
  preferencesLink.style.gridColumn = "1 / -1";
  fragment.appendChild(preferencesLink);
  for (const match of matches) {
    const p = match.profile;
    const card = supportingProfileCard(p, {
      isSponsor: viewerRole === "sponsor",
      followers: match.followers,
      followerLabel: "reported combined followers",
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
        await setPartnerFeedback(viewerId, p.user_id, value);
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
        await setPartnerFeedback(viewerId, p.user_id, "dismissed");
        const notice = document.createElement("p");
        notice.textContent = "Partner dismissed. ";
        const undo = document.createElement("button");
        undo.type = "button";
        undo.textContent = "Undo";
        undo.addEventListener("click", async () => {
          undo.disabled = true;
          try {
            await setPartnerFeedback(viewerId, p.user_id, null);
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
