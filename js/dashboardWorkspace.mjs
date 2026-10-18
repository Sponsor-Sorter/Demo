// Presentation only. Move original nodes so account and campaign handlers survive.
export const dashboardSections = [
  ['overview', 'Overview', 'Campaign overview', 'Your campaigns, deadlines and next steps - without the clutter.'],
  ['public', 'Public offers', 'Open opportunities', 'Track public listings and applications in one place.'],
  ['history', 'History', 'Campaign history', 'Review past partnerships, feedback and campaign documents.'],
  ['analytics', 'Analytics', 'Performance', 'Explore the campaign results available for your account.'],
  ['profile', 'Profile & connections', 'Your public presence', 'Keep your profile and connected accounts ready for partnerships.'],
  ['community', 'Community', 'Your creator network', 'Manage friends, groups and shared collaborations.'],
];

export function initDashboardWorkspace(doc = document, win = window) {
  const dashboard = doc.querySelector('.dashboard');
  if (!dashboard || doc.querySelector('.dw-shell')) return;
  const sponsor = doc.body.dataset.page === 'dashboardsponsor';
  doc.body.classList.add('dashboard-redesign');
  const header = doc.querySelector('header.navbar1');
  const legacyHeader = header?.querySelector('.navbar');
  if (legacyHeader) {
    const bar = doc.createElement('div'); bar.className = 'dw-topbar';
    const brand = legacyHeader.querySelector('.site-brand');
    const search = legacyHeader.querySelector('.nav-search');
    const icons = legacyHeader.querySelector('.icon-bar-bg');
    const links = doc.createElement('div'); links.className = 'dw-toplinks'; links.setAttribute('role', 'navigation'); links.setAttribute('aria-label', 'Main navigation');
    for (const anchor of [...legacyHeader.querySelectorAll('nav > li > a')]) {
      if (!anchor.closest('#auth-link')) links.append(anchor);
    }
    const auth = legacyHeader.querySelector('#auth-link'); if (auth) { auth.hidden = true; links.append(auth); }
    if (brand) bar.append(brand); if (search) bar.append(search); bar.append(links); if (icons) bar.append(icons);
    legacyHeader.replaceWith(bar);
  }
  const select = selector => dashboard.querySelector(selector);
  const field = selector => select(selector)?.closest('fieldset');
  const sections = {
    overview: [field('.dashboard-cards'), field('#listing-container')],
    public: [field('#sponsor-offer-status-filter, #public-offer-status-filter')],
    history: [select('.deals-history-row, .offer-dets') || select('.recent-deals'), select('.Archived-deals')],
    analytics: [field('.graph-section')],
    profile: [select('.top-profile-activity-layout') || field('#profile-pic'), field('.oauth-platforms')],
    community: [select('#friends-and-groups')],
  };
  // Avoid moving a child out of an already selected parent (history/profile groups).
  for (const key of Object.keys(sections)) sections[key] = sections[key].filter((node, index, list) => node && list.indexOf(node) === index && !list.some(parent => parent && parent !== node && parent.contains(node)));
  const shell = doc.createElement('div'); shell.className = 'dw-shell';
  const sidebar = doc.createElement('nav'); sidebar.className = 'dw-sidebar'; sidebar.setAttribute('aria-label', 'Dashboard sections');
  const caption = doc.createElement('p'); caption.className = 'dw-caption'; caption.textContent = sponsor ? 'SPONSOR WORKSPACE' : 'CREATOR WORKSPACE'; sidebar.append(caption);
  const main = doc.createElement('main'); main.className = 'dw-main';
  const heading = doc.createElement('div'); heading.className = 'dw-heading';
  const text = doc.createElement('div');
  const eyebrow = doc.createElement('p'); eyebrow.className = 'dw-caption'; eyebrow.textContent = sponsor ? 'BUILD BETTER PARTNERSHIPS' : 'GROW YOUR CREATOR BUSINESS';
  const title = doc.createElement('h1'); title.tabIndex = -1;
  const description = doc.createElement('p'); description.className = 'dw-description';
  text.append(eyebrow, title, description);
  const discover = doc.createElement('a'); discover.className = 'dw-primary'; discover.href = './finder.html'; discover.textContent = sponsor ? 'Find creators' : 'Find opportunities';
  heading.append(text, discover); main.append(heading);
  const panels = new Map(); const buttons = new Map();
  for (const [key, label, name, copy] of dashboardSections) {
    if (!sections[key].length) continue;
    const panel = doc.createElement('section'); panel.className = 'dw-panel'; panel.id = `dashboard-${key}`; panel.setAttribute('aria-label', label);
    for (const node of sections[key]) panel.append(node);
    const button = doc.createElement('a'); button.href = `#dashboard-${key}`; button.textContent = label; button.dataset.section = key;
    button.addEventListener('click', event => { event.preventDefault(); activate(key, true); });
    sidebar.append(button); main.append(panel); panels.set(key, panel); buttons.set(key, button);
  }
  const profileActions = doc.createElement('div'); profileActions.className = 'dw-profile-actions';
  const edit = doc.createElement('button'); edit.type = 'button'; edit.textContent = 'Edit profile';
  edit.addEventListener('click', () => doc.getElementById('settings-cog-btn')?.click());
  const settings = doc.createElement('a'); settings.href = './settings.html'; settings.textContent = 'Account settings';
  profileActions.append(edit, settings); panels.get('profile')?.prepend(profileActions);
  const help = doc.createElement('a'); help.href = './help.html'; help.className = 'dw-help'; help.textContent = 'Help & support'; sidebar.append(help);
  // Preserve welcome, wallet and onboarding controls in a compact account strip.
  const account = doc.createElement('div'); account.className = 'dw-account';
  const welcome = dashboard.querySelector('.userprofile > h2'); const wallet = select('.wallet');
  if (welcome) account.append(welcome); if (wallet) account.append(wallet);
  if (account.childNodes.length) heading.before(account);
  const setup = select('#setup-nextstep'); if (setup) main.insertBefore(setup, heading.nextSibling);
  const guide = doc.querySelector('.workspace-start'); if (guide) { guide.classList.add('dw-guide'); main.append(guide); }
  for (const old of doc.querySelectorAll('.workspace-intro, .workspace-sections')) old.remove();
  shell.append(sidebar, main); dashboard.before(shell);
  // Keep any unclassified legacy content available rather than dropping it.
  for (const child of [...dashboard.children]) {
    if (child.matches('.userprofile')) {
      for (const remaining of [...child.children]) if (!remaining.matches('h2') && remaining.children.length) panels.get('profile')?.append(remaining);
    } else if (child.children.length) panels.get('profile')?.append(child);
  }
  dashboard.remove(); shell.id = 'page-content'; shell.tabIndex = -1;
  function activate(key, navigate = false) {
    if (!panels.has(key)) key = 'overview';
    for (const [id, panel] of panels) panel.hidden = id !== key;
    for (const [id, button] of buttons) { if (id === key) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current'); }
    const definition = dashboardSections.find(row => row[0] === key); title.textContent = definition[2]; description.textContent = definition[3];
    if (navigate) { if (win.location.hash !== `#dashboard-${key}`) win.history.pushState(null, '', `#dashboard-${key}`); title.focus({preventScroll:true}); shell.scrollIntoView({block:'start', behavior:'instant'}); }
    win.requestAnimationFrame(() => { win.dispatchEvent(new Event('resize')); });
  }
  const fromHash = () => {
    const target = doc.getElementById(win.location.hash.slice(1));
    const panel = target?.closest('.dw-panel');
    if (panel) activate(panel.id.replace('dashboard-', ''));
    else if (win.location.hash.startsWith('#dashboard-')) activate(win.location.hash.slice(11));
  };
  win.addEventListener('hashchange', fromHash);
  // Existing guidance/deep links continue to reveal their destination panel.
  doc.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]'); if (!link || link.dataset.section) return;
    const target = doc.getElementById(link.getAttribute('href').slice(1)); const panel = target?.closest('.dw-panel');
    if (panel) activate(panel.id.replace('dashboard-', ''));
  });
  activate('overview'); fromHash();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => initDashboardWorkspace());
  else initDashboardWorkspace();
}
