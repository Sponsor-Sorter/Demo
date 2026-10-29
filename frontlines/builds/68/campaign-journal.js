/* Small synchronous recovery journal; the engine still owns its normal save file. */
(function (scope) {
  'use strict';
  const path = scope.location.pathname.replace(/[^/]*$/, '');
  const key = 'frontlines.campaign.v1:' + path;
  scope.FrontlinesCampaignJournal = Object.freeze({
    read() {
      try { return scope.localStorage.getItem(key); } catch (_) { return null; }
    },
    write(payload) {
      if (typeof payload !== 'string' || payload.length > 2 * 1024 * 1024) return false;
      try { scope.localStorage.setItem(key, payload); return true; } catch (_) { return false; }
    }
  });
})(window);
