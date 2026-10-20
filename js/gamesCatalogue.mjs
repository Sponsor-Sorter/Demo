// A read-only same-origin manifest keeps the frequently updated browser build current.
export function browserBuildLabel(release) {
  return Number.isSafeInteger(release?.build) && release.build > 0 ? `Browser build ${release.build}` : null;
}
if (typeof document !== 'undefined') {
  for (const target of document.querySelectorAll('[data-release-manifest]')) {
  const manifest = target.dataset.releaseManifest;
  if (!/^\.\/[a-z0-9-]+\/release\.json$/.test(manifest)) continue;
  fetch(manifest, {cache:'no-store',signal:AbortSignal.timeout(8000)})
    .then(response=>response.ok ? response.json() : null)
    .then(release=>{const label=browserBuildLabel(release);if(label)target.textContent=label;})
    .catch(()=>{}); // Retain the last published catalogue snapshot if unavailable.
  }
}
