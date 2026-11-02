const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('meadow-and-market/store.js','utf8');
function fixture(config={}){
 let owner='phone',rows=[],afterRestore;const events={},calls={restore:0,verify:0,flush:0},notices=[];
 const configuration={payments_enabled:true,purchase_account_ready:true,test_access:false,account_id:'a'.repeat(64),products:[],...config};
 const billing={products:async()=>({products:[]}),addListener(){},restore:async()=>{calls.restore++;afterRestore?.();return {purchases:rows}}};
 const scope={Date,window:{Capacitor:{isNativePlatform:()=>true,isPluginAvailable:n=>n==='MeadowStore',Plugins:{MeadowStore:billing}},addEventListener:(n,f)=>events[n]=f,meadowClub:{refresh:async()=>{}}},document:{hidden:false,addEventListener:(n,f)=>events[n]=f,querySelectorAll:()=>[],querySelector:()=>null}};
 vm.runInNewContext(source.replace('window.meadowStore={','window.recoverBilling=recover;window.meadowStore={'),scope);
 scope.window.meadowStore.attach({ready:()=>true,canPlay:()=>true,user:()=>({id:owner}),save(){},flush:async()=>{calls.flush++},notify:t=>notices.push(t),client:()=>({rpc:async()=>({data:configuration}),functions:{invoke:async()=>{calls.verify++;return {data:{verified:true}}}}})});
 return {scope,calls,notices,setRows:r=>rows=r,switchOnRestore:()=>afterRestore=()=>owner='other'};
}
(async()=>{
 const pending=fixture();pending.setRows([{pending:true}]);await pending.scope.window.recoverBilling();assert.equal(pending.calls.verify,0,'Pending payment never reaches delivery');assert.equal(pending.notices.length,0,'Automatic recovery stays quiet for pending orders');
 const paid=fixture();paid.setRows([{pending:false,products:['mm_pocket_gems'],token:'test-token'}]);await paid.scope.window.recoverBilling();await paid.scope.window.recoverBilling();assert.equal(paid.calls.verify,1,'Resume recovery is bounded');assert.equal(paid.calls.flush,1,'Only verified server state is saved');
 const changed=fixture();changed.setRows([{pending:false,products:['mm_premium'],token:'test-token'}]);changed.switchOnRestore();await changed.scope.window.recoverBilling();assert.equal(changed.calls.verify,0,'Account switch during native query cannot verify on another farm');
 for(const gate of [{test_access:true},{payments_enabled:false},{purchase_account_ready:false}]){const f=fixture(gate);await f.scope.window.recoverBilling();assert.equal(f.calls.restore,0,'Closed storefront/free or unprotected account never queries provider');}
 const clubSource=fs.readFileSync('meadow-and-market/farm-club.js','utf8'),balance={innerHTML:''},premium={},dialog={querySelector:s=>s==='.club-wallet'?balance:s==='[data-pack="premium"]'?premium:null};
 const scope={window:{meadowStore:{label:()=>'$9.99'}},document:{getElementById:()=>null}};
 vm.runInNewContext(clubSource.replace('window.meadowClub={','window.receiveWallet=(data)=>{dialog=window.testDialog;receive(data)};window.meadowClub={'),scope);scope.window.testDialog=dialog;
 scope.window.receiveWallet({wallet:{gems:895,reward_turns:1,premium:true}});assert.match(balance.innerHTML,/895/);assert.equal(premium.disabled,true);
 scope.window.receiveWallet({wallet:{gems:795,reward_turns:1,premium:false}});assert.match(balance.innerHTML,/795/);assert.equal(premium.disabled,false,'Verified refund updates an open shop without rebuilding its scroll/form');
 console.log('Billing223: pending denial, server-only delivery, bounded resume, account-switch guards and live wallet/Premium display passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
