// ./js/followersTotal.js
const totals = {
  youtube: 0,
  twitch: 0,
  instagram: 0,
  facebook: 0,
  tiktok: 0, // future-proof
  twitter: 0 // future-proof
};

function toInt(n) {
  const v = Number(n);
  return Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
}

function render() {
  const el = document.getElementById('total-followers');
  if (!el) return;
  const sum = Object.values(totals).reduce((a, b) => a + b, 0);
  el.textContent = sum.toLocaleString();
  el.title = `Combined audience across linked accounts (not deduped)`;
}

export function updateFollowersTotal(source, count) {
  totals[source] = toInt(count);
  render();
}

// Make available to non-module code too if needed:
window.__followersTotal = { update: updateFollowersTotal };

// render once on load in case some platforms aren’t connected
document.addEventListener('DOMContentLoaded', render);
