// Helpers for database content rendered inside HTML text or quoted attributes.
export function escapeHtml(value = "") {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character],
  );
}

export function safeImageUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : "logos.png";
  } catch {
    return "logos.png";
  }
}

export function ratingStars(value) {
  const rating = Number(value);
  return "★".repeat(
    Number.isFinite(rating) ? Math.max(0, Math.min(5, Math.round(rating))) : 0,
  );
}
