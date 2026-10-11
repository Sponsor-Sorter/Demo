import { supabase } from "./supabaseClient.js";

export function preferenceProfile(profile, preferences) {
  if (!preferences) return profile;
  const result = { ...profile };
  // These fields are private discovery choices, never public profile assertions.
  for (
    const field of [
      "contenttype",
      "target_audience",
      "preferred_content_format",
      "partnership_type",
      "platforms",
      "minfollowers",
      "location",
    ]
  ) result[field] = preferences[field];
  return result;
}
export async function loadPartnerPreferences(userId, signal) {
  let query = supabase.from("partner_preferences").select(
    "contenttype,target_audience,preferred_content_format,partnership_type,platforms,minfollowers,location",
  ).eq("user_id", userId);
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query.maybeSingle();
  if (error) {
    throw new Error("Saved preferences are unavailable. Please retry.");
  }
  return data;
}
export async function loadPartnerFeedback(userId, signal) {
  let query = supabase.from("partner_feedback").select("partner_id,status").eq(
    "user_id",
    userId,
  ).limit(1000);
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) throw new Error("Saved partners are unavailable. Please retry.");
  return data || [];
}
export async function setPartnerFeedback(userId, partnerId, status) {
  if (!["saved", "dismissed", null].includes(status)) {
    throw new Error("Invalid partner choice");
  }
  const query = status
    ? supabase.from("partner_feedback").upsert({
      user_id: userId,
      partner_id: partnerId,
      status,
    }, { onConflict: "user_id,partner_id" })
    : supabase.from("partner_feedback").delete().eq("user_id", userId).eq(
      "partner_id",
      partnerId,
    );
  const { error } = await query;
  if (error) {
    throw new Error("Your partner choice was not saved. Please retry.");
  }
  window.dispatchEvent(
    new CustomEvent("partner-feedback-changed", {
      detail: { partnerId, status },
    }),
  );
}
