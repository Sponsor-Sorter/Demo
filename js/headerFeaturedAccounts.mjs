import { requestFeatured, activeFeaturedSlots } from './featuredApi.mjs?v=20261017-featured1';

// Only active accounts become links. Decorative grid lines never do.
async function initFeaturedAccounts() {
  const headers = [...document.querySelectorAll('header.navbar1, header.header, header.admin-site-header')];
  if (!headers.length) return;
  try {
    const slots = activeFeaturedSlots(await requestFeatured(), location.origin);
    if (!slots.length) return;
    for (const header of headers) {
      if (header.querySelector('.featured-accounts')) continue;
      const region = document.createElement('div');
      region.className = 'featured-accounts';
      const title = document.createElement('span');
      title.className = 'featured-accounts-title';
      title.textContent = 'Featured accounts';
      const list = document.createElement('ul');
      list.setAttribute('aria-label', 'Featured accounts');
      for (const slot of slots) {
        const item = document.createElement('li');
        const link = document.createElement('a');
        link.className = 'featured-account-star';
        link.href = new URL(slot.profile_url, location.origin).href;
        link.setAttribute('aria-label', `View featured account @${slot.profile.username}`);
        link.title = slot.label || `@${slot.profile.username}`;
        const star = document.createElement('span');
        star.setAttribute('aria-hidden', 'true'); star.textContent = '✦';
        const label = document.createElement('span'); label.textContent = `@${slot.profile.username}`;
        link.append(star, label); item.append(link); list.append(item);
      }
      region.append(title, list);
      const navigation = header.querySelector(':scope > nav, :scope > .navii');
      header.insertBefore(region, navigation);
    }
  } catch { console.warn('Featured account links could not be loaded.'); }
}

initFeaturedAccounts();
