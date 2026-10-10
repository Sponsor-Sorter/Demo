const search = document.getElementById("help-search");
const categories = [...document.querySelectorAll(".help-category")];
const status = document.getElementById("help-search-status");
const empty = document.getElementById("help-empty");
search?.addEventListener("input", () => {
  const words = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  let count = 0;
  for (const category of categories) {
    let visible = 0;
    for (const topic of category.querySelectorAll("details")) {
      const matches = words.every((word) =>
        topic.textContent.toLowerCase().includes(word),
      );
      topic.hidden = !matches;
      if (matches) {
        visible++;
        count++;
      }
    }
    category.hidden = visible === 0;
  }
  empty.hidden = count !== 0;
  status.textContent = words.length
    ? `${count} matching ${count === 1 ? "topic" : "topics"}`
    : "";
});
