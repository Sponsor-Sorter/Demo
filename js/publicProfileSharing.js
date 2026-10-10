export function publicProfileUrl(slug, origin) {
  const value = String(slug || "").trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{2,39}$/.test(value)) return "";
  const url = new URL("/u/index.html", origin);
  url.searchParams.set("u", value);
  return url.href;
}

export function profileSlug(search, pathname) {
  // URLSearchParams already decodes once. Decoding twice corrupts malformed URLs.
  const query = new URLSearchParams(search).get("u");
  if (query) return /^[a-zA-Z0-9][a-zA-Z0-9_-]{2,39}$/.test(query) ? query : "";
  const match = String(pathname)
    .replace(/\/+$/, "")
    .match(/\/u\/([^/]+)$/i);
  if (!match || match[1].toLowerCase() === "index.html") return "";
  try {
    const value = decodeURIComponent(match[1]);
    return /^[a-zA-Z0-9][a-zA-Z0-9_-]{2,39}$/.test(value) ? value : "";
  } catch {
    return "";
  }
}

export function wireProfileSharing(profile) {
  const url = publicProfileUrl(profile.slug, location.origin);
  const input = document.getElementById("public-share-url");
  const copy = document.getElementById("public-copy-link");
  const share = document.getElementById("public-share-link");
  const status = document.getElementById("public-share-status");
  if (!url || !input || !copy || !share || !status) return;
  input.value = url;
  copy.disabled = false;
  share.hidden = typeof navigator.share !== "function";
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(url);
      status.textContent = "Profile link copied.";
    } catch {
      input.focus();
      input.select();
      status.textContent = "Select and copy the link above.";
    }
  });
  share.addEventListener("click", async () => {
    try {
      await navigator.share({
        title: `${profile.username || "Public profile"} | Sponsor Sorter`,
        url,
      });
      status.textContent = "Share dialog closed.";
    } catch (error) {
      if (error.name !== "AbortError")
        status.textContent = "Sharing unavailable. Use Copy link instead.";
    }
  });
}
