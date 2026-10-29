import {verifyCallback} from './verify.ts';
Deno.serve(async req=>{
 if(req.method!=='GET')return new Response('Use GET',{status:405});
 try{
  const params=await verifyCallback(new URL(req.url)),unit=Deno.env.get('MEADOW_REWARDED_SSV_UNIT');
  // Match the actual SSV unit ID configured by AdMob, not a client-supplied ID.
  // AdMob's signed setup probe verifies transport only. It never delivers a reward.
  if(params.get('user_id')==='meadow-admob-setup'&&params.get('custom_data')==='verification-only')return new Response('Verified callback; no reward issued',{status:200});
  if(!unit||params.get('ad_unit')!==unit||params.get('reward_amount')!=='5'||params.get('reward_item')!=='gems')return new Response('Unconfigured reward',{status:403});
  const nonce=params.get('custom_data')||'',timestamp=Number(params.get('timestamp'));
  if(!/^[a-f0-9-]{36}$/.test(nonce)||!Number.isFinite(timestamp))return new Response('Invalid reward',{status:400});
  const base=Deno.env.get('SUPABASE_URL')!,secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const result=await fetch(base+'/rest/v1/rpc/meadow_market_finish_ad_reward',{method:'POST',signal:AbortSignal.timeout(12000),headers:{apikey:secret,Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:JSON.stringify({p_nonce:nonce,p_account:params.get('user_id'),p_transaction:params.get('transaction_id'),p_at:new Date(timestamp).toISOString()})});
  return new Response(result.ok?'OK':'Reward not delivered',{status:result.ok?200:503});
 }catch{return new Response('Reward verification failed',{status:403});}
});
