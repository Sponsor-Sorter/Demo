import { supabase } from "./supabaseClient.js";
import { escapeHtml, ratingStars } from "./safePresentation.js";

// Public statistics never query private campaigns, payouts or referral records.
const text = (id, value) => {
  document.getElementById(id).textContent = value;
};
function block(id, title, rows) {
  document.getElementById(id).innerHTML =
    `<h3>${escapeHtml(title)}</h3>${rows.length ? `<ul>${rows.map((row) => `<li>${row}</li>`).join("")}</ul>` : "<p>No public records to show yet.</p>"}`;
}
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const results = await Promise.all([
      supabase
        .from("public_offers")
        .select("id", { count: "exact", head: true })
        .eq("status", "open"),
      supabase
        .from("public_user_profiles")
        .select("user_id", { count: "exact", head: true }),
      supabase
        .from("public_profile_reviews")
        .select("slug", { count: "exact", head: true }),
      supabase
        .from("public_user_profiles")
        .select("username,company_name,created_at")
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("public_profile_reviews")
        .select("rating,review_text,created_at")
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("public_user_profiles")
        .select("username,company_name,avg_rating,review_count")
        .gt("review_count", 0)
        .order("avg_rating", { ascending: false })
        .order("review_count", { ascending: false })
        .limit(5),
    ]);
    if (results.some((result) => result.error))
      throw new Error("Public data unavailable");
    const [offers, profiles, reviewCount, recent, reviews, rated] = results;
    text("live-offer-count", offers.count ?? "—");
    text("user-count", profiles.count ?? "—");
    text("public-review-count", reviewCount.count ?? "—");
    text("system-status", "Public data loaded");
    text("last-updated", new Date().toLocaleString());
    block(
      "recent-profiles",
      "Recently published profiles",
      (recent.data || []).map((profile) =>
        escapeHtml(profile.username || profile.company_name || "Member"),
      ),
    );
    block(
      "recent-reviews",
      "Recent public reviews",
      (reviews.data || []).map(
        (review) =>
          `${ratingStars(review.rating)} ${escapeHtml(String(review.review_text || "").slice(0, 180))}`,
      ),
    );
    block(
      "top-rated",
      "Highest-rated public profiles",
      (rated.data || []).map(
        (profile) =>
          `${escapeHtml(profile.username || profile.company_name || "Member")} — ${ratingStars(profile.avg_rating)} (${escapeHtml(profile.review_count)} reviews)`,
      ),
    );
  } catch {
    text("system-status", "Public data unavailable");
    for (const id of ["live-offer-count", "user-count", "public-review-count"])
      text(id, "—");
    for (const id of ["recent-profiles", "recent-reviews", "top-rated"])
      document.getElementById(id).textContent =
        "Unable to load public data. Please try again later.";
  }
});
