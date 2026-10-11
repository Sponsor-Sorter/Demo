// Layout only: preserve the existing search, recommendation and offer handlers.
const finderRoot = document.querySelector("fieldset.finder");
if (finderRoot) {
  document.body.classList.add("finder-redesign");
  const partnerPanel = document.getElementById("user-search-form-block");
  const form = document.getElementById("searchForm");
  const results = document.getElementById("searchResults");
  const heading = partnerPanel.querySelector("h3");
  const workbench = document.createElement("div");
  workbench.className = "finder-workbench";
  const filters = document.createElement("details");
  filters.className = "finder-filter-panel";
  filters.open = window.matchMedia("(min-width: 760px)").matches;
  const summary = document.createElement("summary");
  summary.textContent = "Refine your search";
  const description = document.createElement("p");
  description.textContent =
    "Start broad, then narrow by content, location or platform.";
  const suggestions = document.createElement("div");
  suggestions.className = "finder-topic-suggestions";
  suggestions.setAttribute("aria-label", "Explore a content type");
  for (const topic of ["Gaming", "Fitness", "Technology", "Lifestyle"]) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = topic;
    button.addEventListener("click", () => {
      document.getElementById("search-contenttype").value = topic;
      form.requestSubmit();
    });
    suggestions.append(button);
  }
  filters.append(summary, description, form, suggestions);
  const resultPanel = document.createElement("section");
  resultPanel.className = "finder-result-panel";
  resultPanel.setAttribute("aria-label", "Partner search results");
  resultPanel.append(
    heading,
    results,
    document.getElementById("searchPagination"),
  );
  workbench.append(filters, resultPanel);
  partnerPanel.append(workbench);

  const supporting = document.createElement("section");
  supporting.className = "finder-supporting";
  supporting.setAttribute("aria-label", "More partnership opportunities");
  finderRoot.after(supporting);
  for (const selector of [
    ".recommended-matches",
    ".otheraccounts",
    ".recentoffers",
  ]) {
    const section = document.querySelector(selector);
    if (section) supporting.append(section);
  }
  for (const help of supporting.querySelectorAll(".help-block")) {
    const details = document.createElement("details");
    details.className = "workspace-help";
    const summary = document.createElement("summary");
    summary.textContent = "About this section";
    help.before(details);
    details.append(summary, help);
  }
  const accountHeading = finderRoot.querySelector(".search-section > h2");
  if (accountHeading) accountHeading.classList.add("finder-account-context");
}
