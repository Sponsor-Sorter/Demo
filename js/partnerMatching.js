// Explainable partner selection. Missing information never earns points.
const aliases = {
  gaming: "games",
  gamer: "games",
  fitness: "fitness",
  workout: "fitness",
  tech: "technology",
  uk: "united kingdom",
  usa: "united states",
  us: "united states",
  x: "twitter",
};
export function terms(value) {
  if (Array.isArray(value)) return [...new Set(value.flatMap(terms))];
  if (value && typeof value === "object")
    return terms(Object.keys(value).filter((k) => value[k]));
  const text = String(value || "")
    .trim()
    .toLowerCase();
  if (/^[{[]/.test(text)) {
    try {
      return terms(JSON.parse(text));
    } catch {}
  }
  return [
    ...new Set(
      text
        .split(/[,;|/]+/)
        .map((s) => s.trim())
        .filter(
          (s) => s && !["none", "any", "all", "not specified"].includes(s),
        )
        .map((s) => aliases[s] || s),
    ),
  ];
}
function shared(a, b) {
  return terms(a).filter((v) => terms(b).includes(v));
}
function platforms(p) {
  return terms([p.platforms, p.social_handles]).filter((v) =>
    [
      "youtube",
      "instagram",
      "tiktok",
      "twitch",
      "facebook",
      "twitter",
      "snapchat",
    ].includes(v),
  );
}
export function rankPartners(
  viewer,
  candidates,
  { limit = 6, followers = {} } = {},
) {
  const role = viewer.userType === "sponsor" ? "besponsored" : "sponsor";
  return candidates
    .filter((p) => p.user_id !== viewer.user_id && p.userType === role)
    .map((profile) => {
      const sponsor = role === "besponsored" ? viewer : profile;
      const creator = role === "besponsored" ? profile : viewer;
      const reasons = [];
      const missing = [];
      let points = 0;
      let substantive = 0;
      const add = (label, values, weight) => {
        if (values.length) {
          reasons.push(label + ": " + values.join(", "));
          points += weight;
          substantive++;
        }
      };
      add(
        "Shared content interests",
        shared(viewer.contenttype, profile.contenttype),
        35,
      );
      add(
        "Shared audience interests",
        shared(viewer.target_audience, profile.target_audience),
        20,
      );
      const required = platforms(sponsor),
        available = platforms(creator),
        overlap = shared(required, available);
      add("Compatible platforms", overlap, 20);
      add(
        "Preferred content formats",
        shared(
          viewer.preferred_content_format,
          profile.preferred_content_format,
        ),
        15,
      );
      add(
        "Partnership preferences",
        shared(viewer.partnership_type, profile.partnership_type),
        10,
      );
      const location = shared(viewer.location, profile.location).filter(
        (v) => v !== "global" && v !== "worldwide",
      );
      if (location.length) {
        reasons.push("Same location: " + location.join(", "));
        points += 5;
      }
      const thresholdText = String(sponsor.minfollowers || "")
        .replace(/,/g, "")
        .trim()
        .split(/[-–]/)[0];
      const minimum = /^\d+(?:\.\d+)?[kKmM]?(?:\+)?$/.test(thresholdText)
        ? parseFloat(thresholdText) *
          (/[mM]/.test(thresholdText)
            ? 1000000
            : /[kK]/.test(thresholdText)
              ? 1000
              : 1)
        : 0;
      const count = Number(followers[creator.user_id]);
      const belowMinimum =
        minimum > 0 && Number.isFinite(count) && count < minimum;
      if (minimum > 0 && !Number.isFinite(count))
        missing.push("Follower requirement needs checking");
      if (minimum > 0 && Number.isFinite(count) && !belowMinimum)
        reasons.push("Meets stated combined follower minimum");
      if (required.length && !available.length)
        missing.push("Platform information missing");
      if (!profile.contenttype) missing.push("Content interests not provided");
      return {
        profile,
        reasons,
        missing,
        points,
        substantive,
        excluded:
          belowMinimum ||
          (required.length > 0 && available.length > 0 && !overlap.length),
      };
    })
    .filter((m) => !m.excluded && m.substantive > 0)
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.substantive - a.substantive ||
        String(a.profile.username).localeCompare(String(b.profile.username)) ||
        String(a.profile.user_id).localeCompare(String(b.profile.user_id)),
    )
    .slice(0, Math.max(1, Math.min(12, limit)));
}
