// A read-only same-origin manifest keeps the frequently updated browser build current.
export function browserBuildLabel(release) {
  return Number.isSafeInteger(release?.build) && release.build > 0 ? `Browser build ${release.build}` : null;
}
if (typeof document !== 'undefined') {
  const target = document.querySelector('[data-game-release="meadow-markets"]');
  if (target) fetch('./meadow-and-market/release.json', {cache:'no-store',signal:AbortSignal.timeout(8000)})
    .then(response=>response.ok ? response.json() : null)
    .then(release=>{const label=browserBuildLabel(release);if(label)target.textContent=label;})
    .catch(()=>{}); // Retain the last published catalogue snapshot if unavailable.
}
