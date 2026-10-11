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


function draftValidation() {
  const context={URL,Date,Map,Number};
  let source=fs.readFileSync(path.join(__dirname,'../js/offerSubmissions.js'),'utf8');
  source=source.slice(source.indexOf('const BUCKET'),source.indexOf('export function safeCommentElement')).replaceAll('export ','');
  vm.runInNewContext(source,context);
  const workflow=fs.readFileSync(path.join(__dirname,'../js/offerWorkflow.js'),'utf8').replace('export ','');
  vm.runInNewContext(workflow,context);return context;
}

test('draft videos reject empty, oversized and executable attachments',()=>{
  const c=draftValidation();
  assert.equal(c.validateDraftFile({type:'video/mp4',size:50*1024*1024}),'mp4');
  for(const file of [{type:'text/html',size:10},{type:'video/mp4',size:0},{type:'video/mp4',size:50*1024*1024+1}])
    assert.throws(()=>c.validateDraftFile(file));
});

test('publishing requires every agreed platform and rejects spoofed hosts and future dates',()=>{
  const c=draftValidation(),today='2026-10-11';
  const good={url:'https://www.youtube.com/watch?v=fixture',date:'2026-10-10'};
  assert.equal(c.validatePublishedContent([good],['youtube'],today).urls.length,1);
  assert.equal(c.validatePublishedContent([{url:'https://www.snapchat.com/spotlight/fixture',date:good.date}],['snapchat'],today).urls.length,1);
  assert.throws(()=>c.validatePublishedContent([good],['youtube','tiktok'],today));
  for(const url of ['https://youtube.com.evil.invalid/video','javascript:alert(1)','http://youtube.com/watch?v=fixture','https://user:password@youtube.com/watch?v=fixture'])
    assert.throws(()=>c.validatePublishedContent([{...good,url}],['youtube'],today));
  for(const date of ['2026-10-12','2026-02-31','invalid'])
    assert.throws(()=>c.validatePublishedContent([{...good,date}],['youtube'],today));
});

test('offer payment and refund UI cannot mark success before a verified settlement',()=>{
 const creator=fs.readFileSync(path.join(__dirname,'../js/sponseeOffers.js'),'utf8');
 const sponsor=fs.readFileSync(path.join(__dirname,'../js/sponsorOffers.js'),'utf8');
 assert.doesNotMatch(creator,/update\(\{ wallet: newWallet \}\)/);
 assert.doesNotMatch(creator,/update\(\{ stage: 5 \}\)/);
 assert.doesNotMatch(sponsor,/rpc\('increment_wallet_balance'/);
 assert.doesNotMatch(sponsor,/live_date: new Date\(\)/);
 assert.match(creator,/Payment release requires verified funding/);
 assert.match(sponsor,/Automatic refunds are temporarily unavailable/);
});


test('draft upload errors give safe actionable status without leaking server details',()=>{
 const c=draftValidation();
 assert.match(c.draftUploadError({statusCode:'403',message:'SECRET'}).message,/permission denied/);
 assert.match(c.draftUploadError({originalResponse:{getStatus:()=>401}}).message,/session expired/);
 assert.match(c.draftUploadError({status:413}).message,/video size/);
 assert.doesNotMatch(c.draftUploadError({status:500,message:'SECRET'}).message,/SECRET/);
});

test('small draft upload uses private SDK storage without overwriting',async()=>{
 const writes=[];const context={supabase:{auth:{getSession:async()=>({data:{session:{access_token:'test'}}})},storage:{from:bucket=>({upload:async(...args)=>{writes.push({bucket,args});return {error:null};}})}}};
 let source=fs.readFileSync(path.join(__dirname,'../js/offerSubmissions.js'),'utf8');
 source=source.slice(source.indexOf('const BUCKET'),source.indexOf('export async function mountOfferSubmissions')).replaceAll('export ','');
 vm.runInNewContext(source,context);const progress={value:0};
 await context.uploadDraft({size:1024,type:'video/mp4'},'private/path.mp4',progress);
 assert.equal(writes[0].bucket,'offer-submissions');assert.equal(writes[0].args[2].upsert,false);assert.equal(progress.value,100);
});


test('resumable network failures fall back without overriding server denials',async()=>{
 for(const status of [0,403,413]) {
  const writes=[];const context={supabase:{auth:{getSession:async()=>({data:{session:{access_token:'test'}}})},storage:{from:()=>({upload:async(...args)=>{writes.push(args);return {error:null};}})}},Upload:class{constructor(file,options){this.options=options;}start(){this.options.onError({originalResponse:{getStatus:()=>status}});}}};
  let source=fs.readFileSync(path.join(__dirname,'../js/offerSubmissions.js'),'utf8');source=source.slice(source.indexOf('const BUCKET'),source.indexOf('export async function mountOfferSubmissions')).replaceAll('export ','').replace('const { Upload } = await import("https://esm.sh/tus-js-client@4.3.1");','');vm.runInNewContext(source,context);
  const result=context.uploadDraft({size:8*1024*1024,type:'video/mp4'},'test/path.mp4',{value:0});
  if(status) {await assert.rejects(result);assert.equal(writes.length,0);}else{await result;assert.equal(writes.length,1);assert.equal(writes[0][2].upsert,false);}
 }
});


test('header routes turn along orthogonal grid lines in every direction',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../js/connectionGridRoutes.js'),'utf8');const routes=JSON.parse(source.slice(source.indexOf('['),source.lastIndexOf(']')+1));assert.ok(routes.length>=100);const directions=new Set();
 for(const route of routes){const start=/^M(\d+) (\d+)/.exec(route);assert.ok(start);let x=+start[1],y=+start[2],turns=0,previous='';for(const match of route.matchAll(/([HV])(\d+)/g)){const axis=match[1],value=+match[2];if(axis==='H'){directions.add(value>x?'right':'left');x=value;}else{directions.add(value>y?'down':'up');y=value;}if(previous&&axis!==previous)turns++;previous=axis;}assert.ok(turns>=3);assert.ok(x>=180&&x<=1380&&y>=615&&y<=880);}
 assert.equal(directions.size,4);const header=fs.readFileSync(path.join(__dirname,'../js/connectionHeader.js'),'utf8');assert.match(header,/animationiteration/);assert.match(header,/document.hidden/);
});

 test('onboarding stays in the viewport and preserves help preferences',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../js/onboarding.js'),'utf8');
 assert.doesNotMatch(source,/margin-top: 300px/);
 assert.match(source,/calc\(100dvh - 32px\)/);
 assert.match(source,/bubble\.setAttribute\('role', 'dialog'\)/);
 assert.match(source,/event\.key === 'Escape'/);
 assert.doesNotMatch(source,/await setHideHelpBlocks\(true\)/);
 assert.doesNotMatch(source,/window\.location\.href = '\.\/finder\.html'/);
 assert.doesNotMatch(source,/userIsSponsor = utRaw\.includes/);
 });
