const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',client='33333333-3333-4333-8333-333333333333',unit='ca-app-pub-6946008351204848/6193791997',contract='littles-ad-round-v1';
function fixture(){
 const files=new Map(),state={actor:A,plus:false,consent:true,parent:true,left:0},counts={show:0,cancel:0,prepare:0};
 const caps={contract,package:'com.meadowmarket.littles',nativeVersion:15,demo:false,format:'opt_in_skippable_rewarded_interstitial_v1',client,unit};
 const policy={contract,enabled:true,formatReviewed:true,requiredCloseMs:5000,eligibilityEvidence:'https://example.invalid/fixture',unit};
 const hooks={caps:async()=>caps,status:async()=>policy,prepare:async()=>({contract,actor:state.actor,game:'memory',challenge:'challenge_one',unit,expiresAt:Date.now()+60000}),show:async()=>({earned:true,closed:true}),claim:async()=>({contract,actor:state.actor,game:'memory',challenge:'challenge_one',transaction:'transaction_one',amount:1,expiresAt:Date.now()+60000,verified:true,client,unit})};
 const env={localStorage:{getItem:k=>files.get(k)||null,setItem:(k,v)=>files.set(k,v)},crypto:crypto.webcrypto,setTimeout:fn=>{fn();},meadowLittlesCloud:{getStatus:()=>({userId:state.actor,parentReady:state.parent}),rewarded:async(action,data)=>{assert.equal(data.client,client);if(action==='prepare')counts.prepare++;return hooks[action]();}}};env.window=env;
 vm.createContext(env);for(const name of ['rewarded-round-core.js','rewarded-rounds.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../meadow-market-littles',name),'utf8'),env);
 let core;const ads={rewardedCapabilities:()=>hooks.caps(),showRewarded:async()=>{counts.show++;return hooks.show();},cancelRewardedLoad:async()=>{counts.cancel++;}};
 const adapter=env.meadowLittlesRewarded.create({ads,access:{remainingBase:()=>state.left,configure:o=>core=o.rewarded},commerce:()=>({plus:state.plus}),consentReady:()=>state.consent});
 return {adapter,state,hooks,caps,policy,counts,core,files};
}
test('Adapter gates old native, demo, consent, Plus and failed/revoked server policy',async()=>{
 for(const patch of [{nativeVersion:14},{demo:true},{package:'wrong'},{format:'wrong'}]){const f=fixture();Object.assign(f.caps,patch);await f.adapter.refresh();assert(!f.adapter.available('memory'));assert.equal(f.counts.show,0);}
 const f=fixture();await f.adapter.refresh();assert(f.adapter.available('memory'));f.hooks.status=async()=>{throw Error('offline');};await f.adapter.refresh();assert(!f.adapter.available('memory'));
 for(const patch of [{consent:false},{plus:true},{parent:false},{left:1}]){const x=fixture();Object.assign(x.state,patch);await x.adapter.refresh();assert(!x.adapter.available('memory'));}
});
test('Delayed capabilities/status cannot enable a changed account',async()=>{
 for(const phase of ['caps','status']){const f=fixture();let release;f.hooks[phase]=()=>new Promise(r=>release=r);const loading=f.adapter.refresh();while(!release)await Promise.resolve();f.state.actor=B;f.adapter.accountChanged();release(phase==='caps'?f.caps:f.policy);await loading;assert(!f.adapter.available('memory'));}
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
