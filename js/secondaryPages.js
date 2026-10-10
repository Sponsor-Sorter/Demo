// Preserve business controls and listeners while improving the surrounding layout.
for (const table of document.querySelectorAll(".secondary-page table")) {
  if (table.closest(".table-scroll")) continue;
  const region = document.createElement("div");
  region.className = "table-scroll";
  region.tabIndex = 0;
  region.setAttribute("role", "region");
  region.setAttribute(
    "aria-label",
    table.caption?.textContent || "Scrollable data table",
  );
  table.before(region);
  region.append(table);
}
for (const link of document.querySelectorAll('a[target="_blank"]')) {
  link.relList.add("noopener", "noreferrer");
}
for (const [id, label] of Object.entries({
  "blog-search": "Search articles",
  "blog-category": "Article category",
  "forum-search": "Search discussions",
  "forum-category": "Discussion category",
})) {
  const input = document.getElementById(id);
  if (input && !input.labels?.length) input.setAttribute("aria-label", label);
}
