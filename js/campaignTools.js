// Shared campaign controls operate on already authorised dashboard data.
const timestamp = value => value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;
export function selectCampaigns(offers, options = {}, now = Date.now()) {
  const query = String(options.query || '').trim().toLowerCase();
  const result = offers.filter(offer => {
    const searchable = [offer.offer_title, offer.sponsor_username, offer.sponsee_username, offer.sponsor_company].filter(Boolean).join(' ').toLowerCase();
    if (query && !searchable.includes(query)) return false;
    if (!options.deadline || options.deadline === 'all') return true;
    if (offer.archived || Number(offer.stage) >= 5 || /completed|rejected|cancelled|canceled/i.test(offer.status || '')) return false;
    const raw = offer.deadline;
    const due = timestamp(/^\d{4}-\d{2}-\d{2}$/.test(raw || '') ? raw + 'T23:59:59.999' : raw);
    if (due === null) return false;
    return options.deadline === 'overdue' ? due < now : due >= now && due <= now + 7 * 86400000;
  });
  const sort = options.sort || 'newest';
  return result.sort((a, b) => {
    if (sort === 'amount') return (Number(b.offer_amount) || 0) - (Number(a.offer_amount) || 0);
    const key = sort === 'deadline' ? 'deadline' : 'created_at';
    const left = timestamp(a[key]), right = timestamp(b[key]);
    if (left === null) return right === null ? 0 : 1;
    if (right === null) return -1;
    return sort === 'newest' ? right - left : left - right;
  });
}
export function mountCampaignTools(host, onChange) {
  const state = { query: '', sort: 'newest', deadline: 'all' };
  if (!host) return state;
  const toolbar = document.createElement('div');
  toolbar.className = 'campaign-tools';
  toolbar.setAttribute('role', 'search');
  toolbar.setAttribute('aria-label', 'Search sponsorships');
  toolbar.innerHTML = '<label>Search campaigns<input type="search" placeholder="Title or account name" maxlength="160"></label><label>Sort by<select data-control="sort"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="deadline">Deadline first</option><option value="amount">Highest amount</option></select></label><label>Deadline<select data-control="deadline"><option value="all">All deadlines</option><option value="soon">Due in 7 days</option><option value="overdue">Overdue</option></select></label><button type="button">Clear filters</button>';
  const search = toolbar.querySelector('input');
  search.addEventListener('input', () => { state.query = search.value; onChange(); });
  toolbar.querySelectorAll('select').forEach(control => control.addEventListener('change', () => { state[control.dataset.control] = control.value; onChange(); }));
  toolbar.querySelector('button').addEventListener('click', () => {
    Object.assign(state, { query: '', sort: 'newest', deadline: 'all' });
    search.value = '';
    toolbar.querySelector('[data-control="sort"]').value = 'newest';
    toolbar.querySelector('[data-control="deadline"]').value = 'all';
    onChange();
    search.focus();
  });
  host.before(toolbar);
  return state;
}
