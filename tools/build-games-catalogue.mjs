import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root = new URL('../', import.meta.url);
export const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function validateCatalogue(data) {
  const ids = new Set();
  for (const entry of data.entries) {
    if (!/^[a-z0-9-]+$/.test(entry.id) || ids.has(entry.id)) throw Error('Invalid or duplicate entry ID');
    ids.add(entry.id);
    for (const key of ['title','type','tagline','description','image','imageAlt','status','build','requirements','instructionsTitle','notes']) if (!entry[key]) throw Error(`Missing ${key}`);
    if (!['App','Game'].includes(entry.type) || !entry.instructions?.length || !entry.actions?.length) throw Error('Incomplete entry');
    for (const action of entry.actions) {
      const url = new URL(action.url);
      if (url.protocol !== 'https:' || url.username || url.password || !action.label) throw Error('Invalid public action URL');
    }
    if (!/^\.\/[a-zA-Z0-9/_.-]+$/.test(entry.image)) throw Error('Image must be a local asset');
    if (entry.sha256 && !/^[A-F0-9]{64}$/.test(entry.sha256)) throw Error('Invalid artifact hash');
  }
  return data;
}
export function renderEntry(entry) {
  return `<article class="panel games-entry" id="${entry.id}" aria-labelledby="${entry.id}-title">
  <div class="games-art"><img src="${escape(entry.image)}" alt="${escape(entry.imageAlt)}" width="160" height="160" loading="lazy"><p class="games-kind">${escape(entry.type)}</p><p class="games-tagline">${escape(entry.tagline)}</p></div>
  <div class="games-details"><div class="games-entry-heading"><h2 id="${entry.id}-title">${escape(entry.title)}</h2><span class="games-status">${escape(entry.status)}</span></div>
  <p class="games-build" ${entry.releaseManifest ? `data-game-release="${escape(entry.id)}" data-release-manifest="${escape(entry.releaseManifest)}"` : ''}>${escape(entry.build)}</p><p>${escape(entry.description)}</p>
  <div class="actions">${entry.actions.map(action=>`<a class="button ${action.primary?'primary':'secondary'}" href="${escape(action.url)}"${action.url.endsWith('.apk')?' referrerpolicy="no-referrer"':''}>${escape(action.label)}</a>`).join('')}</div>
  <p class="games-requirements">${escape(entry.requirements)}</p>
  <details><summary>${escape(entry.instructionsTitle)}</summary><ol>${entry.instructions.map(step=>`<li>${escape(step)}</li>`).join('')}</ol><p>${escape(entry.notes)}</p></details>
  ${entry.sha256?`<details><summary>Download verification</summary><p>SHA-256 of the listed Android package</p><code>${entry.sha256}</code></details>`:''}</div>
  <aside class="games-qr"><img src="./games-assets/${entry.id}-qr.svg" alt="QR code for the ${escape(entry.title)} catalogue entry" width="148" height="148" loading="lazy"><strong>Open on your phone</strong><p>Scan for the current play and download links.</p><a href="https://sponsorsorter.com/games.html#${entry.id}">Open this entry</a></aside>
</article>`;
}
export function buildCatalogue() {
 const data=validateCatalogue(JSON.parse(readFileSync(new URL('content/games-catalogue.json',root),'utf8')));
 const footer=readFileSync(new URL('index.html',root),'utf8').match(/<footer class="site-footer"[\s\S]*?<\/footer>/)?.[0];
 if (!footer?.includes('games.html')) throw Error('Shared footer must include Games');
 const page=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Games & apps | Sponsor Sorter</title><meta name="description" content="Play Meadow Markets and Meadow Market Littles, and discover Sponsor Sorter apps. Find current builds, Android downloads, getting-started guides and QR codes."><link rel="icon" href="./favicon.ico"><link rel="canonical" href="https://sponsorsorter.com/games.html"><link rel="stylesheet" href="./homepage.css?v=20261010-home2"><link rel="stylesheet" href="./site-shell.css?v=20261011-shell1"><link rel="stylesheet" href="./content-pages.css?v=20261012-pages1"><link rel="stylesheet" href="./games-catalogue.css?v=20261019-1"><script type="module" src="./js/connectionHeader.js?v=20261018-calm1"></script><script type="module" src="./js/gamesCatalogue.mjs?v=20261026-refresh1"></script></head>
 <body id="site-top" data-page="games"><a class="page-skip-link" href="#main">Skip to content</a><header class="wrap header"><a class="brand" href="./index.html" aria-label="Sponsor Sorter home"><img src="./logos.png" width="46" height="46" alt=""><span>Sponsor Sorter</span></a><nav aria-label="Main navigation"><a href="./index.html">Home</a><a href="./finder.html">Finder</a><a href="./games.html" aria-current="page">Games</a><a href="./install.html">Install the app</a></nav></header>
 <main id="main" tabindex="-1"><section class="wrap games-intro"><p class="eyebrow">Play. Explore. Take it with you.</p><h1>Games & apps</h1><p class="lead">A place to find our games and apps, open them in your browser or get the right download for your device.</p><nav class="games-jump" aria-label="Games and apps">${data.entries.map(entry=>`<a href="#${entry.id}">${escape(entry.title)}</a>`).join('')}</nav></section><section class="wrap games-list" aria-label="Available games and apps">${data.entries.map(renderEntry).join('\n')}</section><section class="wrap games-help"><h2>One place for the latest links</h2><p>Each QR code opens its catalogue entry, so you can find the current release and instructions on your phone. Android downloads need your device's installation confirmation. Keep Play Protect enabled.</p><p>Need help getting started? <a href="./contact.html">Contact us</a>.</p></section></main>${footer}</body></html>`;
 writeFileSync(new URL('games.html',root),page,'utf8');
 return data;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) buildCatalogue();
