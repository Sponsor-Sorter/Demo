const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('meadow-and-market/store.js','utf8');
function fixture(changes={}){
 let owner='a',config={test_access:true,ads_provider_test:true,ads_enabled:true,isolated_ads_enabled:true,account_id:'a'.repeat(64),products:[],...changes},hook,showError=false,pause,lastShow;
 const calls={consent:0,show:0,nonce:0},notices=[],state={coins:250},timers=[];
 const ads={capabilities:async()=>{hook?.('capabilities');if(config.oldNative)throw Error('Not implemented');return {isolatedTestAds:true}},consent:async()=>{calls.consent++;await pause;hook?.('consent');return {canRequestAds:config.consent!==false}},show:async data=>{lastShow=data;calls.show++;hook?.('show');if(showError)throw Error('No ad available');return {earned:true,...(data.testOnly?{testOnly:true}:{} )}}};
 const scope={window:{addEventListener(){},meadowClub:{refresh:async()=>{},wallet:()=>({premium:config.premium===true,ads_enabled:config.popups===true})},Capacitor:{isNativePlatform:()=>true,isPluginAvailable:n=>n==='MeadowAds',Plugins:{MeadowAds:ads}}},document:{addEventListener(){},querySelectorAll:()=>[],querySelector:()=>null},setInterval(fn){timers.push(fn);return timers.length},clearInterval(){}};
 vm.runInNewContext(fs.readFileSync('meadow-and-market/ad-policy.js','utf8'),scope);vm.runInNewContext(source,scope);
 scope.window.meadowStore.attach({ready:()=>true,user:()=>({id:owner}),client:()=>({rpc:async name=>{if(name==='meadow_market_commerce_status')return {data:config};assert.equal(name,'meadow_market_start_ad_reward','Client can only request a nonce, never deliver a reward');calls.nonce++;hook?.('nonce');return {data:{nonce:'00000000-0000-4000-8000-000000000221'}}}}),notify:t=>notices.push(t),state:()=>state});
 return {store:scope.window.meadowStore,calls,state,notices,timers,shown:()=>lastShow,switchAt:at=>hook=p=>{if(p===at)owner='b'},fail:value=>showError=value,pause:p=>pause=p};
}
(async()=>{
 const test=fixture();assert((await test.store.advertisement(true)).testOnly);assert.deepEqual(test.calls,{consent:1,show:1,nonce:0});assert.equal(test.shown().testOnly,true);assert.equal(test.shown().accountId,undefined);assert.equal(test.state.coins,250);assert.equal(test.timers.length,0);assert.match(test.notices[0],/No game rewards/);
 const old=fixture({oldNative:true});await assert.rejects(()=>old.store.advertisement(true),/Update Meadow Markets/);assert.deepEqual(old.calls,{consent:0,show:0,nonce:0},'Old native versions cannot accidentally use production units for acceptance');
 const separated=fixture({ads_enabled:false});assert((await separated.store.advertisement(true)).testOnly,'Demo acceptance does not need public ads');
 const missingFlag=fixture({isolated_ads_enabled:undefined});assert((await missingFlag.store.advertisement(true)).unavailable);assert.equal(missingFlag.calls.show,0,'Acceptance never falls back to production advertising');
 const live=fixture({test_access:false,ads_provider_test:false});assert((await live.store.advertisement(true)).earned);assert.deepEqual(live.calls,{consent:1,show:1,nonce:1});assert.equal(live.shown().testOnly,undefined);assert.equal(live.timers.length,1);assert.match(live.notices[0],/server verification/);
 const free=fixture({ads_provider_test:false});assert((await free.store.advertisement(true)).test);assert.equal(free.calls.show,0);
 const closed=fixture({test_access:false,ads_provider_test:false,ads_enabled:false});assert((await closed.store.advertisement(true)).unavailable);assert.equal(closed.calls.consent,0);
 const rejected=fixture({consent:false});assert((await rejected.store.advertisement(true)).unavailable);assert.equal(rejected.calls.nonce,0);assert.equal(rejected.calls.show,0);
 for(const options of [{premium:true,popups:true},{premium:false,popups:false}]){const f=fixture(options);assert((await f.store.advertisement(false)).unavailable);assert.equal(f.calls.consent,0);assert.equal(f.calls.show,0);}
 const popup=fixture({popups:true});await popup.store.advertisement(false);assert.equal(popup.calls.show,1);assert.equal(popup.calls.nonce,0,'Interstitials never issue a reward nonce');
 for(const at of ['capabilities','consent','nonce','show']){const f=at==='nonce'?fixture({test_access:false,ads_provider_test:false}):fixture();f.switchAt(at);await assert.rejects(()=>f.store.advertisement(true),/Account changed/);assert.equal(f.notices.length,0);if(at!=='show')assert.equal(f.calls.show,0);}
 const nofill=fixture();nofill.fail(true);await assert.rejects(()=>nofill.store.advertisement(true),/No ad/);nofill.fail(false);assert((await nofill.store.advertisement(true)).earned,'Failure releases the busy guard');
 let finish;const concurrent=fixture();concurrent.pause(new Promise(r=>finish=r));const first=concurrent.store.advertisement(true);await Promise.resolve();await Promise.resolve();assert((await concurrent.store.advertisement(true)).unavailable);finish();await first;assert.equal(concurrent.calls.show,1);
 const native=fs.readFileSync('tools/meadow-android/android/app/build.gradle','utf8');for(const id of ['6946008351204848~7779211148','6946008351204848/6866630905','6946008351204848/8491985021'])assert(native.includes(id));
 assert(native.includes("versionName '1.7.6'"));assert(native.includes('ca-app-pub-3940256099942544~3347511713'),'Direct shell retains demo app ID');
 const club=fs.readFileSync('meadow-and-market/farm-club.js','utf8');assert(club.includes('if(!result?.test)return;'),'Only the scoped free-preview response can route into the preview');
 console.log('Ad221 fixtures: scoped native route, privacy denial, account switching, concurrency/no-fill recovery and no client reward grants passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
