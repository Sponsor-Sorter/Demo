import { connectionGridRoutes as routes } from "./connectionGridRoutes.js?v=20261011-grid4";
// Decorative paths represent people connecting. No user data or network requests.
const stylesheet = document.createElement("link");
stylesheet.rel = "stylesheet";
stylesheet.href = new URL(
  "../connection-header.css?v=20261011-grid4",
  import.meta.url,
).href;
document.head.append(stylesheet);

for (const header of document.querySelectorAll(
  "header.navbar1, header.header, header.admin-site-header",
)) {
  header.classList.add("connection-header");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 2222 888");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.classList.add("connection-artwork");
  // Each light chooses a fresh route after fading out. CSS handles movement
  // without a JavaScript loop, and pauses it when the page is hidden.
  for (let index = 0; index < 44; index++) {
    const path = document.createElementNS(svg.namespaceURI, "path");
    path.setAttribute("pathLength", "768");
    path.setAttribute("class", "grid-signal");
    let previous = -1;
    const chooseRoute = () => {
      let next = Math.floor(Math.random() * routes.length);
      if (next === previous) next = (next + 1) % routes.length;
      previous = next;
      path.setAttribute("d", routes[next]);
    };
    chooseRoute();
    path.style.animationDelay = `${-Math.random() * 14}s`;
    path.style.animationDuration = `${7 + Math.random() * 10}s`;
    path.addEventListener("animationiteration", chooseRoute);
    svg.append(path);
  }
  const layer = document.createElement("div");
  layer.className = "connection-grid";
  layer.setAttribute("aria-hidden", "true");
  layer.append(svg);
  header.prepend(layer);
}

function syncHeaderMotion() {
  for (const signal of document.querySelectorAll(".connection-grid .grid-signal"))
    signal.style.animationPlayState = document.hidden ? "paused" : "running";
}
document.addEventListener("visibilitychange", syncHeaderMotion);
syncHeaderMotion();
