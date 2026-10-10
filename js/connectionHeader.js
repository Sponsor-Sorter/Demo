// Decorative paths represent people connecting. No user data or network requests.
const stylesheet = document.createElement("link");
stylesheet.rel = "stylesheet";
stylesheet.href = new URL(
  "../connection-header.css?v=20261010-grid1",
  import.meta.url,
).href;
document.head.append(stylesheet);

const routes = [
  "M0 40H144V88H288V24H432V72H576V120H720V56H960",
  "M0 120H96V72H240V136H384V88H528V40H672V104H816V24H960",
  "M0 8H192V56H336V104H480V152H624V88H768V136H960",
];
for (const header of document.querySelectorAll(
  "header.navbar1, header.header, header.admin-site-header",
)) {
  header.classList.add("connection-header");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 960 160");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.classList.add("connection-grid");
  routes.forEach((route, index) => {
    for (const kind of ["grid-route", "grid-signal"]) {
      const path = document.createElementNS(svg.namespaceURI, "path");
      path.setAttribute("d", route);
      path.setAttribute("pathLength", "768");
      path.setAttribute(
        "class",
        `${kind} ${index === 1 ? "signal-two" : index === 2 ? "signal-three" : ""}`,
      );
      svg.append(path);
    }
  });
  header.prepend(svg);
}
