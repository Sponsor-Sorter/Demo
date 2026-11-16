/* Grown-up gift codes. A receipt is never an access proof. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.meadowLittlesGifts=api;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const contract='fairplay-gift-codes-v1',uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 const messages={SIGN_IN_REQUIRED:'Sign in to a verified grown-up account first.',ACCOUNT_NOT_READY:'Link and verify your grown-up email, then check again.',GAME_UNAVAILABLE:'Gift codes are not available for Littles yet.',INVALID_CODE:'That code could not be used. Check the letters and numbers.',RATE_LIMITED:'Please wait a little before trying another code.',REQUEST_CONFLICT:'That attempt could not be confirmed. Check again before trying another code.',TEMPORARILY_UNAVAILABLE:'We could not confirm that attempt. Retry the same code to check it safely.'};
 function normalize(raw){if(typeof raw!=='string'||raw.length>80||!/^[A-Za-z0-9 -]+$/.test(raw))return null;const code=raw.replace(/[ -]/g,'').toUpperCase();return /^[A-Z0-9]{8,40}$/.test(code)?code:null;}
 function capability(value){return !!value&&value.contract===contract&&value.app==='littles'&&value.supported===true&&value.ready===true&&value.entitlement==='littles_plus';}
 function receipt(value){const r=value?.receipt,w=r?.reward;return value?.ok===true&&value.contract===contract&&['redeemed','already_redeemed'].includes(value.status)&&uuid.test(r?.id||'')&&r.app==='littles'&&w?.kind==='entitlement'&&w.entitlement==='littles_plus'&&Number.isSafeInteger(w.duration_seconds)&&w.duration_seconds>=60&&w.duration_seconds<=315360000&&uuid.test(r.delivery||'')&&Number.isFinite(Date.parse(r.redeemed_at))&&Number.isFinite(Date.parse(r.expires_at))&&Date.parse(r.expires_at)>Date.parse(r.redeemed_at);}
 function create(deps){
  let binding=null,generation=0,inFlight=false,attempts=new Map(),pendingProof=false,available=false,listener=null;
  let state={phase:'idle',message:'Enter a gift code from your grown-up.',ready:false,busy:false};
  function identity(){const value=deps.identity();return value&&value.userId&&value.sessionKey?value.userId+'|'+value.sessionKey:null;}
  function eligible(){return deps.identity()?.parentReady===true;}
  function sync(){const next=identity();if(next!==binding){binding=next;generation++;inFlight=false;attempts.clear();pendingProof=false;available=false;state={phase:'idle',message:next?'Check gift-code availability.':messages.SIGN_IN_REQUIRED,ready:false,busy:false};listener?.({...state});}return binding;}
  function emit(phase,message){state={phase,message,ready:available,busy:inFlight};listener?.({...state});return {...state};}
  function current(key,stamp){return sync()===key&&stamp===generation;}
  async function checkedParent(key,stamp){const value=await deps.refresh();if(!current(key,stamp))return null;if(!eligible()||value?.parentReady!==true){available=false;emit('unavailable',messages.ACCOUNT_NOT_READY);return null;}return value;}
  async function check(){
   const key=sync();if(!key||!eligible())return emit('unavailable',messages.SIGN_IN_REQUIRED);if(inFlight)return {...state};const stamp=generation;inFlight=true;emit('checking','Checking gift codes…');
   try{if(!await checkedParent(key,stamp))return {...state};const value=await deps.rpc('status');if(!current(key,stamp))return {...state};available=capability(value);return emit(available?'ready':'unavailable',available?'Enter your Littles Plus gift code.':messages[value?.error_code]||messages.GAME_UNAVAILABLE);}
   catch{if(current(key,stamp)){available=false;emit('unavailable','Gift codes could not be checked. Please try again.');}return {...state};}
   finally{if(current(key,stamp)){inFlight=false;emit(state.phase,state.message);}}
  }
  async function redeem(raw){
   const key=sync(),code=normalize(raw);if(!key||!eligible())return emit('unavailable',messages.SIGN_IN_REQUIRED);if(inFlight)return {...state};if(pendingProof)return emit('pending','Your gift was accepted. Check Plus again to finish verifying access.');if(!code)return emit('invalid','Use 8 to 40 letters or numbers. Spaces and hyphens are fine.');if(!available)return emit('unavailable','Check gift-code availability first.');
   const stamp=generation;inFlight=true;emit('redeeming','Checking your gift code…');
   try{
    if(!await checkedParent(key,stamp))return {...state};
    let request=attempts.get(code);if(!request){request=deps.uuid();if(!uuid.test(request))throw Error('Request unavailable');attempts.set(code,request);}
    const value=await deps.rpc('redeem',{code,request});if(!current(key,stamp))return {...state};
    if(!receipt(value)){if(value?.ok===false&&value.contract===contract){if(value.error_code==='GAME_UNAVAILABLE')available=false;return emit('error',messages[value.error_code]||messages.TEMPORARILY_UNAVAILABLE);}return emit('uncertain',messages.TEMPORARILY_UNAVAILABLE);}
    pendingProof=true;
    const proof=await checkedParent(key,stamp);if(!current(key,stamp))return {...state};
    if(Date.parse(value.receipt.expires_at)<=Date.now()){pendingProof=false;return emit('expired','This gift was already used. Its Plus period has ended.');}
    if(proof?.plus===true){pendingProof=false;return emit('active','Your gift is confirmed. Littles Plus is active.');}
    return emit('pending','Your gift was accepted. Check Plus again to finish verifying access.');
   }catch{if(current(key,stamp))emit(pendingProof?'pending':'uncertain',pendingProof?'Your gift was accepted. Check Plus again to finish verifying access.':messages.TEMPORARILY_UNAVAILABLE);return {...state};}
   finally{if(current(key,stamp)){inFlight=false;emit(state.phase,state.message);}}
  }
  async function refreshProof(){const key=sync();if(!key||!eligible()||!pendingProof||inFlight)return {...state};const stamp=generation;inFlight=true;emit('checking','Checking Plus…');try{const value=await checkedParent(key,stamp);if(current(key,stamp)){if(value?.plus===true){pendingProof=false;emit('active','Your gift is confirmed. Littles Plus is active.');}else emit('pending','Your gift is saved. Plus verification is still pending.');}}catch{if(current(key,stamp))emit('pending','Your gift is saved. Please check Plus again when connected.');}finally{if(current(key,stamp)){inFlight=false;emit(state.phase,state.message);}}return {...state};}
  return {check,redeem,refreshProof,accountChanged:sync,getState:()=>{sync();return {...state};},subscribe(fn){listener=fn;sync();fn({...state});return ()=>{if(listener===fn)listener=null;};}};
 }
 function mount(host,controller){
  const doc=host.ownerDocument,heading=doc.createElement('h3'),text=doc.createElement('p'),form=doc.createElement('form'),label=doc.createElement('label'),input=doc.createElement('input'),submit=doc.createElement('button'),check=doc.createElement('button'),refresh=doc.createElement('button'),note=doc.createElement('p');
  host.classList.add('parent-gift');heading.textContent='Gift code';text.textContent='For a grown-up: redeem a Littles Plus gift for the account signed in here.';label.textContent='Littles gift code';input.type='text';input.maxLength=80;input.autocomplete='off';input.autocapitalize='characters';input.spellcheck=false;input.setAttribute('aria-label','Littles gift code');label.append(input);submit.type='submit';submit.className='primary-button';submit.textContent='Use gift code';check.type=refresh.type='button';check.className=refresh.className='small-button';check.textContent='Check gift codes';refresh.textContent='Check Plus again';note.setAttribute('role','status');note.setAttribute('aria-live','polite');form.append(label,submit);host.append(heading,text,form,check,refresh,note);
  const stop=controller.subscribe(state=>{if(!host.isConnected)return;note.textContent=state.message;input.disabled=state.busy;submit.disabled=state.busy||!state.ready;check.disabled=state.busy;refresh.disabled=state.busy;refresh.hidden=!['pending','checking'].includes(state.phase);if(state.phase==='active')input.value='';});
  form.onsubmit=e=>{e.preventDefault();controller.redeem(input.value);};check.onclick=()=>controller.check();refresh.onclick=()=>controller.refreshProof();controller.check();
  return ()=>{stop();input.value='';form.onsubmit=check.onclick=refresh.onclick=null;};
 }
 return {normalize,capability,receipt,create,mount};
});
