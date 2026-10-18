import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { publicProviderAvailable, publicTwitchStatus, publicCount, publicSnapshotTime, publicSnapshotLabel, publicAudienceSummary, presentPublicProvider, readPublicStats } from '../js/publicStatsPresentation.mjs';
const fetched_at='2026-10-18T06:14:11.249Z';
const unlinked=()=>({connected:false,available:false,state:'not_connected'});
const available=extra=>({connected:true,available:true,state:'available',...extra});
const payload=()=>({ok:true,partial:false,complete:true,fetched_at,cache_hit:false,youtube:available({subscriber_count:27}),twitch:available({follower_count:0,is_live:false}),tiktok:available({follower_count:1}),instagram:unlinked(),facebook:unlinked()});
function dom(){
 const doc={createElement(){return {style:{display:''},dataset:{},textContent:'',setAttribute(){},children:[],ownerDocument:doc};}};
 const card=doc.createElement();card.appendChild=child=>{card.children.push(child);return child;};
 const metrics=doc.createElement();metrics.textContent='Old count 99';metrics.style.display='grid';card.appendChild(metrics);
 return {card,metrics,doc};
}
test('availability requires exact confirmed connection, availability and state',()=>{
 assert.equal(publicProviderAvailable(available()),true);
 for(const info of [null,{connected:true},{connected:true,available:true,state:'meta_pending'},{connected:true,available:true,state:'unknown'},unlinked()]) assert.equal(publicProviderAvailable(info),false);
});
test('Twitch null and unavailable are Unknown, only observed false is Offline',()=>{
 assert.equal(publicTwitchStatus(available({is_live:null})),'Unknown');
 assert.equal(publicTwitchStatus({connected:true,available:false,state:'provider_unavailable',is_live:false}),'Unknown');
 assert.equal(publicTwitchStatus(available({is_live:false})),'Offline');
 assert.equal(publicTwitchStatus(available({is_live:true})),'Live now');
});
test('missing values never become zero; observed zero is retained',()=>{
 for(const value of [null,undefined,'',' ',false,[],{},-1,NaN,Infinity,'0x10',0.5]) assert.equal(publicCount(value),null);
 assert.equal(publicCount(0),0);assert.equal(publicCount('0'),0);assert.equal(publicCount(27),27);
});
test('cache hit retains source time and reports source age',()=>{
 const p={...payload(),cache_hit:true};const now=Date.parse(fetched_at)+4*60000;
 assert.equal(publicSnapshotTime(p),fetched_at);assert.match(publicSnapshotLabel(p,now),/Cached snapshot.*4 minutes old/);
 assert.equal(publicSnapshotTime({...p,fetched_at:null}),null);assert.equal(publicSnapshotLabel({...p,fetched_at:null},now),'Snapshot time unknown.');
 assert.equal(publicSnapshotLabel({...p,fetched_at:'2099-01-01T00:00:00Z'},now),'Snapshot time unknown.');
});
test('complete observed audience includes a true zero and missing counts become Unknown',()=>{
 const p=payload();assert.equal(publicAudienceSummary(p).total,28);
 p.twitch.follower_count=null;assert.equal(publicAudienceSummary(p).total,null);
});
test('Meta pending preserves linked count but prevents complete audience claim',()=>{
 const p=payload();p.instagram={connected:true,available:false,state:'meta_pending',follower_count:999};
 const summary=publicAudienceSummary(p);assert.equal(summary.connected,4);assert.equal(summary.total,null);assert.equal(summary.knownTotal,28);
});
test('unavailable card hides legacy metrics/media and states unknown',()=>{
 const {card,metrics}=dom();assert.equal(presentPublicProvider(card,'twitch',{connected:true,available:false,state:'provider_unavailable'},payload()),false);
 assert.equal(metrics.style.display,'none');assert.match(card.children.at(-1).textContent,/Linked.*unknown/);assert.doesNotMatch(card.children.at(-1).textContent,/Offline/);
});
test('Meta pending card shows review without losing connection',()=>{
 const {card}=dom();presentPublicProvider(card,'instagram',{connected:true,available:false,state:'meta_pending'},payload());
 assert.equal(card.style.display,'');assert.match(card.children.at(-1).textContent,/Linked.*Meta review pending.*connection is preserved/);
});
test('later available snapshot restores legacy layout and reuses one safe notice',()=>{
 const {card,metrics}=dom();presentPublicProvider(card,'youtube',{connected:true,available:false,state:'provider_unavailable'},payload());
 assert.equal(presentPublicProvider(card,'youtube',payload().youtube,payload()),true);assert.equal(metrics.style.display,'grid');assert.equal(card.children.length,2);
});
test('public read sends only username, no forced refresh/authactor/provider hints',async()=>{
 const calls=[];const client={functions:{invoke:async(name,options)=>{calls.push({name,options});return {data:payload()};}}};
 await readPublicStats(client,'fitstyle');assert.equal(calls.length,1);assert.equal(calls[0].name,'get-profile-live-stats');assert.deepEqual(calls[0].options.body,{username:'fitstyle'});assert.ok(calls[0].options.signal);
});
test('failed and invalid envelopes never become a public stats success',async()=>{
 for(const reply of [{error:{message:'private provider error'}},{data:{...payload(),ok:false}},{data:{...payload(),fetched_at:null}}]) await assert.rejects(readPublicStats({functions:{invoke:async()=>reply}},'fitstyle'),error=>error.message==='Public statistics unavailable.');
});
test('public read deadline aborts without retry',async()=>{
 let calls=0,signal;await assert.rejects(readPublicStats({functions:{invoke:async(_,options)=>{calls++;signal=options.signal;return new Promise(()=>{});}}},'fitstyle',{timeoutMs:3}));assert.equal(calls,1);assert.equal(signal.aborted,true);
});
const dashboard=readFileSync(new URL('../js/publicDashboard.js',import.meta.url),'utf8');
const profile=readFileSync(new URL('../viewprofile.html',import.meta.url),'utf8');
test('actual public dashboard dispatcher gates each renderer on shared availability',()=>{
 const start=dashboard.indexOf('function renderLiveStats(payload)');const end=dashboard.indexOf('/* --------------- Renderers --------------- */',start);
 const cards=Object.fromEntries(['youtube','twitch','tiktok','instagram','facebook'].map(p=>[`platform-${p}`,dom().card]));const rendered=[];
 const run=new Function('presentPublicProvider','$','renderYoutubeStats','renderTiktokStats','renderTwitchStats','renderInstagramStats','renderFacebookStats',dashboard.slice(start,end)+'\nreturn renderLiveStats;')(presentPublicProvider,id=>cards[id],()=>rendered.push('youtube'),()=>rendered.push('tiktok'),()=>rendered.push('twitch'),()=>rendered.push('instagram'),()=>rendered.push('facebook'));
 const p=payload();p.instagram={connected:true,available:false,state:'meta_pending'};run(p);assert.deepEqual(rendered,['youtube','tiktok','twitch']);
});
test('actual Twitch renderer handles unknown stream status without Offline',()=>{
 const start=dashboard.indexOf('function renderTwitchStats(');const end=dashboard.indexOf('function renderInstagramStats(',start);const nodes=new Map();
 const get=id=>{if(!nodes.has(id))nodes.set(id,{style:{},textContent:''});return nodes.get(id);};
 const run=new Function('$','showEl','safeImageUrl','safePublicLink','formatCount','formatDateTime','publicTwitchStatus',dashboard.slice(start,end)+'\nreturn renderTwitchStats;')(get,(el,show)=>{if(el)el.style.display=show?'':'none';},x=>x,x=>x,x=>publicCount(x)===null?'—':String(x),x=>String(x),publicTwitchStatus);
 run(available({is_live:null,follower_count:null}));assert.equal(get('tw-status').textContent,'Unknown');assert.equal(get('tw-followers').textContent,'—');
 run(available({is_live:false,follower_count:0}));assert.equal(get('tw-status').textContent,'Offline');assert.equal(get('tw-followers').textContent,'0');
});
test('viewprofile uses shared gates for all five providers and no invented timestamp',()=>{
 for(const provider of ['youtube','twitch','tiktok','instagram','facebook']) assert.match(profile,new RegExp(`presentPublicProvider\\([^,]+, '${provider}'`));
 const start=profile.indexOf('async function loadProfileLiveStats');const end=profile.indexOf('/* ---------- Profile & Stats ---------- */',start);const section=profile.slice(start,end);
 assert.doesNotMatch(section,/new Date\(\)\.toISOString\(\)|is_live \? 'Live' : 'Offline'/);assert.match(section,/publicAudienceSummary\(data\)/);assert.match(section,/publicSnapshotTime\(data\)/);
});
test('actual viewprofile loader clears stale aggregate and hides unavailable cards',async()=>{
 const start=profile.indexOf('async function loadProfileLiveStats');const end=profile.indexOf('/* ---------- Profile & Stats ---------- */',start);
 for(const failed of [false,true]){
  const nodes=new Map();const get=id=>{if(!nodes.has(id))nodes.set(id,dom().card);return nodes.get(id);};get('total-followers').textContent='99';
  const p=payload();for(const provider of ['youtube','twitch','tiktok','instagram','facebook'])p[provider]={connected:true,available:false,state:provider==='instagram'||provider==='facebook'?'meta_pending':'provider_unavailable'};
  const stamps=[];const context={};
  const run=new Function('document','readPublicStats','supabase','presentPublicProvider','publicAudienceSummary','publicSnapshotTime','publicSnapshotLabel','PROFILE_CTX','setFollowersUpdated','renderFollowersNote',profile.slice(start,end)+'\nreturn loadProfileLiveStats;')({getElementById:get},async()=>{if(failed)throw Error('private detail');return p;},{},presentPublicProvider,publicAudienceSummary,publicSnapshotTime,publicSnapshotLabel,context,s=>stamps.push(s),()=>{});
  await run('fixture');assert.equal(get('total-followers').textContent,'Unknown');assert.equal(stamps.at(-1),failed?null:fetched_at);
  assert.match(get('followers-note').textContent,failed?/unavailable/:/unknown/);
  for(const provider of ['youtube','twitch','tiktok','instagram','facebook'])assert.equal(get(`${provider}-stats-block`).children[0].style.display,'none');
 }
});
