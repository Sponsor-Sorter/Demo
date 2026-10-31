(() => {
 'use strict';
 const native=window.Capacitor?.isNativePlatform?.();
 const plugin=name=>native&&window.Capacitor?.isPluginAvailable?.(name)?window.Capacitor.Plugins?.[name]||window.Capacitor.registerPlugin?.(name):null;
 const billing=plugin('MeadowStore'),ads=plugin('MeadowAds');
 let api,configuration={test_access:false,payments_enabled:false,ads_enabled:false,products:[]},prices=new Map(),owner='',loading=null,busy=false;
 const known=new Set(['starter_pack','pocket_gems','gem_chest','builders_pack','reward_tickets','pantry_pack','premium']);
 async function refresh(){
  if(!api?.ready())return;if(loading)return loading;
  const who=api.user()?.id;
  if(owner!==who){owner=who;configuration={test_access:false,payments_enabled:false,ads_enabled:false,products:[]};prices.clear();}
  loading=(async()=>{
   const r=await api.client().rpc('meadow_market_commerce_status');if(r.error)throw Error('The shop is temporarily unavailable.');
   if(who!==api.user()?.id)return;
   configuration=r.data;
   if(billing&&configuration.payments_enabled){const data=await billing.products();if(who===api.user()?.id)prices=new Map(data.products.map(p=>[p.id,p]));}
  })();
  try{await loading}finally{loading=null}
 }
 function label(sku){if(configuration.test_access)return 'Free test purchase';if(configuration.purchase_review_required)return 'Purchases need a support review';if(!billing)return 'Available in Google Play app';if(!configuration.payments_enabled)return 'Store opening soon';const product=configuration.products.find(p=>p.sku===sku),price=prices.get(product?.product_id)?.price;return price?(configuration.provider_test?'Google test · '+price:price):'Currently unavailable';}
 function requirePurchaseAccount(){if(configuration.purchase_account_ready!==true)throw Error('Protect your farm with a username and password before buying or restoring purchases. Open Settings → Account & switch farm.');}
 async function verify(rows,who){
  let completed=0;
  for(const purchase of rows||[]){
   if(who!==api.user()?.id)throw Error('Sign back into the purchasing account to restore this purchase.');
   if(purchase.pending){api.notify('Payment is pending. Your items will arrive after Google confirms it.');continue;}
   if(purchase.products?.length!==1)throw Error('This purchase needs support.');
   const r=await api.client().functions.invoke('meadow-market-store',{body:{product:purchase.products[0],token:purchase.token}});
   if(r.error||!r.data?.verified)throw Error(r.data?.error||'Purchase verification is pending. Use Restore purchases to retry.');
   completed++;
  }
  if(who!==api.user()?.id)throw Error('Account changed. Restore purchases on the purchasing account.');
  await window.meadowClub?.refresh();api.save();await api.flush();return completed;
 }
 async function purchase(sku){
  if(!known.has(sku)||busy)return;busy=true;const who=api.user()?.id;
  try{
   await refresh();if(who!==api.user()?.id)throw Error('Account changed. Reopen the shop.');
   if(configuration.test_access)return {test:true};
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
  try{await refresh();if(who!==api.user()?.id)throw Error('Account changed. Reopen the shop.');requirePurchaseAccount();const result=await billing.restore();const n=await verify(result.purchases,who);api.notify(n?'Purchases checked and restored.':'No unfinished purchases on this Play account.');}
  finally{busy=false}
 }
 async function advertisement(rewarded=false){
  await refresh();if(configuration.test_access)return {test:true};
  if(!ads||!configuration.ads_enabled)return {unavailable:true};
  const consent=await ads.consent();if(!consent.canRequestAds)return {unavailable:true};
  const data={rewarded};
  if(rewarded){const r=await api.client().rpc('meadow_market_start_ad_reward');if(r.error)throw Error('No reward is available right now.');Object.assign(data,{nonce:r.data.nonce,accountId:configuration.account_id});}
  const result=await ads.show(data);
  if(result.earned)api.notify('Ad finished. Your reward arrives after server verification.');
  if(result.earned){let checks=0;const who=api.user()?.id;const timer=setInterval(()=>{if(who!==api.user()?.id||++checks>4){clearInterval(timer);return;}window.meadowClub?.refresh();},5000);}
  // Native earned callbacks never authorize currency.
  return result;
 }
 function settings(root){
  if(!billing)return;
  for(const link of root.querySelectorAll('a[href$=".apk"]')){link.href='https://play.google.com/store/apps/details?id=com.meadowandmarket.game';link.removeAttribute('download');link.textContent='Open Meadow Markets in Google Play';}
  const section=root.querySelector('.install-game-card .task-main small');if(section)section.textContent='Google Play installs and updates this version. Your cloud farm stays on your account.';
 }
 function attach(a){api=a;settings(document);window.addEventListener('meadow-cloud-ready',()=>refresh().catch(()=>{}));if(billing)billing.addListener('purchasesUpdated',result=>verify(result.purchases,api.user()?.id).catch(e=>api.notify(e.message)));}
 window.meadowStore={attach,refresh,label,purchase,restore,advertisement,settings,test:()=>configuration.test_access,available:()=>!!billing,privacy:()=>ads?.privacy()};
})();
