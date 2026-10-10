// Consolidate the two legacy navigation rows without replacing account controls.
for (const header of document.querySelectorAll("header.navbar1")) {
  const navs = [...header.querySelectorAll(".navimg > nav")];
  if (!navs.length) continue;
  const main = navs[0];
  main.classList.add("workspace-nav", "nav");
  main.setAttribute("aria-label", "Main navigation");
  for (const nav of navs.slice(1)) {
    main.append(...nav.childNodes);
    nav.remove();
  }
}
