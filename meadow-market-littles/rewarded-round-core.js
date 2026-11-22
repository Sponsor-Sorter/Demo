/* Optional round receipts are account/game bound; only successful play consumes a credit. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.meadowRewardedRoundCore = factory();
})(globalThis, () => {
  'use strict';
  const CONTRACT = 'littles-ad-round-v1', KEY = 'meadow-littles-ad-rounds-v1';
  const id = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
  const gameId = value => typeof value === 'string' && /^[a-z0-9_-]{1,80}$/.test(value);
  const actorId = value => typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(value);
  function create(options) {
    const { context, policy, prepare, show, settle, verifyGrant, storage } = options;
    const now = options.now || Date.now, uuid = options.uuid || (() => crypto.randomUUID());
    let generation = 0, busy = false, phase = 'idle';
    function read() {
      try {
        const raw = storage.getItem(KEY), value = raw ? JSON.parse(raw) : { version: 1, grants: [], pending: [] };
        if (value.version !== 1 || !Array.isArray(value.grants) || !Array.isArray(value.pending) || value.grants.length > 1000 || value.pending.length > 1000) return null;
        if (value.grants.some(r => !actorId(r.actor) || !gameId(r.game) || !id(r.transaction) || !id(r.challenge) || typeof r.used !== 'boolean' || !Number.isSafeInteger(r.expiresAt))) return null;
        if (value.pending.some(r => !actorId(r.actor) || !gameId(r.game) || !id(r.challenge) || !Number.isSafeInteger(r.expiresAt))) return null;
        // A claimed unused credit remains available; expired receipt replay cannot restore a used one.
        value.grants = value.grants.filter(r => !r.used || r.expiresAt > now());
        value.pending = value.pending.filter(r => r.expiresAt + 86400000 > now());
        return value;
      } catch { return null; }
    }
    function write(value) { try { storage.setItem(KEY, JSON.stringify(value)); return true; } catch { return false; } }
    function scope(game) {
      const c = context();
      return gameId(game) && actorId(c.actor) ? { actor: c.actor, game, generation } : null;
    }
    const same = s => s && s.generation === generation && context().actor === s.actor;
    const eligiblePolicy = p => p?.enabled === true && p.contract === CONTRACT && p.formatReviewed === true &&
      Number.isSafeInteger(p.requiredCloseMs) && p.requiredCloseMs > 0 && p.requiredCloseMs <= 5000 &&
      typeof p.eligibilityEvidence === 'string' && p.eligibilityEvidence.startsWith('https://') &&
      typeof p.unit === 'string' && /^ca-app-pub-\d+\/\d+$/.test(p.unit);
    function remaining(game) {
      const s = scope(game), value = read();
      if (!s || !value || context().plus) return 0;
      return value.grants.filter(r => r.actor === s.actor && r.game === game && !r.used).length;
    }
    function availability(game, requireConsent) {
      const s = scope(game), c = context(), p = policy(), value = read();
      return !!(s && value && !busy && !c.plus && c.parentReady && (!requireConsent || c.canRequestAds) && c.remainingBaseRounds(game) === 0 &&
        eligiblePolicy(p) &&
        typeof prepare === 'function' && typeof show === 'function' && typeof settle === 'function' && typeof verifyGrant === 'function' &&
        remaining(game) === 0 && !value.pending.some(r => r.actor === s.actor && r.game === game && r.expiresAt > now()));
    }
    const available = game => availability(game, true);
    const canCheck = game => availability(game, false);
    function removePending(s, challenge) {
      const value = read(); if (!value) return false;
      value.pending = value.pending.filter(r => !(r.actor === s.actor && r.game === s.game && r.challenge === challenge));
      return write(value);
    }
    async function claim(s, pending) {
      const receipt = await settle({ actor: s.actor, game: s.game, challenge: pending.challenge });
      if (!same(s)) return { status: 'account_changed' };
      if (!receipt || receipt.status === 'pending') return { status: 'pending' };
      if (receipt.status === 'cancelled' || receipt.status === 'expired') {
        return { status: removePending(s, pending.challenge) ? receipt.status : 'storage_unavailable' };
      }
      const valid = receipt.contract === CONTRACT && receipt.actor === s.actor && receipt.game === s.game &&
        receipt.challenge === pending.challenge && id(receipt.transaction) && receipt.amount === 1 &&
        Number.isSafeInteger(receipt.expiresAt) && receipt.expiresAt > now() && receipt.expiresAt <= now() + 86400000;
      if (!valid || await verifyGrant(receipt, { actor: s.actor, game: s.game, challenge: pending.challenge }) !== true) return { status: 'unverified' };
      if (!same(s)) return { status: 'account_changed' };
      const value = read(); if (!value) return { status: 'storage_unavailable' };
      const prior = value.grants.find(r => r.transaction === receipt.transaction);
      if (prior && (prior.actor !== s.actor || prior.game !== s.game || prior.challenge !== pending.challenge)) return { status: 'unverified' };
      if (!prior) value.grants.push({ actor: s.actor, game: s.game, challenge: pending.challenge, transaction: receipt.transaction, expiresAt: receipt.expiresAt, used: false });
      value.pending = value.pending.filter(r => !(r.actor === s.actor && r.game === s.game && r.challenge === pending.challenge));
      if (!write(value)) return { status: 'storage_unavailable' };
      return { status: prior ? 'already_claimed' : 'ready', game: s.game, amount: prior ? 0 : 1 };
    }
    async function watch(game) {
      if (!available(game)) return { status: 'unavailable' };
      const s = scope(game), selectedPolicy = policy(); let retained = false; busy = true; phase = 'preparing';
      try {
        const prepared = await prepare({ game, requestId: uuid() });
        if (!same(s)) return { status: 'account_changed' };
        const current = policy(), c = context();
        if (!eligiblePolicy(current) || current.unit !== selectedPolicy.unit || c.plus || !c.parentReady || !c.canRequestAds || c.remainingBaseRounds(game) !== 0) return { status: 'unavailable' };
        if (prepared?.contract !== CONTRACT || prepared.actor !== s.actor || prepared.game !== game || !id(prepared.challenge) || prepared.unit !== selectedPolicy.unit || !Number.isSafeInteger(prepared.expiresAt) || prepared.expiresAt <= now()) return { status: 'unverified' };
        const pending = { actor: s.actor, game, challenge: prepared.challenge, expiresAt: prepared.expiresAt }, value = read();
        if (!value) return { status: 'storage_unavailable' };
        value.pending.push(pending);
        if (!write(value)) return { status: 'storage_unavailable' };
        retained = true; phase = 'showing';
        const result = await show({ unit: prepared.unit, challenge: prepared.challenge });
        if (!same(s)) return { status: 'account_changed' };
        if (result?.closed !== true) return { status: 'pending' };
        if (result.earned !== true) return { status: removePending(s, pending.challenge) ? result.unavailable ? 'unavailable' : 'cancelled' : 'storage_unavailable' };
        phase = 'verifying'; return await claim(s, pending);
      } catch { return { status: retained ? 'pending' : 'unavailable' }; }
      finally { busy = false; phase = 'idle'; }
    }
    async function recover(game) {
      const s = scope(game), value = read();
      if (!s || !value || busy) return { status: 'unavailable' };
      const pending = value.pending.filter(r => r.actor === s.actor && r.game === game);
      if (!pending.length) return { status: 'nothing_pending' };
      busy = true; phase = 'verifying';
      try { let result = { status: 'pending' };for (const request of pending) {const checked = await claim(s, request);if (!same(s)) return { status: 'account_changed' };if (checked.status === 'ready' || result.status !== 'ready') result = checked;}return result; } catch { return { status: 'pending' }; }
      finally { busy = false; phase = 'idle'; }
    }
    function begin(game) {
      const s = scope(game), value = read();
      if (!s || !value || context().plus || context().remainingBaseRounds(game) !== 0) return null;
      const grant = value.grants.find(r => r.actor === s.actor && r.game === game && !r.used);
      return grant ? Object.freeze({ actor: s.actor, game, transaction: grant.transaction, generation }) : null;
    }
    function complete(ticket) {
      const value = read();
      if (!ticket || !value || ticket.generation !== generation || context().plus || context().actor !== ticket.actor || context().remainingBaseRounds(ticket.game) !== 0) return false;
      const grant = value.grants.find(r => r.actor === ticket.actor && r.game === ticket.game && r.transaction === ticket.transaction && !r.used);
      if (!grant) return false;
      grant.used = true; return write(value);
    }
    const pendingGames = () => [...new Set((read()?.pending || []).filter(r => r.actor === context().actor).map(r => r.game))];
    return { available, canCheck, watch, recover, remaining, begin, complete, pendingGames, accountChanged: () => { generation++; }, getStatus: () => ({ busy, phase }) };
  }
  return { create, CONTRACT, KEY };
});
