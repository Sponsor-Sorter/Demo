const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('meadow-and-market/store.js','utf8');
const paid=token=>({products:['mm_pocket_gems'],token,pending:false});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}};
function fixture(){
 let owner='first',rows=[],rpcHook,verifyHook,refreshHook,priceFailure=false,online=true;
 const configurations={first:{test_access:false,payments_enabled:true,purchase_account_ready:true,account_id:'a'.repeat(64),products:[{sku:'pocket_gems',product_id:'mm_pocket_gems'}]},second:{test_access:false,payments_enabled:false,purchase_account_ready:true,account_id:'b'.repeat(64),products:[]}};
 const calls={prices:0,checkout:0,restore:0,verify:[],saved:[],refresh:0},events={},notices=[];
 const billing={products:async()=>{calls.prices++;if(priceFailure)throw Error('Price service unavailable');return {products:[{id:'mm_pocket_gems',price:'A$2.99'}]}},purchase:async()=>{calls.checkout++;return {purchases:rows}},restore:async()=>{calls.restore++;return {purchases:rows}},addListener:(n,f)=>events[n]=f};
 const scope={Date,navigator:{get onLine(){return online}},window:{addEventListener:(n,f)=>events[n]=f,Capacitor:{isNativePlatform:()=>true,isPluginAvailable:n=>n==='MeadowStore',Plugins:{MeadowStore:billing}},meadowClub:{refresh:async()=>{calls.refresh++;await refreshHook?.()}}},document:{hidden:false,addEventListener:(n,f)=>events[n]=f,querySelectorAll:()=>[],querySelector:()=>null}};
 vm.runInNewContext(source.replace('window.meadowStore={','window.recoverBilling=recover;window.meadowStore={'),scope);
 const api={ready:()=>true,canPlay:()=>true,user:()=>({id:owner}),
  client:()=>({rpc:async()=>rpcHook?rpcHook(owner):{data:configurations[owner]},functions:{invoke:async(_,{body})=>{
   calls.verify.push({owner,token:body.token});return verifyHook?verifyHook(body):{data:{verified:true}};
  }}}),save:()=>calls.saved.push(owner),flush:async()=>{},notify:t=>notices.push(t)};
 scope.window.meadowStore.attach(api);
 return {store:scope.window.meadowStore,recover:scope.window.recoverBilling,calls,notices,events,configurations,online:v=>online=v,rows:v=>rows=v,owner:v=>owner=v,rpc:v=>rpcHook=v,verification:v=>verifyHook=v,refresh:v=>refreshHook=v,failPrices:()=>priceFailure=true};
}
(async()=>{
 const closed=fixture();closed.configurations.first.payments_enabled=false;closed.rows([paid('already-paid')]);await closed.recover();assert.equal(closed.calls.restore,1);assert.equal(closed.calls.prices,0);assert.equal(closed.calls.verify.length,1);assert.deepEqual(closed.calls.saved,['first']);await assert.rejects(closed.store.purchase('pocket_gems'),/opening soon/);assert.equal(closed.calls.checkout,0);
 const offline=fixture();await offline.store.refresh();offline.online(false);await assert.rejects(offline.store.purchase('pocket_gems'),/Connect online/);await assert.rejects(offline.store.advertisement(true),/Connect online/);await assert.rejects(offline.store.restore(),/Connect online/);assert.equal(offline.calls.checkout,0);assert.equal(offline.calls.restore,0);offline.online(true);offline.rows([paid('reconnected')]);await offline.store.restore();assert.equal(offline.calls.verify.length,1,'Offline denial releases the busy lock and preserves normal recovery after reconnect');
 const priceDown=fixture();priceDown.failPrices();priceDown.rows([paid('unfinished')]);await priceDown.store.restore();assert.equal(priceDown.calls.prices,0,'Restoration never depends on price discovery');assert.equal(priceDown.calls.verify.length,1);
 const mixed=fixture();mixed.rows([paid('other-farm'),paid('this-farm')]);mixed.verification(body=>body.token==='other-farm'?{error:{context:{json:async()=>({error:'PURCHASE_ACCOUNT_MISMATCH'})}}}:{data:{verified:true}});await assert.rejects(mixed.store.restore(),/belongs to another farm/);assert.equal(mixed.calls.verify.length,2,'One foreign Play purchase cannot block a valid purchase on this farm');assert.deepEqual(mixed.calls.saved,['first'],'Canonical successes are refreshed before reporting a failed restore');
 const pending=fixture();pending.rows([{pending:true}]);await pending.store.restore();assert.equal(pending.calls.verify.length,0);assert.equal(pending.calls.saved.length,0);assert.match(pending.notices.at(-1),/pending/);
 const changed=fixture();changed.rows([paid('own')]);changed.refresh(()=>changed.owner('second'));await assert.rejects(changed.store.restore(),/Account changed/);assert.equal(changed.calls.saved.length,0,'Account change during canonical refresh cannot save into the next farm');
 const race=fixture(),old=deferred();race.rpc(who=>who==='first'?old.promise:Promise.resolve({data:race.configurations.second}));const first=race.store.refresh();race.owner('second');await race.store.refresh();old.resolve({data:race.configurations.first});await first;assert.equal(race.store.label('pocket_gems'),'Store opening soon');await assert.rejects(race.store.purchase('pocket_gems'),/opening soon/);assert.equal(race.calls.checkout,0,'Old-owner availability cannot open a new-owner checkout');assert.equal(race.calls.prices,0);
 const stream=fixture();stream.verification(()=>({data:{error:'PURCHASE_ACCOUNT_MISMATCH'}}));stream.rows([paid('wrong')]);await stream.recover();assert.equal(stream.notices.length,0,'Automatic recovery does not spam foreign-account notices');assert.equal(stream.calls.saved.length,0);
 console.log('Commerce225: closed-store/price-outage recovery, mixed-farm restores, pending denial, canonical-refresh owner guard and stale configuration isolation passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
