// Retain existing navigation nodes so role-aware links keep their listeners/IDs.
for (const header of document.querySelectorAll(
  "body.public-content-page > header.navbar1",
)) {
  const navs = [...header.querySelectorAll("nav")];
  if (!navs.length) continue;
  const nav = navs[0];
  nav.setAttribute("aria-label", "Main navigation");
  for (const extra of navs.slice(1)) nav.append(...extra.childNodes);
  const brand = document.createElement("a");
  brand.className = "brand";
  brand.href = new URL("../index.html", import.meta.url).href;
  brand.setAttribute("aria-label", "Sponsor Sorter home");
  const logo = document.createElement("img");
  logo.src = new URL("../logos.png", import.meta.url).href;
  logo.alt = "";
  logo.width = logo.height = 88;
  const title = document.createElement("span");
  title.textContent = "Sponsor Sorter";
  brand.append(logo, title);
  const artwork = header.querySelector(":scope > .connection-grid");
  header.replaceChildren(...(artwork ? [artwork] : []), brand, nav);
  header.classList.add("header");
}
