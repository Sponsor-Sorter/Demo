/* Meadow Market Littles only. All game balances/shop flags are unverified client data. */
(() => {
 'use strict';
 const CONFIG={url:'https://ejavqlyozqhzqogflqzr.supabase.co',key:'sb_publishable_NGAHium82O8-2idyjUON5w_37bUAezE',storageKey:'meadow-littles-auth-v1'};
 const clone=x=>JSON.parse(JSON.stringify(x));
 const known=new Set(['LITTLES_SIGN_IN_REQUIRED','LITTLES_SESSION_EXPIRED','LITTLES_ACCOUNT_CHANGED','LITTLES_INVALID_DISPLAY_NAME','LITTLES_INVALID_SAVE','LITTLES_OPEN_REQUIRED','LITTLES_REQUEST_BINDING_CONFLICT','LITTLES_SAVE_REVISION_CONFLICT','LITTLES_SAVE_RATE_LIMIT','LITTLES_BANNED','LITTLES_CONTROL_UNAVAILABLE','LITTLES_WARNING_NOT_AVAILABLE','LITTLES_APPEAL_NOT_ACCEPTED']);
 const REMEMBERED='meadow-littles-account-v1';
 let client,store,options={},user=null,profile=null,remote=null,revision=0,ready=false,busy=false,latest=null,timer=null,dialog=null,updateDialog=null,status='offline',lastError=null,connecting=null,authBusy=false,listening=false,subscribedClient=null,reconnectTimer=null,controlsState={moderation:null,runtime:null,build:53};
 const prefix=uid=>'meadow-littles-cloud-v1:'+uid+':';
 function read(name){try{return JSON.parse(store.getItem(name)||'null')}catch{return null}}
 function write(name,value){if(value===null)store.removeItem(name);else store.setItem(name,JSON.stringify(value))}
 function notify(state,code=null){status=state;lastError=code;try{options.onStatus?.({state,code,userId:user?.id||null,isGuest:!!user?.is_anonymous,revision})}catch{}updateDialog?.();return {state,code,revision};}
 function failure(code){const e=new Error(code);e.code=code;return e}
 function codeOf(e){return known.has(e?.message)?e.message:'LITTLES_CLOUD_UNAVAILABLE'}
 async function actor(){const {data,error}=await client.auth.getUser();if(error||!data?.user)throw failure('LITTLES_SIGN_IN_REQUIRED');if(user&&data.user.id!==user.id)throw failure('LITTLES_ACCOUNT_CHANGED');user=data.user;return data.user;}
 async function rpc(name,body){const {data,error}=await client.rpc(name,body);if(error)throw failure(codeOf(error));if(data?.ok!==true||data.contract!=='meadow-littles-cloud-v1'||data.entitlements_verified!==false)throw failure('LITTLES_CLOUD_UNAVAILABLE');return data;}
 async function fairplay(action,data={}){
  if(!client)throw failure('LITTLES_CONTROL_UNAVAILABLE');
  const result=await client.functions.invoke('meadow-littles-fairplay',{body:{action,...data}});
  let payload=result.data;
  if(result.error){try{payload??=await result.error.context?.json?.()}catch{}if(payload?.moderation)controlsState.moderation=payload.moderation;const code=known.has(payload?.code)?payload.code:'LITTLES_CONTROL_UNAVAILABLE';throw failure(code);}
  if(!payload?.ok)throw failure(known.has(payload?.code)?payload.code:'LITTLES_CONTROL_UNAVAILABLE');
  if(payload.moderation)controlsState.moderation=payload.moderation;
  if(payload.runtime)controlsState.runtime=payload.runtime;
  if(payload.build)controlsState.build=payload.build;
  return payload;
 }
 function validateOpen(data){const s=data?.save;if(!s||s.cloud_version!==1||!Number.isSafeInteger(s.revision)||s.revision<0||!s.data||typeof s.data!=='object'||Array.isArray(s.data)||data.profile?.user_id!==user.id)throw failure('LITTLES_CLOUD_UNAVAILABLE');return s;}
 async function load(){const state=await fairplay('status');if(state.moderation?.banned===true)throw failure('LITTLES_BANNED');await actor();const data=await rpc('meadow_littles_open',{});remote=validateOpen(data);profile=data.profile;revision=remote.revision;return data;}
 async function connect(){
  ready=false;const session=await client.auth.getSession();if(session.error)throw failure(session.error.status>=400&&session.error.status<500&&session.error.status!==429?'LITTLES_SIGN_IN_REQUIRED':'LITTLES_CLOUD_UNAVAILABLE');
  if(!session.data?.session){if(read(REMEMBERED))throw failure('LITTLES_SIGN_IN_REQUIRED');const signed=await client.auth.signInAnonymously();if(signed.error||!signed.data?.user)throw failure('LITTLES_SIGN_IN_REQUIRED');}
  const identity=await client.auth.getUser();if(identity.error||!identity.data?.user)throw failure(identity.error&&(!identity.error.status||identity.error.status>=500)?'LITTLES_CLOUD_UNAVAILABLE':'LITTLES_SIGN_IN_REQUIRED');
  if(user&&user.id!==identity.data.user.id){latest=null;profile=null;remote=null;clearTimeout(timer);write(prefix(identity.data.user.id)+'choice',true);}
  user=identity.data.user;
  write(REMEMBERED,{userId:user.id});
  const linked=await fairplay('connect');
  if(controlsState.moderation?.banned===true){remote=null;revision=0;notify('banned','LITTLES_BANNED');return;}
  remote=validateOpen(linked.account);profile=linked.account.profile;revision=remote.revision;
  const pending=read(prefix(user.id)+'pending'),meta=read(prefix(user.id)+'meta');
  if(pending){notify('retry_required');return;}
  if(read(prefix(user.id)+'choice')||(revision>0&&meta?.revision!==revision)){notify('choice_required');return;}
  ready=true;notify('ready');if(latest)schedule();
 }
 function schedule(){clearTimeout(timer);timer=setTimeout(()=>{flush().catch(()=>{})},1200);}
 async function init(config={}){
  options=config;store=config.storage||globalThis.localStorage;
  bindReconnect();return reconnect();
 }
 function bindReconnect(){
  if(listening)return;listening=true;
  globalThis.addEventListener?.('online',()=>resume());
  globalThis.document?.addEventListener?.('visibilitychange',()=>{if(document.visibilityState==='visible')resume()});
  globalThis.addEventListener?.('pageshow',()=>resume());
 }
 function resume(){if(authBusy||busy||connecting||status==='signed_out')return;clearTimeout(reconnectTimer);reconnectTimer=setTimeout(()=>reconnect(),150);}
 async function reconnect(){
  if(connecting)return connecting;
  if(authBusy||busy)return {ok:false,state:status};
  connecting=(async()=>{try{
   notify('connecting');
   client=options.client||client;if(!client){const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm');client=createClient(CONFIG.url,CONFIG.key,{auth:{storage:store,storageKey:CONFIG.storageKey,persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});}
   if(subscribedClient!==client){subscribedClient=client;client.auth.onAuthStateChange?.((event)=>{
    // Supabase holds its auth lock during callbacks. Reconnect outside it.
    if(event==='SIGNED_OUT'&&!authBusy){ready=false;user=null;profile=null;remote=null;latest=null;clearTimeout(timer);notify('auth_required','LITTLES_SIGN_IN_REQUIRED');}
    else if(['SIGNED_IN','USER_UPDATED','TOKEN_REFRESHED'].includes(event)&&!authBusy&&!connecting)resume();
   });}
   await connect();return {ok:true,state:status,revision};
  }catch(e){const code=e.code||'LITTLES_CLOUD_UNAVAILABLE';notify(code==='LITTLES_SIGN_IN_REQUIRED'?'auth_required':'offline',code);return {ok:false,state:status,code:lastError};}
  finally{connecting=null;}})();return connecting;
 }
 function queueSave(snapshot){try{latest=clone(snapshot);if(ready)schedule();return true}catch{notify('error','LITTLES_INVALID_SAVE');return false}}
 async function flush(){
  clearTimeout(timer);if(!client||!user||busy)return {ok:false,state:status};
  let pending=read(prefix(user.id)+'pending');if(!ready&&!pending)return {ok:false,state:status};if(!pending&&!latest)return {ok:true,state:status};
  busy=true;
  try{
   await actor();
   if(!pending){const snapshot=latest;pending={p_request_id:crypto.randomUUID(),p_expected_revision:revision,p_cloud_version:1,p_save_data:clone(snapshot),p_expected_user_id:user.id};write(prefix(user.id)+'pending',pending);latest=null;}
   if(pending.p_expected_user_id!==user.id)throw failure('LITTLES_ACCOUNT_CHANGED');
   notify('saving');const saved=await fairplay('save',{save:{p_request_id:pending.p_request_id,p_expected_revision:pending.p_expected_revision,p_cloud_version:pending.p_cloud_version,p_save_data:pending.p_save_data}});const result=saved.result;
   if(result.request_id!==pending.p_request_id||!Number.isSafeInteger(result.revision)||result.revision!==pending.p_expected_revision+1||typeof result.replayed!=='boolean')throw failure('LITTLES_CLOUD_UNAVAILABLE');
   revision=result.revision;write(prefix(user.id)+'meta',{revision});write(prefix(user.id)+'pending',null);ready=true;notify('saved');return {ok:true,revision,replayed:result.replayed};
  }catch(e){ready=false;const code=e.code||'LITTLES_CLOUD_UNAVAILABLE';notify(code==='LITTLES_BANNED'?'banned':code==='LITTLES_SAVE_REVISION_CONFLICT'||code==='LITTLES_REQUEST_BINDING_CONFLICT'?'choice_required':'retry_required',code);return {ok:false,state:status,code};}
  finally{busy=false;if(ready&&latest)schedule();}
 }
 async function choose(which){
  if(busy)throw failure('LITTLES_OPERATION_IN_PROGRESS');await load();
  if(which==='cloud'&&revision>0){if(remote.data.schema!==1||options.applyState?.(clone(remote.data))!==true)throw failure('LITTLES_INVALID_SAVE');latest=null;}
  else if(which==='device'){latest=clone(options.getState?.());if(!latest||latest.schema!==1)throw failure('LITTLES_INVALID_SAVE');}
  else throw failure('LITTLES_INVALID_SAVE');
  write(prefix(user.id)+'pending',null);write(prefix(user.id)+'meta',{revision});write(prefix(user.id)+'choice',null);ready=true;notify('ready');if(latest)return flush();return {ok:true,revision};
 }
 const redirect=()=>new URL(location.pathname,location.origin).href;
 async function linkEmail(email){await actor();const r=await client.auth.updateUser({email:email.trim()},{emailRedirectTo:redirect()});if(r.error)throw failure('LITTLES_EMAIL_LINK_UNAVAILABLE');return {ok:true,verificationRequired:true};}
 async function verifyEmail(email,token){const r=await client.auth.verifyOtp({email:email.trim(),token:token.trim(),type:'email_change'});if(r.error)throw failure('LITTLES_EMAIL_VERIFICATION_FAILED');await actor();return {ok:true};}
 async function setPassword(password){const u=await actor();if(!u.email_confirmed_at||u.is_anonymous)throw failure('LITTLES_EMAIL_VERIFICATION_REQUIRED');const r=await client.auth.updateUser({password});if(r.error)throw failure('LITTLES_PASSWORD_UPDATE_FAILED');return {ok:true};}
 async function signIn(email,password){if(busy||connecting||authBusy)throw failure('LITTLES_OPERATION_IN_PROGRESS');if(!client)throw failure('LITTLES_CLOUD_UNAVAILABLE');authBusy=true;clearTimeout(timer);try{const r=await client.auth.signInWithPassword({email:email.trim(),password});if(r.error)throw failure('LITTLES_SIGN_IN_FAILED');latest=null;ready=false;user=null;profile=null;remote=null;write(REMEMBERED,{userId:r.data.user.id});write(prefix(r.data.user.id)+'choice',true);try{await connect()}catch(e){notify('offline',e.code||'LITTLES_CLOUD_UNAVAILABLE');return {ok:false,state:status,code:lastError}}return {ok:true};}finally{authBusy=false;if(ready&&latest)schedule();}}
 async function recover(email){const r=await client.auth.resetPasswordForEmail(email.trim(),{redirectTo:redirect()});if(r.error)throw failure('LITTLES_RECOVERY_UNAVAILABLE');return {ok:true};}
 async function signOut(){if(busy||connecting||authBusy)throw failure('LITTLES_OPERATION_IN_PROGRESS');if(user?.is_anonymous)throw failure('LITTLES_LINK_EMAIL_BEFORE_SIGN_OUT');authBusy=true;try{const r=await client.auth.signOut({scope:'local'});if(r.error)throw failure('LITTLES_SIGN_OUT_FAILED');write(REMEMBERED,{signedOut:true});ready=false;user=null;profile=null;remote=null;latest=null;clearTimeout(timer);notify('signed_out');}finally{authBusy=false}}
 async function changeName(value){
  if(busy||connecting||authBusy)throw failure('LITTLES_OPERATION_IN_PROGRESS');
  const name=String(value).trim();if(!name||Array.from(name).length>32||/[\u0000-\u001f\u007f-\u009f]/u.test(name))throw failure('LITTLES_INVALID_DISPLAY_NAME');
  authBusy=true;try{const current=await actor();const data=await rpc('meadow_littles_open',{p_display_name:name});
  if((await actor()).id!==current.id||data.profile?.user_id!==current.id)throw failure('LITTLES_ACCOUNT_CHANGED');
  profile=data.profile;return {ok:true,displayName:profile.display_name};}finally{authBusy=false}
 }
 function openAccount(){
  if(dialog?.open){dialog.focus();return;}
  const d=document.createElement('dialog');dialog=d;d.className='littles-account';d.setAttribute('aria-label','Cloud save and grown-up account');
  const add=(tag,text)=>{const el=document.createElement(tag);el.textContent=text;d.append(el);return el};
  const closeAccount=()=>{d.close();d.remove();dialog=null;updateDialog=null;};
  // Focus a non-editable control so opening the panel does not raise the phone keyboard.
  const topClose=add('button','×');topClose.type='button';topClose.className='account-close';topClose.autofocus=true;topClose.setAttribute('aria-label','Close account');topClose.onclick=closeAccount;
  add('h2','Grown-up account');add('p','Stay signed in on this device and keep your farm progress safe.');
  const stateMessage={connecting:'Connecting to your saved account…',ready:'Connected. Your sign-in is saved on this device.',saved:'Your progress is saved online.',saving:'Saving your progress…',offline:'You can keep playing. We’ll reconnect when you’re online.',auth_required:'Please sign in again. Your progress is still saved on this device.',signed_out:'Signed out. Your progress is still saved on this device.',choice_required:'Choose which progress to keep below. Nothing is replaced automatically.',retry_required:'Your progress is on this device. Retry the pending cloud save below.',banned:'Cloud saves are paused. A grown-up can check account safety below.'};
  const result=add('p',stateMessage[status]||'Check your account and cloud save below.');result.setAttribute('role','status');
  const accountIdentity=()=>[user?.id||'',!!user?.is_anonymous,!!user?.email_confirmed_at,!!profile].join(':');
  const renderedIdentity=accountIdentity();
  const messages={LITTLES_INVALID_DISPLAY_NAME:'Use an account name with 1–32 characters and no control characters.',LITTLES_SIGN_IN_FAILED:'Check the grown-up email and password, then try again.',LITTLES_OPERATION_IN_PROGRESS:'Please wait for the current account step to finish.',LITTLES_SIGN_IN_REQUIRED:'Please sign in again. Your saved progress is still safe.',LITTLES_CLOUD_UNAVAILABLE:'Could not connect. Check your connection and try again.'};
  function button(label,run){const b=add('button',label);b.type='button';b.onclick=async()=>{b.disabled=true;const before=accountIdentity();try{const r=await run();if(d.open&&before!==accountIdentity()){d.close();d.remove();dialog=null;openAccount();return;}renderSafety();result.textContent=r?.displayName?'Account name saved. You can be found by this name for Littles Plus.':r?.verificationRequired?'Check the email confirmation link. After verification, set a password.':r?.ok===false?(messages[r.code]||stateMessage[r.state]||'Please try this step again.'):(stateMessage[status]||'Done.');}catch(e){renderSafety();result.textContent=messages[e.code]||'Could not complete this step. Please try again.'}finally{b.disabled=false;}};return b;}
  if(user){
   add('h3','Your account');
   const nameLabel=add('label','Account username');const name=document.createElement('input');name.type='text';name.maxLength=32;name.autocomplete='nickname';name.value=profile?.display_name||'';nameLabel.append(name);
   add('p','Choose a memorable nickname so we can find your account for Littles Plus.');
   button('Save account name',()=>changeName(name.value));
   const idLabel=add('label','Account ID');const id=document.createElement('input');id.type='text';id.value=user.id;id.readOnly=true;id.className='littles-account-id';idLabel.append(id);
   add('p','Names can be shared. Include this account ID if we need to check which account is yours.');
   if(!user.is_anonymous)add('p','Signed in as '+(user.email||'your grown-up account')+'. You’ll sign in automatically next time, until you choose to sign out.');
  }
  const safety=document.createElement('section');safety.setAttribute('aria-label','Fairplay account safety');d.append(safety);
  function renderSafety(){
   safety.replaceChildren();const heading=document.createElement('h3');heading.textContent='Account safety';safety.append(heading);
   const moderation=controlsState.moderation,runtime=controlsState.runtime;
   const note=document.createElement('p');
   note.textContent=!moderation?'Account safety status is not available yet.':moderation.banned?'Cloud saves are paused for this account. Local play, account recovery and appeals remain available.':moderation.restricted?'Some account actions are limited. Littles has no server-run public player lobby; same-device and local-network games remain local.':'No active account restrictions.';safety.append(note);
   if(runtime?.maintenance){const maintenance=document.createElement('p');maintenance.textContent='Fairplay maintenance is active. Littles has no server-run game admission; local games remain available.';safety.append(maintenance);}
   for(const notice of runtime?.notices||[]){const item=document.createElement('article'),title=document.createElement('strong'),message=document.createElement('p');title.textContent=notice.title||'Meadow Market notice';message.textContent=notice.message||'';item.append(title,message);safety.append(item);}
   for(const decision of moderation?.decisions||[]){
    const item=document.createElement('article'),title=document.createElement('h4'),reason=document.createElement('p');
    title.textContent=decision.kind==='moderation.warning'?'A grown-up note':decision.kind==='moderation.restrict'?'Account restriction':'Account ban';
    reason.textContent=decision.reason||'A grown-up reviewed this account action.';item.append(title,reason);
    if(decision.expires_at){const expiry=document.createElement('p');expiry.textContent='Until '+new Date(decision.expires_at).toLocaleDateString();item.append(expiry);}
    const actionButton=(label,run)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.style.cssText='display:block;margin:8px 0;padding:10px;';b.onclick=async()=>{b.disabled=true;try{const response=await run();result.textContent=response?.duplicate?'This appeal was already received.':label==='Acknowledge note'?'Note acknowledged.':'Appeal sent for review.';renderSafety();}catch(e){result.textContent=e.code||'Could not complete this step. Please try again.'}finally{b.disabled=false;}};item.append(b);};
    if(decision.kind==='moderation.warning'&&!decision.acknowledged_at)actionButton('Acknowledge note',()=>fairplay('ack',{decision:decision.id}));
    const appealLabel=document.createElement('label');appealLabel.textContent='Ask a grown-up to appeal this decision';const appealText=document.createElement('textarea');appealText.rows=3;appealText.maxLength=2000;appealText.setAttribute('aria-label','Appeal reason');appealLabel.append(appealText);item.append(appealLabel);
    actionButton('Send appeal',()=>fairplay('appeal',{decision:decision.id,requestId:crypto.randomUUID(),reason:appealText.value}));
    safety.append(item);
   }
   const refresh=document.createElement('button');refresh.type='button';refresh.textContent='Refresh safety status';refresh.onclick=async()=>{refresh.disabled=true;try{await fairplay('status');renderSafety();result.textContent='Account safety status refreshed.'}catch(e){result.textContent=e.code||'Could not refresh account safety status.'}finally{refresh.disabled=false;}};safety.append(refresh);
  }
  renderSafety();
  if(!client||!user)button('Connect cloud save',reconnect);
  else{
   add('p',user.is_anonymous?'Guest account':'Recoverable account');
   button('Reconnect account',reconnect);
   button('Retry pending save',flush);
   if(remote?.revision>0)button('Use cloud progress',()=>choose('cloud'));
   button('Keep this device’s progress',async()=>{if(!confirm('Replace this account’s cloud progress with the progress on this device?'))return {ok:false,state:'cancelled'};return choose('device')});
  }
  if(client){
   add('h3',user?.is_anonymous?'Save or recover your account':'Sign-in details');
   if(user?.is_anonymous)add('p','Link and verify a grown-up email, then set a password to recover this guest save on another device.');
   const label=add('label','Grown-up email');const email=document.createElement('input');email.type='email';email.name='username';email.autocomplete='username';email.autocapitalize='none';email.spellcheck=false;email.value=user?.email||'';label.append(email);
   if(user?.is_anonymous){
   button('Link email to this guest save',()=>linkEmail(email.value));
   const codeLabel=add('label','Email confirmation code (if included in the email)');const code=document.createElement('input');code.inputMode='numeric';code.autocomplete='one-time-code';codeLabel.append(code);
   button('Verify email code',()=>verifyEmail(email.value,code.value));
   }
   const passLabel=add('label','Password');const password=document.createElement('input');password.type='password';password.autocomplete='current-password';passLabel.append(password);
   if(user)button('Set password after email verification',async()=>{const r=await setPassword(password.value);password.value='';return r});
   button('Sign in to an existing account',async()=>{const r=await signIn(email.value,password.value);password.value='';return r});
   button('Send password recovery email',()=>recover(email.value));
   if(user&&!user.is_anonymous)button('Sign out from Littles',signOut);
  }
  button('Close',()=>{closeAccount();return {ok:true}});d.addEventListener('cancel',()=>{d.remove();dialog=null;updateDialog=null});document.body.append(d);d.showModal();
  updateDialog=()=>{if(!d.open)return;if(renderedIdentity!==accountIdentity()){d.close();d.remove();dialog=null;updateDialog=null;openAccount();return}result.textContent=stateMessage[status]||'Check your account and cloud save below.';renderSafety();};
 }
 async function commerce(action,extra={}){if(!client)throw failure('LITTLES_SIGN_IN_REQUIRED');const current=await actor();const {data,error}=await client.functions.invoke('littles-play-store',{body:{action,...extra}});if(error||data?.contract!=='littles-play-v1'||data.user_id!==current.id||(await actor()).id!==current.id)throw failure('LITTLES_CONTROL_UNAVAILABLE');return data;}
 globalThis.meadowLittlesCloud={init,reconnect,queueSave,flush,retryPending:flush,choose,openAccount,linkEmail,verifyEmail,setPassword,signIn,recover,signOut,changeName,commerce,getStatus:()=>({state:status,code:lastError,revision,userId:user?.id||null,displayName:profile?.display_name||null,isGuest:!!user?.is_anonymous,parentReady:!!user&&!user.is_anonymous&&!!user.email_confirmed_at&&status!=='auth_required'&&status!=='signed_out'})};
})();
