import {InvalidNotification,processNotification} from '../supabase/functions/meadow-market-play-notifications/process.ts';
function assert(value:unknown,message:string){if(!value)throw Error(message);}
const token='opaque-purchase-token';
const envelope=(body:Record<string,unknown>)=>JSON.stringify({message:{data:btoa(JSON.stringify({packageName:'com.meadowandmarket.game',...body}))}});
function fixture(){
 const calls:string[]=[],known={product_id:'mm_gem_chest',revoked:false};let owner:typeof known|null=known,state=0;
 const deps={hash:async(t:string)=>{assert(t===token,'Exact opaque token');return'hash';},owner:async()=>owner,purchase:async(p:string)=>{calls.push('verify:'+p);return{purchaseState:state};},revoke:async()=>{calls.push('revoke');known.revoked=true;}};
 return{calls,deps,state:(n:number)=>state=n,unclaimed:()=>owner=null};
}
Deno.test('Full voided purchase revokes once, using its recorded owner and product',async()=>{
 const f=fixture(),raw=envelope({voidedPurchaseNotification:{purchaseToken:token,productType:2,refundType:1,productId:'forged'}});
 await processNotification(raw,f.deps);await processNotification(raw,f.deps);
 assert(f.calls.join(',')==='revoke','Full refund does not depend on stale purchased state, repeat is harmless');
});
Deno.test('One-time events recheck Google and never grant or trust an event sku',async()=>{
 const f=fixture(),raw=envelope({oneTimeProductNotification:{purchaseToken:token,notificationType:2,sku:'other'}});
 await processNotification(raw,f.deps);assert(f.calls.join(',')==='verify:mm_gem_chest','Live paid state retained');
 f.state(1);await processNotification(raw,f.deps);assert(f.calls.at(-1)==='revoke','Verified cancellation revoked');
});
Deno.test('Unclaimed events, tests, partial refunds and subscription events cannot remove goods',async()=>{
 const f=fixture();
 for(const body of [{testNotification:{}},{subscriptionNotification:{}},{pendingRefundReviewNotification:{}},{voidedPurchaseNotification:{purchaseToken:token,productType:2,refundType:2}},{voidedPurchaseNotification:{purchaseToken:token,productType:1,refundType:1}}])await processNotification(envelope(body),f.deps);
 f.unclaimed();await processNotification(envelope({voidedPurchaseNotification:{purchaseToken:token,productType:2,refundType:1}}),f.deps);
 assert(f.calls.length===0,'No credit, assignment or revocation');
});
Deno.test('Malformed, wrong-game, ambiguous, unknown and oversized messages rejected',async()=>{
 const f=fixture();
 for(const raw of ['{}','not json',envelope({packageName:'com.other.game',testNotification:{}}),envelope({testNotification:{},oneTimeProductNotification:{}}),envelope({oneTimeProductNotification:{purchaseToken:token,notificationType:99}}),envelope({oneTimeProductNotification:{purchaseToken:42,notificationType:2}}),'x'.repeat(65537)]){
  let rejected=false;try{await processNotification(raw,f.deps);}catch(e){rejected=e instanceof InvalidNotification;}assert(rejected,'Invalid input rejected');
 }
 assert(f.calls.length===0,'Malformed inputs never touch entitlements');
});
Deno.test('Transient provider/database failures propagate for Pub/Sub retry',async()=>{
 const f=fixture();f.deps.purchase=async()=>{throw Error('provider unavailable');};
 let retried=false;try{await processNotification(envelope({oneTimeProductNotification:{purchaseToken:token,notificationType:1}}),f.deps);}catch(e){retried=!(e instanceof InvalidNotification);}
 assert(retried,'A failed provider read must never acknowledge delivery');
});
