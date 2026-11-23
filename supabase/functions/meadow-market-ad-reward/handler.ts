import {rewardDatabaseDenial,type CommerceObserver} from '../_shared/meadow-commerce-security-v1.ts';
type Services={verify:(url:URL)=>Promise<URLSearchParams>;unit:string|undefined;finish:(body:Record<string,unknown>)=>Promise<{ok:boolean;error?:unknown}>;observer:CommerceObserver};
export function adRewardHandler(services:Services){return async(req:Request)=>{
 if(req.method!=='GET')return new Response('Use GET',{status:405});
 try{
  const params=await services.verify(new URL(req.url));
  if(params.get('user_id')==='meadow-admob-setup'&&params.get('custom_data')==='verification-only')return new Response('Verified callback; no reward issued',{status:200});
  if(!services.unit||params.get('ad_unit')!==services.unit||params.get('reward_amount')!=='5'||params.get('reward_item')!=='gems')return new Response('Unconfigured reward',{status:403});
  const nonce=params.get('custom_data')||'',timestamp=Number(params.get('timestamp'));
  if(!/^[a-f0-9-]{36}$/.test(nonce)||!Number.isFinite(timestamp))return new Response('Invalid reward',{status:400});
  const result=await services.finish({p_nonce:nonce,p_account:params.get('user_id'),p_transaction:params.get('transaction_id'),p_at:new Date(timestamp).toISOString()});
  if(result.ok)await services.observer.heartbeat();
  else{
   const denial=rewardDatabaseDenial(result.error);
   if(denial){await services.observer.heartbeat();await services.observer.signal(denial.actor,[nonce,params.get('transaction_id')||''],'nonce_transaction');}
   else if((result.error as Record<string,unknown>)?.message==='Ad account mismatch')services.observer.unattributed();
  }
  return new Response(result.ok?'OK':'Reward not delivered',{status:result.ok?200:503});
 }catch{return new Response('Reward verification failed',{status:403});}
};}
