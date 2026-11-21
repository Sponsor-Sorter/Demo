const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict');
async function check(){
 const pair=crypto.generateKeyPairSync('rsa',{modulusLength:2048}),user='11111111-1111-4111-8111-111111111111';
 const config={contract:'littles-play-v1',package:'com.meadowmarket.littles',product:'ml_plus',proofKey:pair.publicKey.export({format:'jwk'})};
 const window={meadowLittlesCommerceConfig:config,meadowLittlesAccess:{configure(){}}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../meadow-market-littles/commerce.js'),'utf8'),{window,crypto:crypto.webcrypto,TextDecoder,TextEncoder,Uint8Array,atob,Date,Number,Promise,WeakMap});
 const now=Math.floor(Date.now()/1000),base={iss:config.contract,aud:config.package,sub:user,product:config.product,iat:now,exp:now+3600,paid:true,complimentary:false};
 const sign=claims=>{const data=Buffer.from(JSON.stringify({alg:'RS256'})).toString('base64url')+'.'+Buffer.from(JSON.stringify(claims)).toString('base64url');return data+'.'+crypto.sign('RSA-SHA256',Buffer.from(data),pair.privateKey).toString('base64url');};
 const valid=claims=>window.meadowLittlesCommerce.validProof(sign({...base,...claims}),user);
 assert(await valid({}));assert(await valid({paid:false,complimentary:true,exp:now+300}));
 for(const claims of [{sub:'other-user'},{aud:'com.meadowandmarket.game'},{product:'mm_premium'},{exp:now-1},{iat:now+60},{exp:now+86401},{paid:'true'},{paid:false,complimentary:false},{paid:false,complimentary:true,exp:now+301},{iat:now,exp:now}])assert.equal(await valid(claims),false,JSON.stringify(claims));
 const proof=sign(base),parts=proof.split('.');parts[1]=Buffer.from(JSON.stringify({...base,exp:now+7200})).toString('base64url');assert.equal(await window.meadowLittlesCommerce.validProof(parts.join('.'),user),false);
 assert.equal(await window.meadowLittlesCommerce.validProof('malformed',user),false);
 const controller=async(data,answer)=>{
  const storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
  const env={localStorage:storage,crypto:crypto.webcrypto,TextDecoder,TextEncoder,Uint8Array,atob,setInterval(){},MutationObserver:class{observe(){}},document:{body:{style:{setProperty(){}}},querySelector(){return null},addEventListener(){}},meadowLittlesCommerceConfig:config,meadowLittlesCloud:{getStatus:()=>({userId:user}),commerce:async()=>{if(!answer)throw Error('Offline');return {contract:config.contract,user_id:user,parent_ready:true,proof:null,...answer};}}};env.window=env;
  const context=vm.createContext(env);for(const file of ['play-access.js','commerce.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../meadow-market-littles/'+file),'utf8'),context);
  await env.meadowLittlesCommerce.init();return env.meadowLittlesAccess;
 };
 const ledger=new Map();let access=await controller(ledger,{checkout_enabled:true,checkout_test_only:false});
 for(let i=0;i<5;i++){assert(access.begin('memory'));assert(access.complete('memory'));}
 access=await controller(ledger,null);assert.equal(access.remaining('memory'),0,'A restarted offline app keeps the last confirmed public allowance');
 await controller(ledger,{checkout_enabled:false,checkout_test_only:false});access=await controller(ledger,null);assert.equal(access.remaining('memory'),Infinity,'A confirmed public rollback remains available offline');
 const privateLedger=new Map();await controller(privateLedger,{checkout_enabled:true,checkout_test_only:true});access=await controller(privateLedger,null);assert.equal(access.getStatus().enabled,false,'Private provider acceptance cannot persist a public rollout policy');
 const adEvents={},styles=new Map(),storage=new Map();let dialogOpen=false,mutate,visibility,hides=0;
 const dock={localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},crypto:crypto.webcrypto,TextDecoder,TextEncoder,Uint8Array,atob,setInterval(){},MutationObserver:class{constructor(fn){mutate=fn;}observe(){}},document:{hidden:false,body:{style:{setProperty:(k,v)=>styles.set(k,v)}},querySelector:selector=>selector==='#littles-home'?{}:dialogOpen?{}:null,addEventListener:(event,fn)=>{if(event==='visibilitychange')visibility=fn;}},meadowLittlesCommerceConfig:config,meadowLittlesCloud:{getStatus:()=>({userId:user}),commerce:async()=>({contract:config.contract,user_id:user,parent_ready:true,proof:null,checkout_enabled:false,ads_enabled:true,ads_test_only:true})},Capacitor:{isNativePlatform:()=>true,isPluginAvailable:()=>true,Plugins:{LittlesStore:{capabilities:async()=>({contract:config.contract,package:config.package,adsDemo:true}),addListener(){},restore:async()=>({purchases:[]})},LittlesAds:{addListener:(event,fn)=>adEvents[event]=fn,consent:async()=>({canRequestAds:true}),showBanner:async()=>{},hideBanner:async()=>{hides++;adEvents.bannerHidden?.();}}}}};dock.window=dock;
 const dockContext=vm.createContext(dock);for(const file of ['play-access.js','commerce.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../meadow-market-littles/'+file),'utf8'),dockContext);
 await dock.meadowLittlesCommerce.init();adEvents.bannerVisible({height:70});assert.equal(styles.get('--littles-ad-height'),'70px','actual native dock height reserves the home scroll viewport');assert.equal(dock.document.body.style.paddingBottom,'','body padding cannot reserve space for the separately scrolling home');
 dialogOpen=true;await mutate();assert.equal(styles.get('--littles-ad-height'),'0px');assert(hides>0);adEvents.bannerVisible({height:70});assert.equal(styles.get('--littles-ad-height'),'0px','a late ad callback cannot shrink a game or dialog');
 dialogOpen=false;await mutate();adEvents.bannerVisible({height:70});dock.document.hidden=true;visibility();assert.equal(styles.get('--littles-ad-height'),'0px','backgrounding restores the full viewport');
 assert(fs.readFileSync(path.join(__dirname,'../meadow-market-littles/commerce.css'),'utf8').includes('height:calc(100dvh - var(--littles-ad-height,0px))'),'the reserved height applies to the actual scroll container');
 console.log('Littles commerce: signed proofs bind account/package/product; tampering, expiry, future issuance, invalid claims and overlong gift leases denied.');
 console.log('Littles rollout policy: free allowance survives offline restart; confirmed rollback persists; private tests do not enable public limits.');
 console.log('Littles ad dock: measured scroll clearance, hidden/dialog cleanup and late callback protection passed.');
 const NETWORK='LITTLES_UMP_INFO_NETWORK';
 const transient=()=>Object.assign(Error('Synthetic pre-form connectivity failure'),{code:NETWORK});
 async function fixture(initial, retry, {demo=false, proof=null, adsEnabled=true, testOnly=false}={}){
  const hooks={},counts={calls:[],shows:0},context={dialog:false};
  let policy=adsEnabled, entitlement=proof;
  const env={localStorage:{getItem(){return null;},setItem(){},removeItem(){}},crypto:crypto.webcrypto,TextDecoder,TextEncoder,Uint8Array,atob,setInterval(){},
   MutationObserver:class{observe(){}},document:{hidden:false,body:{style:{setProperty(){}}},querySelector:s=>s==='#littles-home'?{}:context.dialog?{}:null,addEventListener:(event,fn)=>hooks[event]=fn},
   addEventListener:(event,fn)=>hooks[event]=fn,meadowLittlesCommerceConfig:config,meadowLittlesCloud:{getStatus:()=>({userId:user}),commerce:async()=>({contract:config.contract,user_id:user,parent_ready:true,proof:entitlement,ads_enabled:policy,ads_test_only:testOnly})},
   Capacitor:{isNativePlatform:()=>true,isPluginAvailable:()=>true,Plugins:{LittlesStore:{capabilities:async()=>({contract:config.contract,package:config.package,adsDemo:demo}),addListener(){},restore:async()=>({purchases:[]})},LittlesAds:{addListener(){},async consent(opts){counts.calls.push(opts);return counts.calls.length===1?initial():retry();},async showBanner(){counts.shows++;},async hideBanner(){}}}}};
  env.window=env; const sandbox=vm.createContext(env);
  for(const file of ['play-access.js','commerce.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../meadow-market-littles/'+file),'utf8'),sandbox);
  await env.meadowLittlesCommerce.init();
  return {counts,on:hooks.online||(()=>Promise.resolve()),resume(){hooks.visibilitychange();return new Promise(r=>setImmediate(r));},context,env,setPolicy(v){policy=v;},setProof(v){entitlement=v;}};
 }
 const recovered=await fixture(()=>{throw transient();},async()=>({canRequestAds:true}));
 recovered.env.document.hidden=true;await recovered.on();assert.equal(recovered.counts.calls.length,1,'not while backgrounded');
 recovered.env.document.hidden=false;recovered.context.dialog=true;await recovered.on();assert.equal(recovered.counts.calls.length,1,'not during a game or parent dialog');
 recovered.context.dialog=false;recovered.setPolicy(false);await recovered.on();assert.equal(recovered.counts.calls.length,1,'policy remains authoritative');
 recovered.setPolicy(true);recovered.setProof(sign(base));await recovered.on();assert.equal(recovered.counts.calls.length,1,'not for verified Plus');
 recovered.setProof(null);
 await Promise.all([recovered.on(),recovered.on(),recovered.resume()]);
 assert.equal(recovered.counts.calls.length,2,'one retry across overlapping online and foreground events');
 assert.equal(recovered.counts.calls[1]?.refreshOnly,true,'recovery requests info only, never a form');
 assert.equal(recovered.counts.shows,1,'only one banner request after successful retry');
 await recovered.on();assert.equal(recovered.counts.calls.length,2,'does not retry again');
 for(const initial of [()=>({canRequestAds:false}),()=>{throw Error('Legacy or unknown native error');},()=>{throw Object.assign(Error('Not a transient error'),{code:'POLICY_ERROR'});}]) {
  const f=await fixture(initial,async()=>({canRequestAds:true}));await f.on();await f.resume();assert.equal(f.counts.calls.length,1);assert.equal(f.counts.shows,0);
 }
 for(const retry of [()=>({canRequestAds:false}),()=>{throw transient();}]){
  const f=await fixture(()=>{throw transient();},retry);await f.on();await f.on();assert.equal(f.counts.calls.length,2);assert.equal(f.counts.shows,0,'no banner if consent remains unavailable or a form is required');
 }
 let finish;const wait=await fixture(()=>{throw transient();},()=>new Promise(resolve=>{finish=resolve;}));
 const going=wait.on();await new Promise(r=>setImmediate(r));wait.context.dialog=true;await wait.on();finish({canRequestAds:true});await going;
 assert.equal(wait.counts.calls.length,2);assert.equal(wait.counts.shows,0,'no late banner when the user is no longer home');
 const privateOnly=await fixture(()=>{throw transient();},async()=>({canRequestAds:true}),{testOnly:true});
 await privateOnly.on();assert.equal(privateOnly.counts.calls.length,1);assert.equal(privateOnly.counts.shows,0,'private demo policy unchanged for production native');
 console.log('Littles consent recovery: transient-only, one in-flight info-only retry, gates, late readiness and denial/legacy fail-closed checks passed.');

}
check().catch(error=>{console.error(error);process.exitCode=1});
