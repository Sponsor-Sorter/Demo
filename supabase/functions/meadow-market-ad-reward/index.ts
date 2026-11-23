import {verifyCallback} from './verify.ts';
import {adRewardHandler} from './handler.ts';
import {createCommerceObserver} from '../_shared/meadow-commerce-security-v1.ts';
import {rewardRpcTransport} from './transport.ts';
const base=Deno.env.get('SUPABASE_URL')!,secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const rpc=rewardRpcTransport(base,secret);
const observer=createCommerceObserver('meadow-market-ad-reward',async(name,body,signal)=>{const result=await rpc(name,body,signal);if(!result.response.ok)throw Error('Observer unavailable');return result.value;});
Deno.serve(adRewardHandler({verify:verifyCallback,unit:Deno.env.get('MEADOW_REWARDED_SSV_UNIT'),observer,finish:async body=>{const result=await rpc('meadow_market_finish_ad_reward',body);return {ok:result.response.ok,error:result.response.ok?undefined:result.value};}}));
