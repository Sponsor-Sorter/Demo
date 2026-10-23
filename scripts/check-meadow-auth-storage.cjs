const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
module.exports=(async()=>{
  const primary='meadow-markets-auth-v1',guest='meadow-markets-guest-session';
  const local=values=>({getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)});
  const scope={window:{},localStorage:local(new Map())};vm.runInNewContext(fs.readFileSync('meadow-and-market/auth-storage.js','utf8'),scope);const create=scope.window.meadowAuthStorage.create;
  const plain=new Map([[primary,'existing-session'],[guest,'guest-refresh'],['other-app','untouched']]),encrypted=new Map();
  const vault={get:async({key})=>({value:encrypted.get(key)??null}),set:async({key,value})=>encrypted.set(key,value),remove:async({key})=>encrypted.delete(key)};
  const adapter=create(local(plain),vault);await adapter.ready;assert.equal(encrypted.get(primary),'existing-session');assert.equal(encrypted.get(guest),'guest-refresh');assert(!plain.has(primary));assert.equal(plain.get('other-app'),'untouched');assert(adapter.secure);
  await adapter.storage.setItem(primary,'rotated-refresh');assert.equal(await adapter.storage.getItem(primary),'rotated-refresh');await adapter.storage.removeItem(primary);assert.equal(await adapter.storage.getItem(primary),null);
  await assert.rejects(adapter.storage.getItem('other-app'));
  const old=new Map([[primary,'old']]),newer=new Map([[primary,'new']]);const current=create(local(old),{...vault,get:async({key})=>({value:newer.get(key)??null})});await current.ready;assert.equal(await current.storage.getItem(primary),'new');assert(!old.has(primary));
  const recoverable=new Map([[primary,'safe-copy']]);const broken=create(local(recoverable),{...vault,get:async()=>({value:null}),set:async()=>{throw Error('Keystore locked')}});await assert.rejects(broken.ready);assert.equal(recoverable.get(primary),'safe-copy','Failed migration retains the existing login');
  const unreadable=create(local(new Map([[primary,'safe-copy']])),{...vault,get:async()=>{throw Error('Bad envelope')}});await assert.rejects(unreadable.ready);
  const web=create(local(new Map()));await web.ready;await web.storage.setItem(primary,'web-session');assert.equal(await web.storage.getItem(primary),'web-session');assert(!web.secure);
  const nativeScope={window:{Capacitor:{isNativePlatform:()=>true,isPluginAvailable:name=>name==='MeadowVault',Plugins:{MeadowVault:vault}}},localStorage:local(new Map([[primary,'native-existing-session']]))};vm.runInNewContext(fs.readFileSync('meadow-and-market/auth-storage.js','utf8'),nativeScope);await nativeScope.window.meadowAuthStorage.ready;assert(nativeScope.window.meadowAuthStorage.secure);assert.equal(await nativeScope.window.meadowAuthStorage.storage.getItem(primary),'native-existing-session','Classic-script native bridge works without importing @capacitor/core');
  const java=fs.readFileSync('tools/meadow-android/android/app/src/main/java/com/meadowandmarket/game/MeadowVaultPlugin.java','utf8');assert(java.includes('AES/GCM/NoPadding'));assert(java.includes('updateAAD'));assert(java.includes('AndroidKeyStore'));assert(java.includes('sponsorsorter.com'));assert(java.includes('/meadow-and-market/'));
  for(const file of ['account_backup_rules.xml','account_extraction_rules.xml'])assert(fs.readFileSync('tools/meadow-android/android/app/src/main/res/xml/'+file,'utf8').includes('meadow_auth_vault.xml'));
  console.log('Account storage: verified native migration, refresh replacement, failed/locked vault recovery, app key isolation, web fallback and backup exclusions passed.');
})();
