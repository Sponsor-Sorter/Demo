const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('meadow-and-market/farm-club.js','utf8');
function fixture(){
 let who='first',online=true;const requests=[];
 const scope={window:{},document:{hidden:false,getElementById:()=>null},navigator:{onLine:true},console,setTimeout(){},clearTimeout(){},setInterval(){},clearInterval(){}};
 vm.runInNewContext(source.replace('window.meadowClub={','window.premiumCheck={receive,rpc,init(a){api=a;identity=a.user().id;ready=true;wallet={gems:77,reward_turns:3,premium:false,ads_enabled:true}}};window.meadowClub={'),scope);
 const api={ready:()=>online,user:()=>({id:who}),client:()=>({rpc:(name,data)=>new Promise((resolve,reject)=>requests.push({name,data,who,resolve,reject}))})};
 scope.window.premiumCheck.init(api);
 return {...scope,club:scope.window.meadowClub,check:scope.window.premiumCheck,requests,owner(v){who=v},ready(v){online=v},init:()=>scope.window.premiumCheck.init(api)};
}
(async()=>{
 const a=fixture();let task=a.club.refreshPremium();assert.equal(a.requests[0].name,'meadow_market_premium_status');a.requests[0].resolve({data:{verified:true,premium:true}});await task;
 assert(a.club.wallet().premium);assert.equal(a.club.wallet().gems,77,'Lightweight refresh cannot reset money');
 task=a.club.refreshPremium();a.requests[1].resolve({data:{verified:true,premium:false}});await task;assert.equal(a.club.wallet().premium,false,'Open game consumes revocation/expiry');
 a.check.receive({wallet:{gems:77,premium:true},premium_verified:true,premiumSequence:100});
 task=a.club.refreshPremium();a.requests[2].reject(Error('Offline'));await task;assert(a.club.wallet().premium,'Network failure cannot revoke known paid access');
 a.check.receive({wallet:{gems:77,premium:false}});assert(a.club.wallet().premium,'Cached round responses cannot overwrite fresh Premium proof');
 const b=fixture(),one=b.club.refreshPremium(),two=b.club.refreshPremium();assert.equal(one,two);assert.equal(b.requests.length,1);b.requests[0].resolve({data:{premium:true,verified:false}});await one;assert.equal(b.club.wallet().premium,false,'Unverified response is ignored');
 const c=fixture(),old=c.club.refreshPremium();c.owner('second');c.init();const current=c.club.refreshPremium();assert.equal(c.requests.length,2);c.requests[1].resolve({data:{verified:true,premium:true}});await current;c.requests[0].resolve({data:{verified:true,premium:false}});await old;assert(c.club.wallet().premium,'Old-owner completion cannot affect the new farm');
 const d=fixture(),status=d.check.rpc('status'),newer=d.club.refreshPremium();d.requests[1].resolve({data:{verified:true,premium:false}});await newer;d.requests[0].resolve({data:{wallet:{gems:77,premium:true},premium_verified:true}});d.check.receive(await status);assert.equal(d.club.wallet().premium,false,'Older full status cannot restore a revoked gift');
 d.document.hidden=true;await d.club.refreshPremium();d.document.hidden=false;d.navigator.onLine=false;await d.club.refreshPremium();d.navigator.onLine=true;d.ready(false);await d.club.refreshPremium();assert.equal(d.requests.length,2,'Hidden/offline/not-ready games do not poll');
 console.log('Premium234 client: live grant/revoke, lightweight currency preservation, network failure, unverified/cached responses, request coalescing/order and account/visibility/offline isolation passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
