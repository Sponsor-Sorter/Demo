/* Meadow Market Littles only. All game balances/shop flags are unverified client data. */
(() => {
 'use strict';
 const CONFIG={url:'https://ejavqlyozqhzqogflqzr.supabase.co',key:'sb_publishable_NGAHium82O8-2idyjUON5w_37bUAezE',storageKey:'meadow-littles-auth-v1'};
 const clone=x=>JSON.parse(JSON.stringify(x));
 const known=new Set(['LITTLES_SIGN_IN_REQUIRED','LITTLES_ACCOUNT_CHANGED','LITTLES_INVALID_DISPLAY_NAME','LITTLES_INVALID_SAVE','LITTLES_OPEN_REQUIRED','LITTLES_REQUEST_BINDING_CONFLICT','LITTLES_SAVE_REVISION_CONFLICT','LITTLES_SAVE_RATE_LIMIT']);
 let client,store,options={},user=null,remote=null,revision=0,ready=false,busy=false,latest=null,timer=null,dialog=null,status='offline',lastError=null;
 const prefix=uid=>'meadow-littles-cloud-v1:'+uid+':';
 function read(name){try{return JSON.parse(store.getItem(name)||'null')}catch{return null}}
 function write(name,value){if(value===null)store.removeItem(name);else store.setItem(name,JSON.stringify(value))}
 function notify(state,code=null){status=state;lastError=code;try{options.onStatus?.({state,code,userId:user?.id||null,isGuest:!!user?.is_anonymous,revision})}catch{}return {state,code,revision};}
 function failure(code){const e=new Error(code);e.code=code;return e}
 function codeOf(e){return known.has(e?.message)?e.message:'LITTLES_CLOUD_UNAVAILABLE'}
 async function actor(){const {data,error}=await client.auth.getUser();if(error||!data?.user)throw failure('LITTLES_SIGN_IN_REQUIRED');if(user&&data.user.id!==user.id)throw failure('LITTLES_ACCOUNT_CHANGED');user=data.user;return data.user;}
 async function rpc(name,body){const {data,error}=await client.rpc(name,body);if(error)throw failure(codeOf(error));if(data?.ok!==true||data.contract!=='meadow-littles-cloud-v1'||data.entitlements_verified!==false)throw failure('LITTLES_CLOUD_UNAVAILABLE');return data;}
 function validateOpen(data){const s=data?.save;if(!s||s.cloud_version!==1||!Number.isSafeInteger(s.revision)||s.revision<0||!s.data||typeof s.data!=='object'||Array.isArray(s.data)||data.profile?.user_id!==user.id)throw failure('LITTLES_CLOUD_UNAVAILABLE');return s;}
 async function load(){await actor();const data=await rpc('meadow_littles_open',{});remote=validateOpen(data);revision=remote.revision;return data;}
 async function connect(){
  ready=false;const session=await client.auth.getSession();if(session.error)throw failure('LITTLES_CLOUD_UNAVAILABLE');
  if(!session.data?.session){const signed=await client.auth.signInAnonymously();if(signed.error||!signed.data?.user)throw failure('LITTLES_SIGN_IN_REQUIRED');}
  const identity=await client.auth.getUser();if(identity.error||!identity.data?.user)throw failure('LITTLES_SIGN_IN_REQUIRED');user=identity.data.user;
  await load();const pending=read(prefix(user.id)+'pending'),meta=read(prefix(user.id)+'meta');
  if(pending){notify('retry_required');return;}
  if(revision>0&&meta?.revision!==revision){notify('choice_required');return;}
  ready=true;notify('ready');if(latest)schedule();
 }
 function schedule(){clearTimeout(timer);timer=setTimeout(()=>{flush().catch(()=>{})},1200);}
 async function init(config={}){
  options=config;store=config.storage||globalThis.localStorage;
  try{client=config.client||client;if(!client){const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm');client=createClient(CONFIG.url,CONFIG.key,{auth:{storageKey:CONFIG.storageKey,persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});}
   await connect();return {ok:true,state:status,revision};
  }catch(e){notify('offline',e.code||'LITTLES_CLOUD_UNAVAILABLE');return {ok:false,state:status,code:lastError};}
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
   notify('saving');const result=await rpc('meadow_littles_save',pending);
   if(result.request_id!==pending.p_request_id||!Number.isSafeInteger(result.revision)||result.revision!==pending.p_expected_revision+1||typeof result.replayed!=='boolean')throw failure('LITTLES_CLOUD_UNAVAILABLE');
   revision=result.revision;write(prefix(user.id)+'meta',{revision});write(prefix(user.id)+'pending',null);ready=true;notify('saved');return {ok:true,revision,replayed:result.replayed};
  }catch(e){ready=false;const code=e.code||'LITTLES_CLOUD_UNAVAILABLE';notify(code==='LITTLES_SAVE_REVISION_CONFLICT'||code==='LITTLES_REQUEST_BINDING_CONFLICT'?'choice_required':'retry_required',code);return {ok:false,state:status,code};}
  finally{busy=false;if(ready&&latest)schedule();}
 }
 async function choose(which){
  if(busy)throw failure('LITTLES_OPERATION_IN_PROGRESS');await load();
  if(which==='cloud'&&revision>0){if(remote.data.schema!==1)throw failure('LITTLES_INVALID_SAVE');options.applyState?.(clone(remote.data));latest=null;}
  else if(which==='device'){latest=clone(options.getState?.());if(!latest||latest.schema!==1)throw failure('LITTLES_INVALID_SAVE');}
  else throw failure('LITTLES_INVALID_SAVE');
  write(prefix(user.id)+'pending',null);write(prefix(user.id)+'meta',{revision});ready=true;notify('ready');if(latest)return flush();return {ok:true,revision};
 }
 const redirect=()=>new URL(location.pathname,location.origin).href;
 async function linkEmail(email){await actor();const r=await client.auth.updateUser({email:email.trim()},{emailRedirectTo:redirect()});if(r.error)throw failure('LITTLES_EMAIL_LINK_UNAVAILABLE');return {ok:true,verificationRequired:true};}
 async function verifyEmail(email,token){const r=await client.auth.verifyOtp({email:email.trim(),token:token.trim(),type:'email_change'});if(r.error)throw failure('LITTLES_EMAIL_VERIFICATION_FAILED');await actor();return {ok:true};}
 async function setPassword(password){const u=await actor();if(!u.email_confirmed_at||u.is_anonymous)throw failure('LITTLES_EMAIL_VERIFICATION_REQUIRED');const r=await client.auth.updateUser({password});if(r.error)throw failure('LITTLES_PASSWORD_UPDATE_FAILED');return {ok:true};}
 async function signIn(email,password){if(busy)throw failure('LITTLES_OPERATION_IN_PROGRESS');const r=await client.auth.signInWithPassword({email:email.trim(),password});if(r.error)throw failure('LITTLES_SIGN_IN_FAILED');latest=null;user=null;await connect();ready=false;notify('choice_required');return {ok:true};}
 async function recover(email){const r=await client.auth.resetPasswordForEmail(email.trim(),{redirectTo:redirect()});if(r.error)throw failure('LITTLES_RECOVERY_UNAVAILABLE');return {ok:true};}
 async function signOut(){if(busy)throw failure('LITTLES_OPERATION_IN_PROGRESS');if(user?.is_anonymous)throw failure('LITTLES_LINK_EMAIL_BEFORE_SIGN_OUT');const r=await client.auth.signOut({scope:'local'});if(r.error)throw failure('LITTLES_SIGN_OUT_FAILED');ready=false;user=null;latest=null;clearTimeout(timer);notify('signed_out');}
 function openAccount(){
  if(dialog?.open){dialog.focus();return;}
  const d=document.createElement('dialog');dialog=d;d.setAttribute('aria-label','Cloud save and grown-up account');
  d.style.cssText='max-width:32rem;width:90%;border-radius:20px;padding:20px;background:#fff9e8;color:#293b2f;';
  const add=(tag,text)=>{const el=document.createElement(tag);el.textContent=text;d.append(el);return el};
  add('h2','Cloud save');add('p','Guest saves belong to this browser. A grown-up can link and verify an email to recover progress on another device.');
  const result=add('p',status==='choice_required'?'A cloud save needs your choice. Nothing will be replaced automatically.':status);result.setAttribute('role','status');
  function button(label,run){const b=add('button',label);b.type='button';b.style.cssText='display:block;margin:10px 0;padding:10px;';b.onclick=async()=>{b.disabled=true;try{const r=await run();result.textContent=r?.verificationRequired?'Check the email confirmation link. After verification, set a password.':r?.ok===false?'Cloud save needs attention: '+(r.code||r.state):'Done. '+status;}catch(e){result.textContent=e.code||'Could not complete this step. Please try again.'}finally{b.disabled=false;}};return b;}
  if(!client||!user)button('Connect cloud save',()=>init(options));
  else{
   add('p',user.is_anonymous?'Guest account':'Recoverable account');
   button('Retry pending save',flush);
   if(remote?.revision>0)button('Use cloud progress',()=>choose('cloud'));
   button('Keep this device’s progress',async()=>{if(!confirm('Replace this account’s cloud progress with the progress on this device?'))return {ok:false,state:'cancelled'};return choose('device')});
   const label=add('label','Grown-up email');const email=document.createElement('input');email.type='email';email.autocomplete='email';label.append(email);
   button('Link email to this guest save',()=>linkEmail(email.value));
   const codeLabel=add('label','Email confirmation code (if included in the email)');const code=document.createElement('input');code.inputMode='numeric';code.autocomplete='one-time-code';codeLabel.append(code);
   button('Verify email code',()=>verifyEmail(email.value,code.value));
   const passLabel=add('label','Password');const password=document.createElement('input');password.type='password';password.autocomplete='current-password';passLabel.append(password);
   button('Set password after email verification',async()=>{const r=await setPassword(password.value);password.value='';return r});
   button('Sign in to an existing account',async()=>{const r=await signIn(email.value,password.value);password.value='';return r});
   button('Send password recovery email',()=>recover(email.value));
   if(!user.is_anonymous)button('Sign out from Littles',signOut);
  }
  button('Close',()=>{d.close();d.remove();dialog=null;return {ok:true}});d.addEventListener('cancel',()=>{d.remove();dialog=null});document.body.append(d);d.showModal();
 }
 globalThis.meadowLittlesCloud={init,queueSave,flush,retryPending:flush,choose,openAccount,linkEmail,verifyEmail,setPassword,signIn,recover,signOut,getStatus:()=>({state:status,code:lastError,revision,userId:user?.id||null,isGuest:!!user?.is_anonymous})};
})();
