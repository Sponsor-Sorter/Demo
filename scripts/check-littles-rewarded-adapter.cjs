const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',client='33333333-3333-4333-8333-333333333333',unit='ca-app-pub-6946008351204848/6193791997',contract='littles-ad-round-v1';
function fixture(){
 const files=new Map(),state={actor:A,plus:false,consent:true,parent:true,left:0},counts={show:0,cancel:0,prepare:0};
 const caps={contract,package:'com.meadowmarket.littles',nativeVersion:17,demo:false,format:'opt_in_skippable_rewarded_interstitial_v1',client,unit};
 const policy={contract,enabled:true,formatReviewed:true,requiredCloseMs:5000,eligibilityEvidence:'https://example.invalid/fixture',unit};
 const hooks={caps:async()=>caps,status:async()=>policy,prepare:async()=>({contract,actor:state.actor,game:'memory',challenge:'challenge_one',unit,expiresAt:Date.now()+60000}),show:async()=>({earned:true,closed:true}),claim:async()=>({contract,actor:state.actor,game:'memory',challenge:'challenge_one',transaction:'transaction_one',amount:1,expiresAt:Date.now()+60000,verified:true,client,unit})};
 const requests=[];
 const env={localStorage:{getItem:k=>files.get(k)||null,setItem:(k,v)=>files.set(k,v)},crypto:crypto.webcrypto,setTimeout:fn=>{fn();},meadowLittlesCloud:{getStatus:()=>({userId:state.actor,parentReady:state.parent}),rewarded:async(action,data)=>{requests.push({action,data});assert.equal(data.client,client);assert.equal(data.nativeVersion,caps.nativeVersion);if(action==='prepare')counts.prepare++;return hooks[action]();}}};env.window=env;
 vm.createContext(env);for(const name of ['rewarded-round-core.js','rewarded-rounds.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../meadow-market-littles',name),'utf8'),env);
 let core;const ads={rewardedCapabilities:()=>hooks.caps(),showRewarded:async()=>{counts.show++;return hooks.show();},cancelRewardedLoad:async()=>{counts.cancel++;}};
 const adapter=env.meadowLittlesRewarded.create({ads,access:{remainingBase:()=>state.left,configure:o=>core=o.rewarded},commerce:()=>({plus:state.plus}),consentReady:()=>state.consent});
 return {adapter,state,hooks,caps,policy,counts,core,files,requests,ads};
}
test('Adapter gates old native, demo, consent, Plus and failed/revoked server policy',async()=>{
 for(const patch of [{nativeVersion:14},{demo:true},{package:'wrong'},{format:'wrong'}]){const f=fixture();Object.assign(f.caps,patch);await f.adapter.refresh();assert(!f.adapter.available('memory'));assert.equal(f.counts.show,0);}
 const f=fixture();await f.adapter.refresh();assert(f.adapter.available('memory'));f.hooks.status=async()=>{throw Error('offline');};await f.adapter.refresh();assert(!f.adapter.available('memory'));
 for(const patch of [{consent:false},{plus:true},{parent:false},{left:1}]){const x=fixture();Object.assign(x.state,patch);await x.adapter.refresh();assert(!x.adapter.available('memory'));}
});
test('Delayed capabilities/status cannot enable a changed account',async()=>{
 for(const phase of ['caps','status']){const f=fixture();let release;f.hooks[phase]=()=>new Promise(r=>release=r);const loading=f.adapter.refresh();while(!release)await Promise.resolve();f.state.actor=B;f.adapter.accountChanged();release(phase==='caps'?f.caps:f.policy);await loading;assert(!f.adapter.available('memory'));}
});

test('Native15 and16 never start a new ad even if an old status response says enabled',async()=>{
 for(const nativeVersion of [15,16]){const f=fixture();f.caps.nativeVersion=nativeVersion;await f.adapter.refresh();assert(!f.adapter.available('memory'));assert.equal((await f.adapter.watch('memory')).status,'unavailable');assert.equal(f.counts.show,0);assert.equal(f.counts.prepare,0);}
});

test('Old native can recover a genuinely signed pending receipt while new offers stay disabled',async()=>{
 const f=fixture();f.caps.nativeVersion=16;f.policy.enabled=false;
 f.files.set('meadow-littles-ad-rounds-v1',JSON.stringify({version:1,grants:[],pending:[{actor:A,game:'memory',challenge:'challenge_one',expiresAt:Date.now()+60000}]}));
 await f.adapter.refresh();assert.equal(f.adapter.remaining('memory'),1);assert(!f.adapter.available('memory'));assert.equal(f.counts.show,0);assert.equal(f.counts.prepare,0);assert(f.requests.some(r=>r.action==='claim'&&r.data.nativeVersion===16));
});

test('Native16 keeps an already claimed local round playable while every new offer stays off',async()=>{
 const f=fixture();await f.adapter.refresh();await f.adapter.watch('memory');f.caps.nativeVersion=16;f.policy.enabled=false;await f.adapter.refresh();assert.equal(f.adapter.remaining('memory'),1);assert(!f.adapter.available('memory'));assert(f.core.complete(f.core.begin('memory')));assert.equal(f.adapter.remaining('memory'),0);assert(!f.adapter.available('memory'));
});

test('Malformed legacy capability cannot bind claim recovery',async()=>{
 for(const patch of [{nativeVersion:undefined},{nativeVersion:16.5},{client:'wrong'},{unit:'wrong'},{demo:undefined}]){const f=fixture();Object.assign(f.caps,patch);await f.adapter.refresh();assert.equal(f.requests.length,0);assert(!f.adapter.available('memory'));}
});

test('Official sample diagnostics are independent of core and backend rewards and absent without native capability',async()=>{
 const f=fixture();let samples=0;f.ads.rewardedDiagnostics=async()=>({contract:'littles-ad-timing-v1',sampledMs:0,events:[]});f.ads.showDiagnosticRewarded=async(...args)=>{assert.equal(args.length,0);samples++;return{closed:true,earned:true};};
 await f.adapter.refresh();assert(!f.adapter.diagnosticAdAvailable());await assert.rejects(f.adapter.diagnosticAd());assert.equal(samples,0);
 f.caps.diagnostics=true;assert(f.adapter.diagnosticAdAvailable());const before=f.requests.length;await f.adapter.diagnosticAd();assert.equal(samples,1);assert.equal(f.requests.length,before);assert.equal(f.counts.prepare,0);assert.equal(f.counts.show,0);assert.equal(f.adapter.remaining('memory'),0);
});

test('A publisher outcome rejects demo or other-generation timing and accepts only its own trace',async()=>{
 const f=fixture();f.caps.diagnostics=true;f.hooks.show=async()=>({closed:true,earned:false,diagnosticKind:'publisher',diagnosticGeneration:7});
 await f.adapter.refresh();await f.adapter.watch('memory');
 for(const patch of [{kind:'demo',generation:7},{kind:'publisher',generation:8}]){f.ads.rewardedDiagnostics=async({request})=>({request,...patch});await assert.rejects(f.adapter.diagnostics(1));}
 f.ads.rewardedDiagnostics=async({request})=>({request,kind:'publisher',generation:7});assert.equal((await f.adapter.diagnostics(2)).generation,7);
});
test('Consent can become ready after an early refresh; native pre-load refusal never leaves a pending reward',async()=>{
 const f=fixture();f.state.consent=false;await f.adapter.refresh();f.state.consent=true;await f.adapter.refresh();assert(f.adapter.available('memory'));
 f.hooks.show=async()=>{throw Error('Optional adverts are unavailable.');};assert.equal((await f.adapter.watch('memory')).status,'unavailable');assert(f.adapter.available('memory'));assert.equal(f.adapter.remaining('memory'),0);
});
test('One matching server receipt credits selected game; incorrect installation never credits',async()=>{
 const f=fixture();await f.adapter.refresh();assert.equal((await f.adapter.watch('memory')).status,'ready');assert.equal(f.adapter.remaining('memory'),1);assert.equal(f.adapter.remaining('sorting'),0);assert.equal(f.counts.show,1);
 const bad=fixture();bad.hooks.claim=async()=>({contract,actor:A,game:'memory',challenge:'challenge_one',transaction:'transaction_one',amount:1,expiresAt:Date.now()+60000,verified:true,client:'wrong',unit});await bad.adapter.refresh();assert.equal((await bad.adapter.watch('memory')).status,'unverified');assert.equal(bad.adapter.remaining('memory'),0);
});
test('Cancel during prepare prevents a late ad opening; pending poll cannot follow another actor',async()=>{
 const f=fixture();await f.adapter.refresh();let release;f.hooks.prepare=()=>new Promise(r=>release=r);const watching=f.adapter.watch('memory');f.adapter.cancel();release({contract,actor:A,game:'memory',challenge:'challenge_one',unit,expiresAt:Date.now()+60000});await watching;assert.equal(f.counts.show,0);
 const g=fixture();await g.adapter.refresh();g.hooks.claim=async()=>{g.state.actor=B;g.adapter.accountChanged();return {status:'pending'};};assert.equal((await g.adapter.watch('memory')).status,'account_changed');assert.equal(g.adapter.remaining('memory'),0);
});
test('Access uses five free completions, then weekly bonuses, then one verified ad round; failures remain free',async()=>{
 const {create}=require('../meadow-market-littles/rewarded-round-core.js'),files=new Map(),storage={getItem:k=>files.get(k)||null,setItem:(k,v)=>files.set(k,v)},env={localStorage:storage};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../meadow-market-littles/play-access.js'),'utf8'),env);const a=env.meadowLittlesAccess;let bonus=2,plus=false;
 const core=create({storage,context:()=>({actor:A,plus,parentReady:true,canRequestAds:true,remainingBaseRounds:a.remainingBase}),policy:()=>({enabled:true,contract,formatReviewed:true,requiredCloseMs:5000,eligibilityEvidence:'https://example.invalid/fixture',unit}),prepare:async()=>({contract,actor:A,game:'memory',challenge:'challenge',unit,expiresAt:Date.now()+60000}),show:async()=>({earned:true,closed:true}),settle:async()=>({contract,actor:A,game:'memory',challenge:'challenge',transaction:'tx',amount:1,expiresAt:Date.now()+60000}),verifyGrant:async()=>true});
 a.configure({enabled:true,rewarded:core,bonusRemaining:()=>bonus,onComplete:(id,ticket,useBonus)=>{if(useBonus)bonus--;}});
 for(let i=0;i<7;i++){assert(a.begin('memory'));assert(a.complete('memory'));assert(!a.complete('memory'));}
 assert.equal(bonus,0);assert.equal(a.remaining('memory'),0);assert(!a.begin('memory'));assert.equal((await core.watch('memory')).status,'ready');assert.equal(a.remaining('memory'),1);
 assert(a.begin('memory'));assert(a.begin('memory'),'Abandoning/retrying does not spend the reward');assert.equal(a.remaining('memory'),1);assert(a.complete('memory'));assert(!a.complete('memory'));assert.equal(a.remaining('memory'),0);assert.equal(bonus,0);assert.equal(a.remaining('sorting'),5);
 plus=true;a.configure({plus:true});assert.equal(a.remaining('memory'),Infinity);assert(!core.available('memory'));
});
