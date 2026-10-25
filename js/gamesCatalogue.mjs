// A read-only same-origin manifest keeps the frequently updated browser build current.
export function browserBuildLabel(release) {
  return Number.isSafeInteger(release?.build) && release.build > 0 ? `Browser build ${release.build}` : null;
}
export async function refreshBrowserBuild(target, runtime = globalThis) {
  let timer;
  try {
    const manifest = target.dataset.releaseManifest;
    if (!/^\.\/[a-z0-9-]+\/release\.json$/.test(manifest)) return;
    const options = {cache:'no-store'};
    if (typeof runtime.AbortSignal?.timeout === 'function') {
      options.signal = runtime.AbortSignal.timeout(8000);
    } else if (typeof runtime.AbortController === 'function') {
      const controller = new runtime.AbortController();
      options.signal = controller.signal;
      timer = runtime.setTimeout(() => controller.abort(), 8000);
    }
    const response = await runtime.fetch(manifest, options);
    const label = browserBuildLabel(response.ok ? await response.json() : null);
    if (label) target.textContent = label;
  } catch {
    // Keep this entry's published snapshot; other entries refresh independently.
  } finally {
    if (timer !== undefined) runtime.clearTimeout(timer);
  }
}

export function refreshBrowserBuilds(targets, runtime = globalThis) {
  return Promise.all(Array.from(targets, target => refreshBrowserBuild(target, runtime)));
}

if (typeof document !== 'undefined') {
  void refreshBrowserBuilds(document.querySelectorAll('[data-release-manifest]'));
}
