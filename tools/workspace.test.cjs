const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(
  path.join(__dirname, "../js/campaignSummary.js"),
  "utf8",
);
const summarize = vm.runInNewContext(
  source.replace("export function", "function") + "; summarizeCampaigns",
);
test("only completed campaigns contribute to completed value", () => {
  const summary = summarize([
    { status: "pending", offer_amount: 1000 },
    { status: "accepted", offer_amount: 500 },
    { status: "completed", offer_amount: "200.50" },
    { status: "review_completed", offer_amount: 100 },
    { status: "rejected", offer_amount: 999 },
    { status: "Offer Cancelled", offer_amount: 999 },
  ]);
  assert.equal(summary.completedValue, 300.5);
  assert.equal(summary.completed, 2);
  assert.equal(summary.active, 2);
  assert.equal(summary.accepted, 3);
});
test("invalid monetary values cannot poison dashboard totals", () => {
  const summary = summarize(
    [NaN, Infinity, -1, "invalid"].map((offer_amount) => ({
      status: "completed",
      offer_amount,
    })),
  );
  assert.equal(summary.completedValue, 0);
  assert.equal(summarize().total, 0);
});
test("preview is independent of accounts and outbound analytics", () => {
  const demo = fs.readFileSync(path.join(__dirname, "../js/guest.js"), "utf8");
  assert.doesNotMatch(
    demo,
    /\bfetch\s*\(|supabaseClient|ipapi|XMLHttpRequest|sendBeacon/,
  );
  const html = fs.readFileSync(path.join(__dirname, "../guest.html"), "utf8");
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, "preview IDs must be unique");
});

const presentation = vm.runInNewContext(
  fs
    .readFileSync(path.join(__dirname, "../js/safePresentation.js"), "utf8")
    .replaceAll("export function", "function") +
    "; ({escapeHtml, safeImageUrl, ratingStars})",
  { URL },
);
test("public stats text and image attributes cannot inject HTML", () => {
  assert.equal(
    presentation.escapeHtml('<img src=x onerror="alert(1)">'),
    "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;",
  );
  for (const url of [
    "javascript:alert(1)",
    "data:image/svg+xml,test",
    "http://example.com/a.png",
    "https://user:pass@example.com/a.png",
  ])
    assert.equal(presentation.safeImageUrl(url), "logos.png");
  assert.equal(
    presentation.safeImageUrl("https://example.com/a.png"),
    "https://example.com/a.png",
  );
  assert.equal(presentation.ratingStars(Infinity), "");
  assert.equal(presentation.ratingStars(-1), "");
  assert.equal(presentation.ratingStars(10000000), "★★★★★");
});

test("checkout return has one fulfillment handler and safe spotlight output", async () => {
  const html = fs.readFileSync(
    path.join(__dirname, "../payment-success.html"),
    "utf8",
  );
  const modules = [
    ...html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g),
  ];
  assert.equal(modules.length, 1);
  const listeners = [];
  const status = { innerHTML: "", textContent: "" };
  const context = vm.createContext({
    document: {
      getElementById: () => status,
      addEventListener: (name, fn) => listeners.push(fn),
    },
    window: {
      location: { href: "https://sponsorsorter.com/payment-success.html" },
    },
    URL,
    escapeHtml: presentation.escapeHtml,
    console,
  });
  vm.runInContext(modules[0][1].replace(/^import .*;$/gm, ""), context);
  assert.equal(listeners.length, 1);
  await listeners[0]();
  assert.match(status.innerHTML, /No valid payment/);
  vm.runInContext(
    "renderPremiumResult({slotIndex: '<img src=x onerror=alert(1)>'})",
    context,
  );
  assert.doesNotMatch(
    status.innerHTML,
    /<img|purchase confirmed|spotlight is scheduled/,
  );
  assert.match(status.innerHTML, /verification needed/);
});

test("public community stats never query private tables and handle errors", async () => {
  const source = fs.readFileSync(
    path.join(__dirname, "../js/stats.js"),
    "utf8",
  );
  assert.doesNotMatch(
    source,
    /\.from\(["'](?:private_offers|private_offer_reviews|payouts|users_extended_data|referral_rewards)["']\)/,
  );
  const html = fs.readFileSync(path.join(__dirname, "../stats.html"), "utf8");
  for (const fail of [false, true]) {
    const nodes = new Map();
    let run;
    const context = {
      document: {
        addEventListener: (_, fn) => {
          run = fn;
        },
        getElementById: (id) => {
          assert.ok(html.includes(`id="${id}"`), `Missing ${id}`);
          if (!nodes.has(id)) nodes.set(id, { textContent: "", innerHTML: "" });
          return nodes.get(id);
        },
      },
      escapeHtml: presentation.escapeHtml,
      ratingStars: presentation.ratingStars,
      supabase: {
        from(table) {
          assert.ok(
            [
              "public_offers",
              "public_user_profiles",
              "public_profile_reviews",
            ].includes(table),
          );
          const q = new Proxy(
            {},
            {
              get: (_, key) =>
                key === "then"
                  ? (resolve) =>
                      resolve({
                        error: fail ? {} : null,
                        count: 2,
                        data: [
                          {
                            username: "<img src=x>",
                            review_text: "<script>bad</script>",
                            rating: 5,
                            avg_rating: 5,
                            review_count: 2,
                          },
                        ],
                      })
                  : () => q,
            },
          );
          return q;
        },
      },
    };
    vm.runInNewContext(source.replace(/^import .*;\r?\n/gm, ""), context);
    await run();
    assert.equal(
      nodes.get("system-status").textContent,
      fail ? "Public data unavailable" : "Public data loaded",
    );
    if (fail) assert.equal(nodes.get("live-offer-count").textContent, "—");
    for (const node of nodes.values())
      assert.doesNotMatch(node.innerHTML, /<img|<script>/);
  }
});

test("public profile links reject malformed slugs and sharing handles clipboard failures", async () => {
  const source = fs.readFileSync(
    path.join(__dirname, "../js/publicProfileSharing.js"),
    "utf8",
  );
  const handlers = {};
  const nodes = Object.fromEntries(
    [
      "public-share-url",
      "public-copy-link",
      "public-share-link",
      "public-share-status",
    ].map((id) => [
      id,
      {
        addEventListener: (event, callback) => {
          handlers[id] = callback;
        },
        focus() {
          this.focused = true;
        },
        select() {
          this.selected = true;
        },
      },
    ]),
  );
  let copied;
  const context = vm.createContext({
    URL,
    URLSearchParams,
    location: { origin: "https://sponsorsorter.com" },
    document: { getElementById: (id) => nodes[id] },
    navigator: {
      clipboard: {
        writeText: async (value) => {
          copied = value;
        },
      },
    },
  });
  vm.runInContext(
    source.replaceAll("export function", "function") +
      ";this.sharing={publicProfileUrl,profileSlug,wireProfileSharing}",
    context,
  );
  const api = context.sharing;
  assert.equal(
    api.publicProfileUrl("fitstyle", "https://sponsorsorter.com"),
    "https://sponsorsorter.com/u/index.html?u=fitstyle",
  );
  for (const bad of ["", "ab", "<img>", "a/b", "a%20b", "a".repeat(41)])
    assert.equal(api.publicProfileUrl(bad, "https://sponsorsorter.com"), "");
  assert.equal(api.profileSlug("?u=fitstyle", "/u/index.html"), "fitstyle");
  assert.equal(api.profileSlug("?u=%E0%A4%A", "/u/index.html"), "");
  assert.equal(api.profileSlug("", "/u/%E0%A4%A"), "");
  assert.equal(api.profileSlug("", "/u/fitstyle"), "fitstyle");
  api.wireProfileSharing({ slug: "fitstyle", username: "Test" });
  assert.equal(nodes["public-share-link"].hidden, true);
  await handlers["public-copy-link"]();
  assert.equal(copied, "https://sponsorsorter.com/u/index.html?u=fitstyle");
  context.navigator.clipboard.writeText = async () => {
    throw new Error("Denied");
  };
  await handlers["public-copy-link"]();
  assert.equal(nodes["public-share-url"].selected, true);
  assert.match(nodes["public-share-status"].textContent, /Select and copy/);
  context.navigator.share = async () => {
    const e = new Error();
    e.name = "AbortError";
    throw e;
  };
  api.wireProfileSharing({ slug: "fitstyle", username: "Test" });
  assert.equal(nodes["public-share-link"].hidden, false);
  await handlers["public-share-link"]();
});

test("public deal rows escape user-supplied text", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "../js/publicDashboard.js"),
    "utf8",
  );
  const rows = [];
  const table = { innerHTML: "", appendChild() {} };
  const context = {
    document: {
      getElementById: () => table,
      createDocumentFragment: () => ({ appendChild: (row) => rows.push(row) }),
      createElement: () => ({ innerHTML: "" }),
    },
    escapeHtml: presentation.escapeHtml,
  };
  const start = source.indexOf("function renderRecentDeals(");
  const end = source.indexOf("function renderReviews(");
  vm.runInNewContext(
    "const $=id=>document.getElementById(id);" +
      source.slice(start, end) +
      ";renderRecentDeals([{sponsee_username:'<img src=x>',status:'<script>',deadline:'<svg>',live_date:'<iframe>'}]); renderHistory([{sponsee_username:'<img>',deadline:'<svg>',sponsor_to_sponsee:'<script>',sponsee_to_sponsor:'<iframe>'}]);",
    context,
  );
  assert.equal(rows.length, 2);
  for (const row of rows)
    assert.doesNotMatch(row.innerHTML, /<img|<script|<svg|<iframe/);
});


function snapshotFixture(row, writeFails = false) {
  const writes = [];
  const query = { select() { return this; }, eq() { return this; },
    maybeSingle: async () => ({data: row, error: null}),
    upsert(payload) { writes.push(payload); return { select() { return {
      maybeSingle: async () => ({data: payload, error: writeFails ? new Error('denied') : null})
    }; } }; }
  };
  const context = { URL, TextEncoder, console, supabase: {
    from: () => query, auth: {getSession: async () => ({data:{session:{user:{id:'fixture'}}}})}
  }};
  const source = fs.readFileSync(path.join(__dirname, '../js/statsnap.js'), 'utf8')
    .replace(/^import .*;\r?\n/gm, '').replace(/export /g, '');
  vm.runInNewContext(source, context);
  return {context, writes};
}

test('cached content metrics survive a denied bookkeeping write and retain freshness', async () => {
  const row = {last_stats:{metrics:{views:123, likes:9, comments:4}},
    last_success_at:'2026-10-01T00:00:00Z'};
  const {context} = snapshotFixture(row, true);
  const result = await context.statsnapFallback({originalUrl:'https://youtu.be/example'});
  assert.equal(result.metrics.views, 123);
  assert.equal(result.metrics.likes, 9);
  assert.equal(result.metrics.lastSuccessAt, row.last_success_at);
});

test('successful unchanged metrics update the successful check timestamp', async () => {
  const fixture = snapshotFixture(null);
  const args = {originalUrl:'https://youtu.be/example', liveMetrics:{views:123}};
  const first = await fixture.context.statsnapSaveAfterSuccess(args);
  const {context, writes} = snapshotFixture({...first, last_success_at:'2020-01-01T00:00:00Z'});
  await context.statsnapSaveAfterSuccess(args);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].last_success_at, writes[0].last_checked_at);
  assert.notEqual(writes[0].last_success_at, '2020-01-01T00:00:00Z');
});

test('completed campaign performance remains available on both dashboards after review', () => {
  for (const file of ['sponsorOffers', 'sponseeOffers']) {
    const source = fs.readFileSync(path.join(__dirname, '../js/' + file + '.js'), 'utf8');
    assert.match(source, /Number\(offer.stage\) >= 4/);
    assert.match(source, /Content Performance/);
    assert.match(source, /Refresh attempted:/);
    assert.doesNotMatch(source, /reviewedOfferIds.includes\(offer.id\)\) return false/);
    assert.doesNotMatch(source, /if \(!sponseeReview\)/);
  }
});
