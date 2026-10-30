(() => {
 'use strict';
 function clearDeviceFarm(storage,saveKey,owner,code){
  if(owner)for(const prefix of ['meadow-farm-command-v1:','meadow-farm-start-v1:','meadow-ui-v1:'])storage.removeItem(prefix+owner);
  for(const key of Object.keys(storage).filter(k=>k.startsWith(saveKey)||k==='meadow-market-before-shared-pantry')){
   if(key===saveKey||[saveKey+'-owner',saveKey+'-protocol',saveKey+'-load-account',saveKey+'-cloud-ack',saveKey+'-pending-cloud-review',saveKey+'-account-'+owner].includes(key)){storage.removeItem(key);continue;}
   try{if(JSON.parse(storage.getItem(key))?.friendCode===code)storage.removeItem(key)}catch{}
  }
 }
 async function show(){
  const existing=document.getElementById('account-privacy-dialog');if(existing){existing.focus();return;}
  const client=window.meadowSupabase;let owner=null,busy=false;
  const root=document.createElement('dialog');root.id='account-privacy-dialog';root.className='sheet account-privacy-dialog';root.setAttribute('aria-label','Privacy and account deletion');
  root.innerHTML='<div class="sheet-head"><div><small class="eyebrow">YOUR MEADOW MARKETS ACCOUNT</small><h2>Privacy & deletion</h2></div><button class="close-button" aria-label="Close privacy">×</button></div><p><a href="privacy.html" target="_blank" rel="noopener">Privacy policy</a> · <a href="delete-account.html" target="_blank" rel="noopener">Account deletion website</a></p><div id="account-delete-body" aria-live="polite">Checking your account…</div>';
  document.body.append(root);root.showModal();let reading=false;
  root.querySelector('.close-button').onclick=()=>{if(!busy||reading){root.close();root.remove();}};root.addEventListener('cancel',e=>{if(busy&&!reading)e.preventDefault();else root.remove();});
  async function draw(action='status'){
   busy=true;reading=action==='status';
   try{
    if(!client)throw Error('Connect online and sign in to manage this account.');
    const {data:{user:current}}=await client.auth.getUser();if(!current)throw Error('Sign in to manage this account.');
    if(owner&&current.id!==owner)throw Error('Account changed. Reopen this screen.');owner=current.id;
    const result=await client.rpc('meadow_market_account_deletion',{p_action:action});if(result.error)throw Error(result.error.message);
    if(!root.isConnected)return;
    const body=root.querySelector('#account-delete-body');body.replaceChildren();
    if(result.data.deleted){body.textContent='This Meadow Markets account has been deleted. Sign out and start a new guest farm if you want to play again.';return;}
    const copy=document.createElement('p');copy.textContent=result.data.pending?'Deletion requested. Your Meadow Markets farm, username, friends and game history will be removed after '+new Date(result.data.execute_after).toLocaleDateString()+'. You can cancel until then. Other apps are unaffected.':'Request deletion of this Meadow Markets account and its farm, friends and game history. A seven-day cancellation window protects you from mistakes. Purchase records required for legal or fraud purposes may be retained separately. Other apps are unaffected.';body.append(copy);
    if(!result.data.pending){const label=document.createElement('label');label.textContent='Type DELETE to confirm';const input=document.createElement('input');input.id='deletion-confirmation';input.autocomplete='off';input.setAttribute('aria-label','Type DELETE to confirm');label.append(input);body.append(label);}
    const button=document.createElement('button');button.className='small-button full-button';button.textContent=result.data.pending?'Cancel deletion request':'Request account deletion';body.append(button);
    button.onclick=()=>{if(busy)return;if(!result.data.pending&&body.querySelector('input').value!=='DELETE'){body.querySelector('input').focus();return;}draw(result.data.pending?'cancel':'request');};
   }catch(error){if(root.isConnected)root.querySelector('#account-delete-body').textContent=error.message||'Connect online and try again.';}finally{busy=false;reading=false;}
  }
  await draw();
 }
 window.meadowAccountPrivacy={show,clearDeviceFarm};
})();
