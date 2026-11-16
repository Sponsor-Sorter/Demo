import { effectivePlus, parseNotification, proofPolicy, subscriptionAccount, validateSubscription } from './rules.ts';
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
Deno.test('Play Store resubscriptions retain their expired parent binding and reject conflicting identities',()=>{
 const p:any=purchase();delete p.externalAccountIdentifiers;
 p.outOfAppPurchaseContext={expiredExternalAccountIdentifiers:{obfuscatedExternalAccountId:account}};
 assert(subscriptionAccount(p)===account);assert(validateSubscription(p,account,now).active);
 p.externalAccountIdentifiers={obfuscatedExternalAccountId:'b'.repeat(64)};
 let denied=false;try{validateSubscription(p,account,now)}catch{denied=true}assert(denied);
 delete p.externalAccountIdentifiers;p.outOfAppPurchaseContext.expiredExternalAccountIdentifiers.obfuscatedExternalAccountId='not-a-bound-parent';
 denied=false;try{subscriptionAccount(p)}catch{denied=true}assert(denied);
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
const epoch=Math.floor(now/1000),iso=(seconds:number)=>new Date(now+seconds*1000).toISOString();
const giftProjection=(end:unknown)=>({effective_plus:true,paid_active:false,paid_until:null,complimentary_active:true,complimentary_permanent:false,complimentary_proof_until:end});
Deno.test('Repeated normal refreshes cannot renew a300second gift beyond its actual end',()=>{
 for(const elapsed of [0,1,10,60,120,240,299]){const p=proofPolicy(giftProjection(iso(300)),true,now+elapsed*1000);assert(p.plus.active&&p.plus.complimentary&&!p.plus.paid);assert(p.proofUntil===epoch+300,'Refresh extends gift at '+elapsed);assert(p.proofUntil!==null&&p.proofUntil-p.now<=300);}
 for(const elapsed of [300,301,600]){const p=proofPolicy(giftProjection(iso(300)),true,now+elapsed*1000);assert(!p.plus.active&&p.proofUntil===null,'Expired source renewed');}
});
Deno.test('Missing, malformed and expired complimentary horizons fail closed even with a stale active flag',()=>{
 for(const end of [undefined,null,'','invalid',0,iso(-1),iso(0)]){const p=proofPolicy(giftProjection(end),true,now);assert(!p.plus.active&&p.proofUntil===null,String(end));}
 const old:Record<string,unknown>=giftProjection(iso(300));delete old.complimentary_proof_until;assert(!proofPolicy(old,true,now).plus.active,'Old projection cannot mint uncapped complimentary proofs');
});
Deno.test('Long or indefinite grant projections still receive at most a300second proof lease',()=>{
 for(const end of [iso(300),iso(3600),iso(31536000)]){const p=proofPolicy(giftProjection(end),true,now);assert(p.plus.active&&p.proofUntil===epoch+300);}
 const short=proofPolicy(giftProjection(iso(10)),true,now);assert(short.proofUntil===epoch+10);
});
Deno.test('Paid leases keep their existing one-day/paid-through cap and survive gift expiry or unavailable gift metadata',()=>{
 for(const giftEnd of [undefined,null,iso(-1),iso(10)])for(const paidEnd of [100,86400,172800]){const projection={...giftProjection(giftEnd),paid_active:true,paid_until:iso(paidEnd)},p=proofPolicy(projection,true,now);assert(p.plus.active&&p.plus.paid);assert(p.proofUntil===epoch+Math.min(86400,paidEnd));}
});
Deno.test('Paid OR complimentary access survives either source ending without extending the expired source',()=>{
 const both={...giftProjection(iso(300)),paid_active:true,paid_until:iso(100)};
 let p=proofPolicy(both,true,now);assert(p.plus.paid&&p.plus.complimentary&&p.proofUntil===epoch+300);
 p=proofPolicy(both,true,now+101000);assert(p.plus.active&&!p.plus.paid&&p.plus.complimentary&&p.proofUntil===epoch+300);
 p=proofPolicy(both,true,now+300000);assert(!p.plus.active&&p.proofUntil===null);
 const paid={...giftProjection(iso(10)),paid_active:true,paid_until:iso(100)};p=proofPolicy(paid,true,now+11000);assert(p.plus.paid&&!p.plus.complimentary&&p.proofUntil===epoch+100);
});
Deno.test('Unknown/unverified source flags, protected parents and subsecond-only leases cannot mint access',()=>{
 for(const patch of [{effective_plus:false},{effective_plus:null},{complimentary_active:'true'},{complimentary_active:null}])assert(!proofPolicy({...giftProjection(iso(300)),...patch},true,now).plus.active);
 assert(!proofPolicy(giftProjection(iso(300)),false,now).plus.active);assert(!proofPolicy(giftProjection(iso(300)),true,NaN).plus.active);
 assert(!proofPolicy(giftProjection(new Date(now+500).toISOString()),true,now).plus.active,'Do not sign exp equal to iat');
 for(const end of [undefined,null,'invalid',iso(-1)])assert(!proofPolicy({...giftProjection(null),paid_active:true,paid_until:end},true,now).plus.active);
});
Deno.test('The actual permanent reviewer grant shape keeps short renewable proofs without inventing timed expiry',()=>{
 for(const end of [undefined,null,'invalid']){const projection={...giftProjection(end),complimentary_permanent:true};for(const elapsed of [0,60,600]){const p=proofPolicy(projection,true,now+elapsed*1000);assert(p.plus.complimentary&&p.proofUntil===epoch+elapsed+300);}}
 for(const flag of [undefined,null,false,'true'])assert(!proofPolicy({...giftProjection(null),complimentary_permanent:flag},true,now).plus.active);
 assert(!proofPolicy({...giftProjection(null),complimentary_permanent:true,complimentary_active:false},true,now).plus.active);
});
Deno.test('Multiple overlapping finite grant horizons preserve the later still-valid source',()=>{
 for(const [elapsed,horizon] of [[0,300],[240,540],[599,600]]){const p=proofPolicy(giftProjection(iso(horizon)),true,now+elapsed*1000);assert(p.plus.active&&p.proofUntil===epoch+horizon);assert(p.proofUntil!==null&&p.proofUntil<=epoch+600);}
 assert(!proofPolicy(giftProjection(null),true,now+600000).plus.active);
});
Deno.test('Subsecond ends round down without adding even one extra second of access',()=>{
 const end=new Date(now+1999).toISOString(),p=proofPolicy(giftProjection(end),true,now);assert(p.proofUntil===epoch+1);assert(p.proofUntil!==null&&p.proofUntil*1000<=Date.parse(end));
 for(const elapsed of [1000,1499,1998,1999])assert(!proofPolicy(giftProjection(end),true,now+elapsed).plus.active);
});
