import { effectivePlus, parseNotification, validateSubscription } from './rules.ts';
const assert=(v:unknown,m='Assertion failed')=>{if(!v)throw Error(m)};
const now=Date.parse('2026-11-11T00:00:00Z'),account='a'.repeat(64);
const purchase=(state='SUBSCRIPTION_STATE_ACTIVE')=>({subscriptionState:state,acknowledgementState:'ACKNOWLEDGEMENT_STATE_PENDING',externalAccountIdentifiers:{obfuscatedExternalAccountId:account},lineItems:[{productId:'ml_plus',offerDetails:{basePlanId:'monthly'},expiryTime:'2026-12-01T00:00:00Z'}]});
Deno.test('Active, grace and canceled paid-through subscriptions retain access; hold, pause and expiry do not',()=>{
 for(const s of ['ACTIVE','IN_GRACE_PERIOD','CANCELED'])assert(validateSubscription(purchase('SUBSCRIPTION_STATE_'+s),account,now).active,s);
 for(const s of ['ON_HOLD','PAUSED','EXPIRED'])assert(!validateSubscription(purchase('SUBSCRIPTION_STATE_'+s),account,now).active,s);
 const expired=purchase();expired.lineItems[0].expiryTime='2026-10-01T00:00:00Z';assert(!validateSubscription(expired,account,now).active);
});
Deno.test('Wrong owner, product and plan are never accepted',()=>{
 for(const edit of [(x:any)=>x.externalAccountIdentifiers.obfuscatedExternalAccountId='b'.repeat(64),(x:any)=>x.lineItems[0].productId='mm_premium',(x:any)=>x.lineItems[0].offerDetails.basePlanId='other']){const p=purchase();edit(p);let failed=false;try{validateSubscription(p,account,now)}catch{failed=true}assert(failed);}
});
Deno.test('Pending purchases without expiry do not unlock Plus',()=>{
 const p:any=purchase('SUBSCRIPTION_STATE_PENDING');delete p.lineItems[0].expiryTime;assert(!validateSubscription(p,account,now).active);
});
Deno.test('Revoking a complimentary grant never removes paid access, and vice versa',()=>{
 assert(effectivePlus(true,false).active);assert(effectivePlus(false,true).active);assert(!effectivePlus(false,false).active);
});
Deno.test('RTDN is package-bound and accepts subscription/voided tokens only',()=>{
 const wrap=(x:unknown)=>JSON.stringify({message:{data:btoa(JSON.stringify(x))}});
 assert(parseNotification(wrap({packageName:'com.meadowmarket.littles',subscriptionNotification:{purchaseToken:'valid-token-1234'}}))==='valid-token-1234');
 assert(parseNotification(wrap({packageName:'com.meadowmarket.littles',voidedPurchaseNotification:{purchaseToken:'valid-token-1234'}}))==='valid-token-1234');
 assert(parseNotification(wrap({testNotification:{}}))===null);
 let failed=false;try{parseNotification(wrap({packageName:'com.meadowandmarket.game',subscriptionNotification:{purchaseToken:'valid-token-1234'}}))}catch{failed=true}assert(failed);
});
