const HOSTS = {
  youtube: ["youtube.com", "youtu.be"],
  tiktok: ["tiktok.com"],
  instagram: ["instagram.com"],
  facebook: ["facebook.com", "fb.watch"],
  twitch: ["twitch.tv"],
  twitter: ["twitter.com", "x.com"],
  x: ["x.com", "twitter.com"],
  linkedin: ["linkedin.com"],
  snapchat: ["snapchat.com"],
};
export function validatePublishedContent(
  rows,
  platforms,
  today = new Date().toLocaleDateString("en-CA"),
) {
  if (
    !Array.isArray(platforms) ||
    !platforms.length ||
    rows.length !== platforms.length
  )
    throw new Error(
      "A content link and publication date are required for every agreed platform.",
    );
  const urls = [],
    dates = [];
  rows.forEach((row, index) => {
    const platform = String(platforms[index]).trim().toLowerCase();
    let url;
    try {
      url = new URL(row.url);
    } catch {
      throw new Error("Enter a valid content URL for " + platform + ".");
    }
    const hosts = HOSTS[platform];
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      !hosts?.some((h) => url.hostname === h || url.hostname.endsWith("." + h))
    )
      throw new Error("Use an HTTPS content link from " + platform + ".");
    if (
      url.pathname === "/" &&
      !(platform === "youtube" && url.searchParams.has("v"))
    )
      throw new Error(
        "Link to the published content, rather than the platform home page.",
      );
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(row.date || "") ||
      Number.isNaN(Date.parse(row.date)) ||
      new Date(row.date).toISOString().slice(0, 10) !== row.date ||
      row.date > today
    )
      throw new Error(
        "Choose a valid publication date, no later than today, for " +
          platform +
          ".",
      );
    url.hash = "";
    if (urls.includes(url.href))
      throw new Error("Each agreed platform needs its own content link.");
    urls.push(url.href);
    dates.push(row.date);
  });
  return { urls, dates };
}
