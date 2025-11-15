// ./js/supportersWall.js
import { supabase } from './supabaseClient.js';

/**
 * Simple HTML escaper so supporter messages/names can't break the page.
 */
function escapeHtml(str = '') {
  return String(str).replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case '\'': return '&#39;';
      default:  return ch;
    }
  });
}

/**
 * Return the exact crown HTML snippet for the given level.
 * 1 = Bronze, 2 = Silver, 3+ = Gold.
 */
function crownHtmlForLevel(level) {
  if (level >= 3) {
    // Gold
    return `
<span class="badge badge-crown badge-gold" title="Champion" style="margin-bottom: 8px; border-left-width: 1px; border-top-width: 1px;">
  <img src="./crown-gold.png"
       alt="Champion crown"
       style="height:21px;width:21px;vertical-align:middle;display:inline-block;margin-right:6px;border-radius:4px;margin-bottom:5px;">
</span>`;
  }

  if (level === 2) {
    // Silver
    return `
<span class="badge badge-crown badge-silver" title="Founder" style="margin-bottom: 8px; border-left-width: 1px; border-top-width: 1px;">
  <img src="./crown-silver.png"
       alt="Founder crown"
       style="height:21px;width:21px;vertical-align:middle;display:inline-block;margin-right:6px;border-radius:4px;margin-bottom:5px;">
</span>`;
  }

  // Bronze (default)
  return `
<span class="badge badge-crown badge-bronze" title="Supporter" style="margin-bottom: 8px; border-left-width: 1px; border-top-width: 1px;">
  <img src="./crown-bronze.png"
       alt="Supporter crown"
       style="height:21px;width:21px;vertical-align:middle;display:inline-block;margin-right:6px;border-radius:4px;margin-bottom:5px;">
</span>`;
}

/**
 * Load public supporters from Supabase and render them into the wall.
 * Expects a table called `supporter_wall`.
 */
async function loadSupporterWall() {
  const listEl = document.getElementById('supporter-wall-list');
  const emptyEl = document.getElementById('supporter-wall-empty');

  if (!listEl) return;

  if (emptyEl) emptyEl.style.display = 'none';
  listEl.innerHTML = '<p class="supporter-wall-loading">Loading supporters…</p>';

  try {
    const { data, error } = await supabase
      .from('supporter_wall')
      .select('display_name,badge_level,message,created_at')
      .eq('is_public', true)
      .order('created_at', { ascending: true })
      .limit(200);

    if (error) throw error;

    if (!data || data.length === 0) {
      listEl.innerHTML = '';
      if (emptyEl) emptyEl.style.display = 'block';
      return;
    }

    const cards = data.map((row, index) => {
      const lvl = Number(row.badge_level) || 1;
      const label =
        lvl >= 3 ? 'Founding Supporter' :
        (lvl === 2 ? 'Super Supporter' : 'Early Supporter');

      const name = escapeHtml(row.display_name || 'Anonymous supporter');
      const msg  = row.message ? escapeHtml(row.message) : '';
      const n    = index + 1;

      const crownHtml = crownHtmlForLevel(lvl);

      return `
        <article class="supporter-wall-card supporter-level-${lvl}">
          <div class="supporter-wall-rank">#${n}</div>
          <div class="supporter-wall-header">
            <div class="supporter-wall-badge-icon">
              ${crownHtml}
            </div>
            <div class="supporter-wall-meta">
              <div class="supporter-wall-name">${name}</div>
              <div class="supporter-wall-badge">${label}</div>
            </div>
          </div>
          ${msg ? `<p class="supporter-wall-message">"${msg}"</p>` : ''}
        </article>
      `;
    });

    listEl.innerHTML = cards.join('');
    if (emptyEl) emptyEl.style.display = 'none';
  } catch (err) {
    console.warn('Could not load supporter wall:', err);
    listEl.innerHTML = '';
    if (emptyEl) {
      emptyEl.textContent = 'Early supporters will appear here soon.';
      emptyEl.style.display = 'block';
    }
  }
}

document.addEventListener('DOMContentLoaded', loadSupporterWall);
