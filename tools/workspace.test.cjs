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
  const context = { URL, TextEncoder, console, observedMetrics: input => input, supabase: {
    from: () => query, auth: {getSession: async () => ({data:{session:{user:{id:'fixture'}}}})}
  }};
  const source = fs.readFileSync(path.join(__dirname, '../js/statsnap.js'), 'utf8')
    .replace(/^import[\s\S]*?;\r?\n/gm, '').replace(/export /g, '');
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

test('signup review reflects role and plan without interpreting profile text as HTML',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../signup.html'),'utf8');
 const script=html.slice(html.indexOf('function showStep(step)'),html.indexOf('// Validate the current panel'));
 const elements={};
 function element(){return {value:'',style:{},children:[],classList:{toggle(){}},setAttribute(){},removeAttribute(){},replaceChildren(){this.children=[]},append(...children){this.children.push(...children)}};}
 for(const id of ['userType','planType','username','email','signup-review','pay-heading','pay-copy','confirm-payment-label','confirm-payment']) elements[id]=element();
 const submit=element();
 const ctx={document:{getElementById:id=>elements[id],querySelectorAll:()=>[],querySelector:()=>submit,createElement:element},window:{scrollTo(){}}};
 vm.createContext(ctx);vm.runInContext(script,ctx);
 elements.username.value='<img src=x onerror=alert(1)>';elements.email.value='qa@example.com';
 elements.userType.value='sponsor';elements.planType.value='pro';ctx.showStep(3);
 assert.equal(submit.textContent,'Continue to Stripe');assert.equal(elements['confirm-payment'].required,true);
 assert.equal(elements['signup-review'].children[1].textContent,elements.username.value);
 assert.equal(elements['signup-review'].children[7].textContent,'Pro — US$10/month');
 elements.userType.value='besponsored';elements.planType.value='free';ctx.showStep(3);
 assert.equal(submit.textContent,'Create free account');assert.equal(elements['confirm-payment'].required,false);
 assert.equal(elements['signup-review'].children[7].textContent,'Free — US$0/month');
 elements.userType.value='sponsor';elements.planType.value='pro';ctx.showStep(3);
 assert.equal(elements['signup-review'].children.length,10);assert.equal(submit.textContent,'Continue to Stripe');
});

test('signup role panels hide inactive controls and remove fixed-height layout',()=>{
 const css=fs.readFileSync(path.join(__dirname,'../signup-layout.css'),'utf8');
 assert.match(css,/#besponsored-options\.slide-off\s*\{\s*display: none;/);
 assert.match(css,/height: auto !important/);
 assert.match(css,/grid-template-columns: 24px minmax\(0, 1fr\) 20px/);
 const html=fs.readFileSync(path.join(__dirname,'../signup.html'),'utf8');
 assert.doesNotMatch(html,/upload\.wikimedia\.org/);
 assert.match(html,/src="\.\/instagramlogo\.png"/);
});

test('every deployed page has the canonical footer and shared brand assets',()=>{
 const root=path.join(__dirname,'..');
 const template=fs.readFileSync(path.join(__dirname,'site-footer.html'),'utf8').trim();
 for(const file of [...fs.readdirSync(root).filter(f=>f.endsWith('.html')),'u/index.html']) {
  const html=fs.readFileSync(path.join(root,file),'utf8');if(!/<body\b/i.test(html))continue;
  const base=file.includes('/')?'../':'./';
  assert.ok(html.replaceAll('\r\n','\n').includes(template.replaceAll('\r\n','\n').replaceAll('{{base}}',base)),file);
  assert.equal((html.match(/<footer\b/g)||[]).length,1,file);
  assert.ok(html.includes('site-shell.css'),file);assert.ok(html.includes('connectionHeader.js'),file);
  assert.ok(html.includes('id="site-top"'),file);
 }
 for(const [,href] of template.matchAll(/href="{{base}}([^"#?]+)(?:[#?][^"]*)?"/g))assert.ok(fs.existsSync(path.join(root,href)),href);
 for(const [page,id] of [['privacy.html','deletion'],['privacy.html','cookies'],['terms.html','payments']])assert.ok(fs.readFileSync(path.join(root,page),'utf8').includes('id="'+id+'"'));
});
const campaignToolsSource = fs.readFileSync(path.join(__dirname, '../js/campaignTools.js'), 'utf8');
const selectCampaigns = vm.runInNewContext(campaignToolsSource.replaceAll('export function', 'function') + '; selectCampaigns');
test('campaign search and sorting use all records without mutating the source', () => {
  const offers = [{id:1, offer_title:'Video brief', sponsee_username:'FitStyle', created_at:'2026-10-01', offer_amount:20}, {id:2,offer_title:'Stream',created_at:'2026-10-03',offer_amount:50},{id:3}];
  assert.deepEqual(Array.from(selectCampaigns(offers,{query:'FITSTYLE'}), o=>o.id), [1]);
  assert.deepEqual(Array.from(selectCampaigns(offers,{sort:'newest'}), o=>o.id), [2,1,3]);
  assert.deepEqual(Array.from(selectCampaigns(offers,{sort:'amount'}), o=>o.id), [2,1,3]);
  assert.deepEqual(offers.map(o=>o.id), [1,2,3]);
});
test('deadline filters exclude closed campaigns and keep today available', () => {
  const now = new Date('2026-10-11T12:00:00').getTime();
  const offers = [{id:1,deadline:'2026-10-11',stage:2},{id:2,deadline:'2026-10-10',stage:2},{id:3,deadline:'2026-10-10',status:'completed'},{id:4,deadline:'2026-10-12',archived:true},{id:5,deadline:'invalid'}];
  assert.deepEqual(Array.from(selectCampaigns(offers,{deadline:'overdue'},now),o=>o.id),[2]);
  assert.deepEqual(Array.from(selectCampaigns(offers,{deadline:'soon'},now),o=>o.id),[1]);
});
const finderSource = fs.readFileSync(path.join(__dirname,'../js/finderDiscovery.js'),'utf8');
const finderTools = vm.runInNewContext(finderSource.replaceAll('export function','function') + '; ({cleanFinderFilters,finderMatchReasons,buildFinderQuery,escapeFinderText})');
test('Finder normalises filters and gives factual match reasons',()=>{
 const filters=finderTools.cleanFinderFilters({name:'  FitStyle ',platform:'bad->query',sort:'injected',location:'UK'});
 assert.equal(filters.name,'FitStyle'); assert.equal(filters.platform,'');assert.equal(filters.sort,'az');
 assert.deepEqual(Array.from(finderTools.finderMatchReasons(filters)),['Location: UK']);
 assert.equal(finderTools.escapeFinderText('<img src=x onerror="bad()">'), '&lt;img src=x onerror=&quot;bad()&quot;&gt;');
});
test('Finder filters and orders the public query before pagination',()=>{
 const calls=[];const query=new Proxy({}, {get:(_,method)=>(...args)=>{calls.push([method,...args]);return query;}});
 const client={from:table=>{calls.push(['from',table]);return query;}};
 finderTools.buildFinderQuery(client,'besponsored',finderTools.cleanFinderFilters({name:'a_%',platform:'youtube',sort:'za'}),2,['test-id']);
 assert.equal(calls[0][1],'public_user_directory');
 assert.equal(calls.find(c=>c[0]==='ilike')[2],'%a\\_\\%%');
 assert.equal(calls.find(c=>c[0]==='order')[2].ascending,false);
 assert.deepEqual(calls.at(-1),['range',12,23]);
 assert(calls.find(c=>c[0]==='in' && c[1]==='user_id'));
});
test('Finder layout preserves controls and separates filters from results',()=>{
 const layout=fs.readFileSync(path.join(__dirname,'../js/finderLayout.js'),'utf8');
 assert.match(layout,/filters\.append\(summary, description, form, suggestions\)/);
 assert.match(layout,/resultPanel\.append\(\s*heading,\s*results,\s*document\.getElementById\(["']searchPagination["']\),?\s*\)/);
 assert.match(layout,/form\.requestSubmit\(\)/);
 assert.match(layout,/min-width: 760px/);
 assert.match(finderSource,/results\.before\(status\)/);
});
test('recommendations timeout settles loading and exposes retry even if session stalls', async()=>{
 const source=fs.readFileSync(path.join(__dirname,'../js/recmatch.js'),'utf8').replace(/^import .*;\r?\n/gm,'');
 const node=()=>({children:[],attributes:{},append(...children){this.children.push(...children)},setAttribute(key,value){this.attributes[key]=value},addEventListener(){},replaceChildren(...children){this.children=children}});
 const container=node();let timeout;
 const context={document:{getElementById:id=>id==='recommendedMatches'?container:null,createElement:node,createDocumentFragment:node,addEventListener(){}},supabase:{auth:{getSession:()=>new Promise(()=>{})}},AbortController,setTimeout:callback=>{timeout=callback;return 1},clearTimeout(){}};
 const load=vm.runInNewContext(source+';loadRecommendations',context);
 const pending=load();assert.equal(container.attributes['aria-busy'],'true');timeout();await pending;
 assert.equal(container.attributes['aria-busy'],'false');
 assert.equal(container.children[0].children[1].textContent,'Retry recommendations');
 assert.match(container.children[0].children[0].textContent,/taking too long/);
});
test('supporting profile cards render hostile names as text and keep safe recipient URLs',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../js/finderSupporting.js'),'utf8').replaceAll('export function','function');
 const node=tag=>({tag,children:[],append(...children){this.children.push(...children)},addEventListener(){}});
 const render=vm.runInNewContext(source+';supportingProfileCard',{document:{createElement:node},URL,location:{href:'https://sponsorsorter.com/finder.html'}});
 const card=render({username:'<img onerror=alert(1)>',social_handles:{youtube:'test'}},{isSponsor:true,imageUrl:'javascript:alert(1)'});
 assert.equal(card.children[0].children[0].src,'./logos.png');
 assert.equal(card.children[0].children[1].children[0].textContent,'<img onerror=alert(1)>');
 assert.equal(card.children.at(-1).children[1].href,'newoffer.html?username=%3Cimg%20onerror%3Dalert(1)%3E');
});

 test('partner matching ranks evidence, excludes incompatible requirements and ignores paid plans',async()=>{
 const {rankPartners,terms}=await import('../js/partnerMatching.js');
 const viewer={user_id:'s',userType:'sponsor',contenttype:'Gaming',platforms:['YouTube'],location:'UK',partnership_type:'ongoing',minfollowers:'1k'};
 const good={user_id:'a',username:'A',userType:'besponsored',contenttype:'games',platforms:['youtube'],location:'United Kingdom',partnership_type:'ongoing'};
 const weak={...good,user_id:'b',username:'B',contenttype:'Music',partnership_type:null,location:null,planType:'pro'};
 const wrong={...good,user_id:'c',platforms:['twitch']};
 const matches=rankPartners(viewer,[weak,wrong,good],{followers:{a:1500,b:2000,c:2000}});
 assert.deepEqual(matches.map(m=>m.profile.user_id),['a','b']);
 assert.ok(matches[0].reasons.some(r=>r.includes('Shared content interests')));
 assert.equal(rankPartners(viewer,[good],{followers:{a:50}}).length,0);
 assert.ok(rankPartners(viewer,[good])[0].missing.includes('Follower requirement needs checking'));
 assert.deepEqual(terms('["Gaming","gaming"]'),['games']);
 assert.equal(rankPartners({user_id:'s',userType:'sponsor'},[{user_id:'x',userType:'besponsored'}]).length,0);
 });
 test('creators receive sponsor partners, not themselves or other creators',async()=>{
 const {rankPartners}=await import('../js/partnerMatching.js');
 const me={user_id:'c',userType:'besponsored',contenttype:'Music'};
 const sponsor={user_id:'s',userType:'sponsor',contenttype:'Music'};
 assert.deepEqual(rankPartners(me,[me,sponsor,{...me,user_id:'other'}]).map(m=>m.profile.user_id),['s']);
 });

 test('daily priorities exclude finished records, rank overdue and respect actor roles',async()=>{
 const {attentionItems}=await import('../js/campaignToday.js');
 const now=Date.parse('2026-10-11T12:00:00Z');
 const offers=[{id:'old',stage:2,status:'accepted',deadline:'2026-10-01'},{id:'soon',stage:3,status:'in_progress',deadline:'2026-10-13'},{id:'pending',stage:1,status:'pending'},{id:'done',stage:5,status:'completed',deadline:'2020-01-01'},{id:'archived',stage:2,archived:true},{id:'cancel',stage:2,status:'Offer Cancelled'}];
 const creator=attentionItems(offers,'sponsee',now);
 assert.deepEqual(creator.map(i=>i.offer.id),['old','pending','soon']);
 assert.equal(creator[0].overdue,true);assert.equal(creator[2].soon,true);
 assert.match(creator[1].action,/Review the sponsorship request/);
 assert.match(attentionItems([offers[2]],'sponsor',now)[0].action,/Awaiting creator/);
 assert.equal(offers.length,6);
 });
 test('campaign priority navigation selects the exact ID even with duplicate titles',async()=>{
 const {selectCampaigns}=await import('../js/campaignTools.js');
 const offers=[{id:'a',offer_title:'Same'},{id:'b',offer_title:'Same'}];
 assert.deepEqual(selectCampaigns(offers,{id:'b'}).map(o=>o.id),['b']);
 assert.equal(selectCampaigns(offers,{id:null}).length,2);
 });

 test('both dashboard entrypoints invalidate cached campaign modules for priorities release',()=>{
 for(const role of ['sponsor','sponsee']){
 const html=fs.readFileSync(path.join(__dirname,'../dashboard'+role+'.html'),'utf8');
 assert.ok(html.includes('./js/'+role+'Offers.js?v=20261011-reports1'));
 assert.ok(!html.includes('./js/'+role+'Offers.js?v=20261011-campaign1'));
 }
 });

 test('calendar exports only upcoming agreed deadlines with exclusive end dates and stable IDs',async()=>{
 const {campaignCalendar}=await import('../js/campaignCalendar.js');
 const now=new Date('2026-10-11T12:00:00Z');const base={id:'one',stage:2,status:'accepted',deadline:'2026-12-31',offer_title:'Test'};
 const result=campaignCalendar([base,base,{...base,id:'pending',stage:1},{...base,id:'done',stage:5},{...base,id:'old',deadline:'2020-01-01'},{...base,id:'bad',deadline:'2026-02-30'},{...base,id:'archived',archived:true}],now);
 assert.equal(result.count,1);assert.match(result.content,/DTSTART;VALUE=DATE:20261231/);assert.match(result.content,/DTEND;VALUE=DATE:20270101/);assert.match(result.content,/UID:campaign-one@sponsorsorter.com/);assert.match(result.content,/CLASS:PRIVATE/);
 });
 test('calendar escapes injected properties and folds Unicode lines at 75 bytes',async()=>{
 const {campaignCalendar}=await import('../js/campaignCalendar.js');
 const result=campaignCalendar([{id:'id\r\nATTENDEE:bad',stage:3,deadline:'2026-12-20',offer_title:'Title,semi;slash\\\r\nATTENDEE:bad '+ '🎬'.repeat(80),sponsee_email:'private@example.com',offer_amount:999}],new Date('2026-10-11T12:00:00Z'));
 assert.equal(result.count,1);assert.ok(!result.content.includes('\r\nATTENDEE:'));assert.ok(!result.content.includes('private@example.com'));assert.ok(!result.content.includes('999'));
 for(const line of result.content.split('\r\n')) assert.ok(Buffer.byteLength(line,'utf8')<=75);
 assert.ok(result.content.includes('\\,'));assert.ok(result.content.includes('\\;'));
 });

 test('media kit projects only safe public fields and validates review information',async()=>{
 const {mediaKitData}=await import('../js/creatorMediaKit.js');
 const result=mediaKitData({username:'<img src=x>',slug:'fitstyle',user_type:'besponsored',social_handles:'{"youtube":"creator","evil":"x"}',platforms:['youtube','twitch'],avg_rating:4.5,review_count:3,email:'private@example.com',wallet:999,access_token:'secret'},'https://sponsorsorter.com');
 assert.deepEqual(result.platforms,['youtube','twitch']);assert.equal(result.name,'<img src=x>');assert.equal(result.rating,4.5);assert.equal(result.reviews,3);assert.equal(result.url,'https://sponsorsorter.com/u/index.html?u=fitstyle');
 assert.ok(!JSON.stringify(result).includes('private@example.com'));assert.ok(!JSON.stringify(result).includes('secret'));assert.ok(!JSON.stringify(result).includes('999'));
 const invalid=mediaKitData({slug:'bad<script>',avg_rating:100,review_count:-1},'https://sponsorsorter.com');assert.equal(invalid.rating,null);assert.equal(invalid.reviews,0);assert.equal(invalid.url,'');
 });

 test('media kit missing ratings stay unknown and print hiding requires explicit print mode',async()=>{
 const {mediaKitData}=await import('../js/creatorMediaKit.js');assert.equal(mediaKitData({avg_rating:null,review_count:2},'https://sponsorsorter.com').rating,null);
 const css=fs.readFileSync(path.join(__dirname,'../public-profile.css'),'utf8');assert.ok(css.includes('body.public-profile-page.media-kit-printing > *:not(#media-kit-print)'));
 const html=fs.readFileSync(path.join(__dirname,'../u/index.html'),'utf8');assert.ok(html.includes('publicDashboard.js?v=20261011-kit1'));
 });
