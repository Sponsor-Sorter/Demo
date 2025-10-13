// ./js/adminAutoPayouts.js
// Auto-invokes the process-group-payouts Edge Function while the Admin dashboard is open.
// Adds on-page controls + live status, countdown to next try, and last result preview.

import { supabase } from './supabaseClient.js';

// ---------- Config (localStorage-backed) ----------
const CFG_KEYS = {
  enabled: 'adminAutoPayouts:enabled',
  mode: 'adminAutoPayouts:mode',                 // 'dry' | 'run'
  minIntervalMin: 'adminAutoPayouts:minIntervalMin',
  allowLocalhost: 'adminAutoPayouts:allowLocalhost',
  runHours: 'adminAutoPayouts:runHours',         // CSV hours, e.g. '1,13'
  lastRun: 'adminAutoPayouts:lastRun',           // ts
  lastResult: 'adminAutoPayouts:lastResult',     // json
  lastError: 'adminAutoPayouts:lastError',       // string
  lock: 'adminAutoPayouts:lock',                 // {tabId, ts}
};

const DEFAULTS = {
  enabled: true,
  mode: 'dry',
  minIntervalMin: 60,
  allowLocalhost: false,
  runHours: '1', // 01:00 local
};

const RUNTIME = {
  PROD_ORIGINS: ['https://sponsorsorter.com', 'https://www.sponsorsorter.com'],
  LEADER_TTL_MS: 30000,
  HEARTBEAT_MS: 10000,
  CHECK_EVERY_MS: 60000,
  COUNTDOWN_TICK_MS: 1000,
  TAB_ID: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
};

// ---------- Utils ----------
function lsGet(key, fallback = null) {
  const v = localStorage.getItem(key);
  return v === null ? fallback : v;
}
function lsSet(key, v) { localStorage.setItem(key, v); }

function isProdOrigin() {
  const allowLocal = lsGet(CFG_KEYS.allowLocalhost, DEFAULTS.allowLocalhost ? '1' : '0') === '1';
  if (allowLocal) return true;
  return RUNTIME.PROD_ORIGINS.includes(location.origin);
}

function visible() { return document.visibilityState === 'visible'; }

function parseRunHours() {
  const raw = lsGet(CFG_KEYS.runHours, DEFAULTS.runHours) || '';
  return raw.split(',').map(s => s.trim()).filter(Boolean).map(Number).filter(n => Number.isFinite(n) && n >= 0 && n <= 23);
}

function withinRunWindow(date = new Date()) {
  const mode = lsGet(CFG_KEYS.mode, DEFAULTS.mode);
  if (mode !== 'run') return true; // only restrict when actually running payouts
  const hours = parseRunHours();
  if (!hours.length) return true;
  return hours.includes(date.getHours());
}

function acquireLeader() {
  const now = Date.now();
  const raw = lsGet(CFG_KEYS.lock);
  if (raw) {
    try {
      const lock = JSON.parse(raw);
      if (now - (lock.ts || 0) < RUNTIME.LEADER_TTL_MS) {
        return lock.tabId === RUNTIME.TAB_ID; // we are leader already or someone else is
      }
    } catch {}
  }
  lsSet(CFG_KEYS.lock, JSON.stringify({ tabId: RUNTIME.TAB_ID, ts: now }));
  return true;
}
function heartbeatIfLeader() {
  const raw = lsGet(CFG_KEYS.lock);
  if (!raw) return;
  try {
    const lock = JSON.parse(raw);
    if (lock.tabId === RUNTIME.TAB_ID) {
      lsSet(CFG_KEYS.lock, JSON.stringify({ tabId: RUNTIME.TAB_ID, ts: Date.now() }));
    }
  } catch {}
}

async function isAdminUser() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return false;
    // block if impersonating
    if (localStorage.getItem('impersonate_user_id')) return false;

    const { data, error } = await supabase
      .from('users_extended_data')
      .select('is_admin')
      .eq('user_id', uid)
      .maybeSingle();

    if (error) return false;
    const v = String(data?.is_admin ?? '').toLowerCase().trim();
    return v === 'true' || v === 't' || v === '1' || v === 'yes';
  } catch {
    return false;
  }
}

// ---------- UI wiring ----------
function $(id) { return document.getElementById(id); }

function ensurePanel() {
  // If the placeholder isn't present (older HTML), create it under the payouts section
  if (!$('admin-auto-payouts-settings')) {
    const parent = $('admin-payouts-section') || document.body;
    const el = document.createElement('div');
    el.id = 'admin-auto-payouts-settings';
    el.className = 'card';
    el.style.marginTop = '12px';
    el.innerHTML = `
      <div class="card-header"><h3>Auto Group Payouts (while this tab is open)</h3></div>
      <div class="card-body">
        <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-bottom:10px;">
          <label style="display:flex;align-items:center;gap:6px;">
            <input type="checkbox" id="ap-enable"> Enable
          </label>
          <label style="display:flex;align-items:center;gap:6px;">
            Mode:
            <select id="ap-mode">
              <option value="dry">Dry Run</option>
              <option value="run">Run Payouts</option>
            </select>
          </label>
          <label style="display:flex;align-items:center;gap:6px;">
            Min interval (min):
            <input id="ap-interval" type="number" min="5" step="5" style="width:90px;">
          </label>
          <label style="display:flex;align-items:center;gap:6px;">
            Run hours (local, CSV):
            <input id="ap-hours" type="text" placeholder="1,13" style="width:140px;">
          </label>
          <label style="display:flex;align-items:center;gap:6px;">
            Allow localhost:
            <input type="checkbox" id="ap-allow-local">
          </label>
          <button id="ap-force-dry">Force Dry Run Now</button>
          <button id="ap-force-run" style="background:#F6C62E;color:#222;">Force Run Now</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(2,minmax(240px,1fr));gap:10px;">
          <div style="border:1px solid #333;border-radius:8px;padding:10px;">
            <div style="font-weight:700;margin-bottom:6px;">Status</div>
            <div id="ap-status" style="display:grid;grid-template-columns:120px 1fr;gap:4px 10px;">
              <div>Enabled</div><div id="ap-status-enabled">—</div>
              <div>Leader</div><div id="ap-status-leader">—</div>
              <div>Visible</div><div id="ap-status-visible">—</div>
              <div>Admin</div><div id="ap-status-admin">—</div>
              <div>Environment</div><div id="ap-status-env">—</div>
              <div>Mode</div><div id="ap-status-mode">—</div>
              <div>Next try in</div><div id="ap-status-next">—</div>
              <div>Last try</div><div id="ap-status-last">—</div>
            </div>
          </div>
          <div style="border:1px solid #333;border-radius:8px;padding:10px;">
            <div style="font-weight:700;margin-bottom:6px;">Last Result</div>
            <pre id="ap-last-result" style="margin:0;max-height:220px;overflow:auto;background:#0f1116;border:1px solid #333;padding:10px;border-radius:8px;color:#eaeaea;">(none)</pre>
          </div>
        </div>
      </div>
    `;
    parent.appendChild(el);
  }
}

function renderControlsFromLS() {
  $('ap-enable').checked = lsGet(CFG_KEYS.enabled, DEFAULTS.enabled ? '1' : '0') !== '0';
  $('ap-mode').value = lsGet(CFG_KEYS.mode, DEFAULTS.mode);
  $('ap-interval').value = Number(lsGet(CFG_KEYS.minIntervalMin, String(DEFAULTS.minIntervalMin)));
  $('ap-hours').value = lsGet(CFG_KEYS.runHours, DEFAULTS.runHours);
  $('ap-allow-local').checked = lsGet(CFG_KEYS.allowLocalhost, DEFAULTS.allowLocalhost ? '1' : '0') === '1';
}

function setStatusRow({ enabled, leader, isVisible, isAdmin, env, mode, nextStr, lastStr }) {
  $('ap-status-enabled').textContent = enabled ? 'Yes' : 'No';
  $('ap-status-leader').textContent = leader ? 'Yes' : 'No';
  $('ap-status-visible').textContent = isVisible ? 'Yes' : 'No';
  $('ap-status-admin').textContent = isAdmin ? 'Yes' : 'No';
  $('ap-status-env').textContent = env;
  $('ap-status-mode').textContent = mode === 'run' ? 'Run Payouts' : 'Dry Run';
  $('ap-status-next').textContent = nextStr || '—';
  $('ap-status-last').textContent = lastStr || '—';

  const lastJson = lsGet(CFG_KEYS.lastResult);
  $('ap-last-result').textContent = lastJson ? lastJson : (lsGet(CFG_KEYS.lastError) || '(none)');
}

function fmtMs(ms) {
  if (ms <= 0) return 'now';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const ss = s % 60;
  const mm = m % 60;
  if (h) return `${h}h ${mm}m ${ss}s`;
  if (m) return `${m}m ${ss}s`;
  return `${ss}s`;
}

// Compute when the next attempt is allowed, considering min interval + run window
function nextAttemptEtaMs() {
  const last = Number(lsGet(CFG_KEYS.lastRun, '0'));
  const minGapMs = Number(lsGet(CFG_KEYS.minIntervalMin, String(DEFAULTS.minIntervalMin))) * 60 * 1000;
  const base = last ? (last + minGapMs) : Date.now();
  const mode = lsGet(CFG_KEYS.mode, DEFAULTS.mode);
  if (mode !== 'run') return Math.max(0, base - Date.now()); // in dry mode, no hour gating
  // For run mode, find next time >= base whose hour is allowed
  const hours = parseRunHours();
  if (!hours.length) return Math.max(0, base - Date.now());
  let t = new Date(Math.max(base, Date.now()));
  for (let i = 0; i < 48; i++) { // search up to 2 days ahead
    if (hours.includes(t.getHours())) break;
    t = new Date(t.getTime() + 60 * 60 * 1000);
  }
  return Math.max(0, t.getTime() - Date.now());
}

// ---------- Core auto-run ----------
async function callFn(dry_run) {
  const { data, error } = await supabase.functions.invoke('process-group-payouts', { body: { dry_run } });
  if (error) {
    lsSet(CFG_KEYS.lastError, JSON.stringify(error, null, 2));
    lsSet(CFG_KEYS.lastResult, '');
    return { ok: false, error };
  }
  lsSet(CFG_KEYS.lastError, '');
  lsSet(CFG_KEYS.lastResult, JSON.stringify(data, null, 2));
  return { ok: true, data };
}

async function tick() {
  try {
    const enabled = lsGet(CFG_KEYS.enabled, DEFAULTS.enabled ? '1' : '0') !== '0';
    if (!enabled) return;
    if (!$('admin-payouts-section')) return;
    if (!isProdOrigin()) return;
    if (!acquireLeader()) return;
    if (!visible()) return;

    const isAdmin = await isAdminUser();
    if (!isAdmin) return;

    // Respect spacing
    const last = Number(lsGet(CFG_KEYS.lastRun, '0'));
    const minGapMs = Number(lsGet(CFG_KEYS.minIntervalMin, String(DEFAULTS.minIntervalMin))) * 60 * 1000;
    if (Date.now() - last < minGapMs) return;

    if (!withinRunWindow()) return;

    const mode = lsGet(CFG_KEYS.mode, DEFAULTS.mode);
    const dry_run = mode !== 'run';

    const res = await callFn(dry_run);
    lsSet(CFG_KEYS.lastRun, String(Date.now()));

    // Optional toast
    try {
      const message = dry_run ? 'Auto Dry Run complete' : 'Auto Payouts processed';
      if (res.ok) {
        // eslint-disable-next-line no-undef
        notifyPayout?.({ type: 'success', title: 'Group payouts', message });
      } else {
        // eslint-disable-next-line no-undef
        notifyPayout?.({ type: 'error', title: 'Group payouts', message: 'Error (see log)' });
      }
    } catch {}
  } catch (err) {
    lsSet(CFG_KEYS.lastError, String(err?.message || err));
  }
}

// ---------- Event handlers ----------
function bindControls() {
  $('ap-enable').addEventListener('change', (e) => {
    lsSet(CFG_KEYS.enabled, e.target.checked ? '1' : '0');
  });
  $('ap-mode').addEventListener('change', (e) => {
    lsSet(CFG_KEYS.mode, e.target.value);
  });
  $('ap-interval').addEventListener('change', (e) => {
    const v = Math.max(5, Number(e.target.value || DEFAULTS.minIntervalMin));
    e.target.value = v;
    lsSet(CFG_KEYS.minIntervalMin, String(v));
  });
  $('ap-hours').addEventListener('change', (e) => {
    lsSet(CFG_KEYS.runHours, e.target.value || DEFAULTS.runHours);
  });
  $('ap-allow-local').addEventListener('change', (e) => {
    lsSet(CFG_KEYS.allowLocalhost, e.target.checked ? '1' : '0');
  });

  $('ap-force-dry').addEventListener('click', async () => {
    const res = await callFn(true);
    if (res.ok) lsSet(CFG_KEYS.lastRun, String(Date.now()));
  });
  $('ap-force-run').addEventListener('click', async () => {
    if (!confirm('Run group payouts now? This will credit wallets and mark offers as completed.')) return;
    const res = await callFn(false);
    if (res.ok) lsSet(CFG_KEYS.lastRun, String(Date.now()));
  });
}

// ---------- Status & countdown ----------
async function refreshStatusOnce() {
  const enabled = lsGet(CFG_KEYS.enabled, DEFAULTS.enabled ? '1' : '0') !== '0';
  const leader = acquireLeader(); // also takes leadership if free
  const isVisible = visible();
  const admin = await isAdminUser();
  const env = isProdOrigin() ? 'prod' : 'dev/local';
  const mode = lsGet(CFG_KEYS.mode, DEFAULTS.mode);

  const last = Number(lsGet(CFG_KEYS.lastRun, '0'));
  const lastStr = last ? new Date(last).toLocaleString() : '—';
  const eta = nextAttemptEtaMs();
  const nextStr = fmtMs(eta);

  setStatusRow({ enabled, leader, isVisible, isAdmin: admin, env, mode, nextStr, lastStr });
}

function startIntervals() {
  setInterval(heartbeatIfLeader, RUNTIME.HEARTBEAT_MS);
  setInterval(tick, RUNTIME.CHECK_EVERY_MS);
  // status & countdown updating
  setInterval(async () => {
    const enabled = lsGet(CFG_KEYS.enabled, DEFAULTS.enabled ? '1' : '0') !== '0';
    const leader = (function () {
      try {
        const raw = lsGet(CFG_KEYS.lock);
        const lock = raw ? JSON.parse(raw) : null;
        return lock?.tabId === RUNTIME.TAB_ID && (Date.now() - (lock?.ts || 0) < RUNTIME.LEADER_TTL_MS);
      } catch { return false; }
    })();
    const isVisible = visible();
    const admin = await isAdminUser();
    const env = isProdOrigin() ? 'prod' : 'dev/local';
    const mode = lsGet(CFG_KEYS.mode, DEFAULTS.mode);
    const last = Number(lsGet(CFG_KEYS.lastRun, '0'));
    const lastStr = last ? new Date(last).toLocaleString() : '—';
    const nextStr = fmtMs(nextAttemptEtaMs());
    setStatusRow({ enabled, leader, isVisible, isAdmin: admin, env, mode, nextStr, lastStr });
  }, RUNTIME.COUNTDOWN_TICK_MS);
}

// ---------- Boot ----------
(function init() {
  if (!$('admin-payouts-section')) return; // only on Admin page
  ensurePanel();
  renderControlsFromLS();
  bindControls();

  document.addEventListener('visibilitychange', () => { if (visible()) tick(); });
  window.addEventListener('focus', tick);

  // initial pass after a short delay so session is ready
  setTimeout(async () => {
    await refreshStatusOnce();
    startIntervals();
    // kick a tick on load (non-blocking)
    tick();
  }, 1200);
})();
