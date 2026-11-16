(() => {
  'use strict';
  const contract='fairplay-gift-codes-v1',app='meadow';
  const currencies={gems:{label:'Gems',maximum:100000},gold:{label:'Gold',maximum:1000000},reward_turns:{label:'Reward tickets',maximum:10000}};
  const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);
  const errors={SIGN_IN_REQUIRED:'Sign in to a saved farm to redeem a code.',GAME_UNAVAILABLE:'Gift codes are not available right now. Please try again later.',ACCOUNT_NOT_READY:'This farm is not ready to redeem a code. Reconnect and try again.',INVALID_CODE:'That code is invalid, expired, used up or for another game.',RATE_LIMITED:'Too many attempts. Please wait before trying again.',REQUEST_CONFLICT:'This attempt could not be confirmed. Try again.',TEMPORARILY_UNAVAILABLE:'We could not confirm the result. Retry safely with the same code.'};
  function normalize(raw){if(typeof raw!=='string'||raw.length>80||!/^[A-Za-z0-9 -]*$/.test(raw))return null;const code=raw.replaceAll(' ','').replaceAll('-','').toUpperCase();return /^[A-Z0-9]{8,40}$/.test(code)?code:null;}
  // Capture the actual normal session before dispatch. Supabase's mutable
  // client RPC session must not retarget a pending attempt to another account.
  async function sessionRPC(a,owner,name,params){
    const same=()=>!!owner&&a.owner()===owner&&!a.guest()&&a.ready();
    const keys=Object.keys(params||{}).sort().join(',');
    const allowed=(name==='fairplay_gift_code_status_v1'&&keys==='p_app'&&params.p_app===app)
      ||(name==='fairplay_gift_code_redeem_v1'&&keys==='p_app,p_code,p_request'&&params.p_app===app&&normalize(params.p_code)===params.p_code&&uuid(params.p_request))
      ||(name==='meadow_market_play_service'&&keys==='p_action,p_data'&&params.p_action==='status'&&params.p_data&&Object.keys(params.p_data).length===0);
    if(!allowed||!same())throw Error('Gift request unavailable');
    const client=a.client(),{data,error}=await client.auth.getSession();
    if(error||!same()||client!==a.client()||data?.session?.user?.id!==owner||data.session.user.is_anonymous===true||!data.session.access_token)throw Error('Gift session changed');
    const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),18000);
    try{
      const response=await (a.fetch||fetch)('https://ejavqlyozqhzqogflqzr.supabase.co/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:'sb_publishable_NGAHium82O8-2idyjUON5w_37bUAezE',Authorization:'Bearer '+data.session.access_token,'Content-Type':'application/json'},body:JSON.stringify(params),signal:abort.signal});
      if(!same())throw Error('Gift account changed');
      if(response.status===401)return {ok:false,contract,error_code:'SIGN_IN_REQUIRED'};
      if(!response.ok)throw Error('Gift request unconfirmed');
      const result=await response.json();if(!same())throw Error('Gift account changed');return result;
    }finally{clearTimeout(timer);}
  }
  function farmAdapter(a){
    const check=(owner,command)=>{
      const status=command?.status();
      if(!owner||a.owner()!==owner||a.guest()||!a.ready()||a.command()!==command
        ||status?.owner!==owner||status.stopped||status.conflict)throw Error('Waiting for your farm');
      return status;
    };
    const settled=(owner,command)=>{const s=check(owner,command);if(s.pending||s.busy||s.running)throw Error('Waiting for your saved action');};
    return {...a,rpc:(owner,name,params)=>sessionRPC(a,owner,name,params),
      async prepare(owner){const command=a.command();check(owner,command);await command.flush();settled(owner,command);},
      async sync(owner){
        const command=a.command();check(owner,command);
        await command.refreshReceipts();settled(owner,command);
        const club=a.club();await club.refresh();settled(owner,command);
        await club.refreshPremium();settled(owner,command);
        // Refresh helpers deliberately retain prior state on network errors.
        // An independent own-account read must therefore agree with the UI;
        // a resolved helper promise alone is not delivery/access proof.
        const proof=await sessionRPC(a,owner,'meadow_market_play_service',{p_action:'status',p_data:{}});
        settled(owner,command);const wallet=club.wallet(),p=proof?.wallet;
        return proof.premium_verified===true&&proof.receipt_summary?.version===237&&proof.receipt_summary.pending===false
          &&Number.isSafeInteger(p?.gems)&&p.gems>=0&&Number.isSafeInteger(p.reward_turns)&&p.reward_turns>=0&&typeof p.premium==='boolean'
          &&wallet.gems===p.gems&&wallet.reward_turns===p.reward_turns&&wallet.premium===p.premium;
      }
    };
  }
  function validReceipt(r){
    if(!r||r.app!==app||!uuid(r.id)||!Number.isFinite(Date.parse(r.redeemed_at)))return false;
    const reward=r.reward;
    if(reward?.kind==='currency'){
      const c=currencies[reward.currency],d=r.delivery;
      return !!c&&Number.isSafeInteger(reward.amount)&&reward.amount>0&&reward.amount<=c.maximum
        &&r.expires_at===null&&d?.currency===reward.currency&&d.amount===reward.amount&&d.receipt_id===r.id
        &&d.delivery===(reward.currency==='gold'?'server_receipt':'credited');
    }
    return reward?.kind==='entitlement'&&reward.entitlement==='premium'
      &&Number.isInteger(reward.duration_seconds)&&reward.duration_seconds>=60&&reward.duration_seconds<=315360000
      &&uuid(r.delivery)&&Number.isFinite(Date.parse(r.expires_at))
      &&Math.abs(Date.parse(r.expires_at)-Date.parse(r.redeemed_at)-reward.duration_seconds*1000)<=1;
  }
  function create(a){
    const pending=new Map();let flight=null;
    const same=owner=>!!owner&&a.owner()===owner&&!a.guest();
    const failure=error_code=>({ok:false,contract,error_code});
    async function availability(){
      const owner=a.owner();if(!same(owner))return failure('SIGN_IN_REQUIRED');
      try{const r=await a.rpc(owner,'fairplay_gift_code_status_v1',{p_app:app});if(!same(owner))return {ignored:true};
        if(r?.contract===contract&&r.ok===false&&Object.hasOwn(errors,r.error_code))return failure(r.error_code);
        if(r?.contract!==contract||r.app!==app)return failure('TEMPORARILY_UNAVAILABLE');
        return {ok:true,ready:r.supported===true&&r.ready===true};
      }catch{return same(owner)?failure('TEMPORARILY_UNAVAILABLE'):{ignored:true};}
    }
    async function execute(attempt,key){
      const owner=attempt.owner;
      try{
        await a.prepare(owner);if(!same(owner))return {ignored:true};
        if(!attempt.receipt){
          const r=await a.rpc(owner,'fairplay_gift_code_redeem_v1',{p_app:app,p_code:attempt.code,p_request:attempt.request});
          if(!same(owner))return {ignored:true};
          if(r?.contract!==contract)throw Error('Unconfirmed gift result');
          if(r.ok!==true){const code=Object.hasOwn(errors,r.error_code)?r.error_code:'TEMPORARILY_UNAVAILABLE';if(code!=='TEMPORARILY_UNAVAILABLE')pending.delete(key);return failure(code);}
          if(!['redeemed','already_redeemed'].includes(r.status)||!validReceipt(r.receipt))throw Error('Unconfirmed gift receipt');
          attempt.receipt=r.receipt;attempt.status=r.status;
        }
        try{if(await a.sync(owner,attempt.receipt)!==true)throw Error('Reward sync pending');}
        catch{return same(owner)?{ok:true,synced:false,status:attempt.status,receipt:attempt.receipt}:{ignored:true};}
        if(!same(owner))return {ignored:true};pending.delete(key);
        return {ok:true,synced:true,status:attempt.status,receipt:attempt.receipt};
      }catch{return same(owner)?failure('TEMPORARILY_UNAVAILABLE'):{ignored:true};}
    }
    function redeem(raw){
      const owner=a.owner(),code=normalize(raw);if(!same(owner))return Promise.resolve(failure('SIGN_IN_REQUIRED'));
      if(!code)return Promise.resolve(failure('INVALID_CODE'));
      const key=owner+':'+code;
      if(flight)return flight.key===key?flight.promise:Promise.resolve({busy:true});
      let attempt=pending.get(key);
      if(!attempt){if(pending.size>=16)return Promise.resolve(failure('TEMPORARILY_UNAVAILABLE'));const request=a.uuid();if(!uuid(request))return Promise.resolve(failure('TEMPORARILY_UNAVAILABLE'));attempt={owner,code,request};pending.set(key,attempt);}
      const current={key,promise:null};flight=current;
      current.promise=execute(attempt,key).finally(()=>{if(flight===current)flight=null;});return current.promise;
    }
    return {availability,redeem,busy:()=>!!flight,needsSync:raw=>!!pending.get(a.owner()+':'+normalize(raw))?.receipt,pendingCode:()=>[...pending.values()].find(p=>p.owner===a.owner())?.code||''};
  }

  let api,controller,screen=0;
  function description(receipt){
    const r=receipt.reward;if(r.kind==='currency')return r.amount.toLocaleString()+' '+currencies[r.currency].label;
    const date=new Date(receipt.expires_at).toLocaleString();return (Date.parse(receipt.expires_at)>Date.now()?'Gifted Premium until ':'Premium gift ended ')+date;
  }
  function open(){
    if(!api)return;const generation=++screen,owner=api.owner();
    api.modal('<section class="gift-code-screen"><div class="sheet-head"><div><small class="eyebrow">FOR YOUR MEADOW FARM</small><h2>Redeem gift code</h2></div><button type="button" class="close-button" data-close="modal-dialog" aria-label="Close gift codes">×</button></div><img class="gift-code-art" src="assets/generated/club/pack.webp" alt="Gift box"><form id="gift-code-form" autocomplete="off"><label for="gift-code-input">Gift code</label><input id="gift-code-input" type="text" maxlength="80" autocapitalize="characters" autocorrect="off" spellcheck="false" autocomplete="off" aria-describedby="gift-code-message"><p id="gift-code-message" role="status" aria-live="polite">Checking availability…</p><button id="gift-code-submit" type="submit" class="primary-button full-button" disabled>Redeem</button><button id="gift-code-check" type="button" class="small-button full-button">Check again</button></form><small>One use per account. Timed gifts start when redeemed and do not add to existing gift time.</small></section>');
    const root=document.querySelector('.gift-code-screen'),form=root.querySelector('form'),input=root.querySelector('input'),message=root.querySelector('#gift-code-message'),submit=root.querySelector('#gift-code-submit'),check=root.querySelector('#gift-code-check');
    let ready=false;
    const active=()=>screen===generation&&root.isConnected&&api.owner()===owner;
    const controls=()=>{submit.disabled=!ready||controller.busy()||!normalize(input.value);submit.textContent=controller.needsSync(input.value)?'Retry sync':'Redeem';input.disabled=controller.busy();check.disabled=controller.busy();};
    const display=result=>{if(!active()||result?.ignored)return;if(result?.ok&&result.synced){message.textContent=(result.status==='already_redeemed'?'Already redeemed on this farm · ':'Redeemed · ')+description(result.receipt);input.value='';}
      else if(result?.ok){message.textContent='Code redeemed. Your farm still needs to sync; retry safely to collect it.';submit.textContent='Retry sync';}
      else{message.textContent=errors[result?.error_code]||'Please finish the current attempt first.';submit.textContent='Redeem';if(result?.error_code==='SIGN_IN_REQUIRED')ready=false;}controls();};
    input.value=controller.pendingCode();input.oninput=()=>{submit.textContent='Redeem';controls();};
    const load=async()=>{check.disabled=true;const result=await controller.availability();if(!active()||result?.ignored)return;ready=result.ok&&result.ready;message.textContent=ready?(controller.needsSync(input.value)?'Code redeemed. Retry safely to sync your reward.':'Enter your code. Rewards stay on this farm.'):errors[result.error_code||'GAME_UNAVAILABLE'];controls();};
    check.onclick=load;
    form.onsubmit=async event=>{event.preventDefault();if(!ready||controller.busy())return;const promise=controller.redeem(input.value);controls();message.textContent='Checking your code…';display(await promise);};
    load();
  }
  window.meadowGifts={normalize,validReceipt,sessionRPC,farmAdapter,create,open,attach(adapter){api=adapter;controller=create(adapter);}};
})();
