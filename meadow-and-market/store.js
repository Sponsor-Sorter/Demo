(() => {
 'use strict';
 const native=window.Capacitor?.isNativePlatform?.();
 const plugin=name=>native&&window.Capacitor?.isPluginAvailable?.(name)?window.Capacitor.Plugins?.[name]||window.Capacitor.registerPlugin?.(name):null;
 const billing=plugin('MeadowStore'),ads=plugin('MeadowAds');
 let api,configuration={test_access:false,payments_enabled:false,ads_enabled:false,products:[]},prices=new Map(),owner='',loading=null,busy=false,refreshVersion=0;
 const known=new Set(['starter_pack','pocket_gems','gem_chest','builders_pack','reward_tickets','pantry_pack','premium']);
 async function refresh(withPrices=true){
  if(!api?.ready()||(typeof navigator!=='undefined'&&navigator.onLine===false))throw Error('Connect online for purchases and ad rewards. You can keep exploring your farm.');
  const who=api.user()?.id;
  if(owner!==who){owner=who;configuration={test_access:false,payments_enabled:false,ads_enabled:false,products:[]};prices.clear();}
  if(loading?.who===who&&(!withPrices||loading.withPrices))return loading.promise;
  const version=++refreshVersion,request={who,withPrices,promise:null};
  request.promise=(async()=>{
   const r=await api.client().rpc('meadow_market_commerce_status');if(r.error)throw Error('The shop is temporarily unavailable.');
   if(who!==api.user()?.id||version!==refreshVersion)return;
   configuration=r.data;
   if(withPrices&&billing&&configuration.payments_enabled){prices.clear();const data=await billing.products();if(who===api.user()?.id&&version===refreshVersion)prices=new Map(data.products.map(p=>[p.id,p]));}
  })();
  loading=request;
  try{await request.promise}finally{if(loading===request)loading=null}
 }
 function label(sku){if(configuration.test_access)return 'Free test purchase';if(configuration.purchase_review_required)return 'Purchases need a support review';if(configuration.farm_authoritative===false)return 'Farm review required';if(!billing)return 'Available in Google Play app';if(!configuration.payments_enabled)return 'Store opening soon';const product=configuration.products.find(p=>p.sku===sku),price=prices.get(product?.product_id)?.price;return price?(configuration.provider_test?'Google test · '+price:price):'Currently unavailable';}
 function requirePurchaseAccount(){if(configuration.purchase_account_ready!==true)throw Error('Protect your farm with a username and password before buying or restoring purchases. Open Settings → Account & switch farm.');}
 async function verificationError(result){
  let body=result.data;
  if(!body?.error&&result.error?.context?.json){try{body=await result.error.context.json()}catch{}}
  const code=body?.error;
  const messages={PURCHASE_ACCOUNT_MISMATCH:'This purchase belongs to another farm. Sign into the farm that bought it.',PURCHASE_PENDING:'Payment is pending. Your items will arrive after Google confirms it.',PURCHASE_NOT_COMPLETED:'Google has not completed this purchase. No items were added.',LICENSE_TEST_REQUIRED:'This account only accepts Google test orders. No items were added.'};
  const error=Error(messages[code]||'Purchase verification is pending. Use Restore purchases to retry; no duplicate reward will be added.');error.code=code;return error;
 }
 async function verify(rows,who,silent=false,batch=false){
  let completed=0,failed;
  for(const purchase of rows||[]){
   if(who!==api.user()?.id)throw Error('Sign back into the purchasing account to restore this purchase.');
   if(purchase.pending){if(!silent)api.notify('Payment is pending. Your items will arrive after Google confirms it.');continue;}
   if(purchase.products?.length!==1)throw Error('This purchase needs support.');
   const r=await api.client().functions.invoke('meadow-market-store',{body:{product:purchase.products[0],token:purchase.token}});
   if(r.error||!r.data?.verified){const error=await verificationError(r);if(!batch)throw error;failed ||= error;continue;}
   completed++;
  }
  if(who!==api.user()?.id)throw Error('Account changed. Restore purchases on the purchasing account.');
  if(completed){await window.meadowClub?.refresh();if(who!==api.user()?.id)throw Error('Account changed. Restore purchases on the purchasing account.');api.save();await api.flush();}
  if(failed&&!silent)throw failed;
  return completed;
 }
 async function purchase(sku){
  if(!known.has(sku)||busy)return;busy=true;const who=api.user()?.id;
  try{
   await refresh();if(who!==api.user()?.id)throw Error('Account changed. Reopen the shop.');
   if(configuration.test_access)return {test:true};
   if(configuration.farm_authoritative!==true)throw Error('Purchases for this earlier test farm need a support review. Your farm is safe; contact Meadow Markets support in Settings.');
   if(!billing||!configuration.payments_enabled)throw Error(label(sku));
   requirePurchaseAccount();
   const product=configuration.products.find(p=>p.sku===sku);
   if(!product||!prices.has(product.product_id))throw Error('This product is currently unavailable.');
   await api.flush();
   const result=await billing.purchase({productId:product.product_id,accountId:configuration.account_id});
   if(result.cancelled)return {cancelled:true};
   const count=await verify(result.purchases,who);api.notify(count?'Purchase delivered to your farm.':'Payment pending.');return {delivered:count>0};
  }finally{busy=false}
 }
 async function restore(){
  if(busy||!billing)return;busy=true;const who=api.user()?.id;
  try{await refresh(false);if(who!==api.user()?.id)throw Error('Account changed. Reopen the shop.');requirePurchaseAccount();const result=await billing.restore();const n=await verify(result.purchases,who,false,true);api.notify(n?'Purchases checked and restored.':result.purchases?.some(p=>p.pending)?'Payment is pending. Your items will arrive after Google confirms it.':'No unfinished purchases on this Play account.');}
  finally{busy=false}
 }
 // Google can approve a pending payment while the game is closed. Re-query
 // owned purchases on return; only the server can bind and deliver them.
 let lastRecoveryOwner='',lastRecoveryAt=0;
 async function recover(){
  if(!billing||busy||document.hidden||!api?.ready()||!api.canPlay())return;
  const who=api.user()?.id,now=Date.now();
  if(who===lastRecoveryOwner&&now-lastRecoveryAt<30000)return;
  busy=true;
  try{
   await refresh(false);if(who!==api.user()?.id)return;
   // Closing new checkout must not strand an already-paid receipt. Recovery
   // queries owned purchases only; the server still authorizes every delivery.
   if(configuration.purchase_account_ready!==true)return;
   lastRecoveryOwner=who;lastRecoveryAt=now;
   const result=await billing.restore();if(who!==api.user()?.id)return;
   await verify(result.purchases,who,true,true);
  }catch{ /* Manual Restore remains available after a network/provider failure. */ }
  finally{busy=false}
 }
 async function advertisement(rewarded=false){
  if(busy)return {unavailable:true};busy=true;const who=api.user()?.id;
  const sameAccount=()=>{if(who!==api.user()?.id)throw Error('Account changed. Open the reward on your own farm.');};
  try{
   await refresh();sameAccount();if(configuration.test_access&&!configuration.ads_provider_test)return {test:true};
   if(!ads||!configuration.ads_enabled){api.notify('No ad is available right now. Try again later.');return {unavailable:true};}
   if(!rewarded){await window.meadowClub?.refresh();sameAccount();const wallet=window.meadowClub?.wallet();if(wallet?.premium||wallet?.ads_enabled!==true)return {unavailable:true};}
   const consent=await ads.consent();sameAccount();if(!consent.canRequestAds){api.notify('Advertising privacy choices are unavailable. No ad was shown.');return {unavailable:true};}
   const data={rewarded};
   if(rewarded){const r=await api.client().rpc('meadow_market_start_ad_reward');sameAccount();if(r.error)throw Error('No reward is available right now.');Object.assign(data,{nonce:r.data.nonce,accountId:configuration.account_id});}
   const result=await ads.show(data);sameAccount();
   if(result.earned)api.notify('Ad finished. Your reward arrives after server verification.');
   else if(rewarded)api.notify('Ad closed before the reward was earned. No reward was added.');
   if(result.earned){let checks=0;const timer=setInterval(()=>{if(who!==api.user()?.id||++checks>4){clearInterval(timer);return;}window.meadowClub?.refresh();},5000);}
   // Native earned callbacks never authorize currency, including provider tests.
   return result;
  }finally{busy=false}
 }
 function settings(root){
  if(!billing)return;
  for(const link of root.querySelectorAll('a[href$=".apk"]')){link.href='https://play.google.com/store/apps/details?id=com.meadowandmarket.game';link.removeAttribute('download');link.textContent='Open Meadow Markets in Google Play';}
  const section=root.querySelector('.install-game-card .task-main small');if(section)section.textContent='Google Play installs and updates this version. Your cloud farm stays on your account.';
 }
 function attach(a){api=a;settings(document);window.addEventListener('meadow-cloud-ready',()=>refresh().then(recover).catch(()=>{}));if(billing){billing.addListener('purchasesUpdated',result=>verify(result.purchases,api.user()?.id).catch(e=>api.notify(e.message)));document.addEventListener('visibilitychange',()=>{if(!document.hidden)recover()});window.addEventListener('online',recover);}}
 window.meadowStore={attach,refresh,label,purchase,restore,advertisement,settings,test:()=>configuration.test_access,providerAds:()=>configuration.ads_provider_test===true,adMode:()=>configuration.test_access&&!configuration.ads_provider_test?'preview':configuration.ads_provider_test?'test':configuration.ads_enabled&&ads?'live':'off',available:()=>!!billing,privacy:()=>ads?.privacy()};
})();
