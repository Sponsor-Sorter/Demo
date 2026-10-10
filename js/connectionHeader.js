// Decorative paths represent people connecting. No user data or network requests.
const stylesheet = document.createElement("link");
stylesheet.rel = "stylesheet";
stylesheet.href = new URL(
  "../connection-header.css?v=20261010-grid3",
  import.meta.url,
).href;
document.head.append(stylesheet);

// Coordinates traced from horizontal lines in the original 2222 × 888 artwork.
const routes = [
  "M189 615H1163",
  "M190 624H495",
  "M632 624H807",
  "M814 624H1250",
  "M277 632H1321",
  "M234 641H399",
  "M424 641H1137",
  "M1153 641H1285",
  "M216 650H869",
  "M875 650H1077",
  "M1084 650H1286",
  "M197 658H521",
  "M528 658H1233",
  "M224 667H391",
  "M398 667H703",
  "M710 667H1259",
  "M216 676H347",
  "M355 676H695",
  "M702 676H1042",
  "M1049 676H1285",
  "M208 685H747",
  "M754 685H895",
  "M1014 685H1233",
  "M242 693H921",
  "M945 693H1120",
  "M338 702H573",
  "M580 702H981",
  "M997 702H1259",
  "M198 711H521",
  "M528 711H1287",
  "M268 719H1215",
  "M242 728H955",
  "M1049 728H1234",
  "M232 736H877",
  "M884 736H1103",
  "M301 745H513",
  "M520 745H1181",
  "M275 754H1145",
  "M390 763H1242",
  "M450 771H669",
  "M780 771H1085",
  "M294 780H1189",
  "M276 789H1146",
  "M329 806H582",
  "M693 806H1182",
  "M302 815H460",
  "M468 815H721",
  "M788 815H921",
  "M928 815H1182",
  "M458 841H799",
  "M806 841H1163",
];
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
  routes.forEach((route, index) => {
    for (const kind of ["grid-signal"]) {
      const path = document.createElementNS(svg.namespaceURI, "path");
      path.setAttribute("d", route);
      path.setAttribute("pathLength", "768");
      path.setAttribute(
        "class",
        `${kind} ${index === 1 ? "signal-two" : index === 2 ? "signal-three" : ""}`,
      );
      path.style.animationDelay = `${-(index * 1.73)}s`;
      path.style.animationDuration = `${10 + (index % 9) * 1.5}s`;
      svg.append(path);
    }
  });
  const layer = document.createElement("div");
  layer.className = "connection-grid";
  layer.setAttribute("aria-hidden", "true");
  layer.append(svg);
  header.prepend(layer);
}
