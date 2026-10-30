/* Small synchronous recovery journal; the engine still owns its normal save file. */
(function (scope) {
  'use strict';
  const path = scope.location.pathname.replace(/[^/]*$/, '');
  const legacyKey = 'frontlines.campaign.v1:' + path;
  const key = 'frontlines.skirmish.v1';
  // Career progress has one stable origin key across browser build URLs.
  const careerKey = 'frontlines.career.v69';
  scope.FrontlinesCampaignJournal = Object.freeze({
    read() {
      try {
        const stable = scope.localStorage.getItem(key);
        if (stable) return stable;
        const here = scope.localStorage.getItem(legacyKey);
        if (here) return here;
        const previous = Object.keys(scope.localStorage)
          .filter(k => /^frontlines\.campaign\.v1:\/frontlines\/builds\/\d+\/$/.test(k))
          .sort((a, b) => Number(b.match(/(\d+)\/$/)[1]) - Number(a.match(/(\d+)\/$/)[1]));
        return previous.length ? scope.localStorage.getItem(previous[0]) : null;
      } catch (_) { return null; }
    },
    readCareer() {
      try { return scope.localStorage.getItem(careerKey); } catch (_) { return null; }
    },
    writeCareer(payload) {
      if (typeof payload !== 'string' || payload.length > 2 * 1024 * 1024) return false;
      try { scope.localStorage.setItem(careerKey, payload); return true; } catch (_) { return false; }
    },
    write(payload) {
      if (typeof payload !== 'string' || payload.length > 2 * 1024 * 1024) return false;
      try { scope.localStorage.setItem(key, payload); return true; } catch (_) { return false; }
    }
  });
})(window);
