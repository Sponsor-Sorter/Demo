// Called only after the push identity, JWT signature, issuer and audience pass.
// A notification never chooses an owner or credits a purchase.
type Dependencies={
 hash:(token:string)=>Promise<string>;
 owner:(hash:string)=>Promise<{product_id:string;revoked?:boolean}|null>;
 purchase:(product:string,token:string)=>Promise<{purchaseState?:number}>;
 revoke:(hash:string)=>Promise<unknown>;
};
export class InvalidNotification extends Error {}
export async function processNotification(raw:string,deps:Dependencies){
 if(raw.length>65536)throw new InvalidNotification('Too large');
 let event;
 try{
  const envelope=JSON.parse(raw);
  if(typeof envelope.message?.data!=='string')throw Error();
  event=JSON.parse(atob(envelope.message.data));
 }catch{throw new InvalidNotification('Invalid message');}
 if(event?.packageName!=='com.meadowandmarket.game')throw new InvalidNotification('Wrong game');
 const kinds=['testNotification','oneTimeProductNotification','voidedPurchaseNotification','subscriptionNotification','pendingRefundReviewNotification'].filter(k=>event[k]!=null);
 if(kinds.length!==1)throw new InvalidNotification('Ambiguous notification');
 if(kinds[0]==='testNotification')return;
 // Subscriptions are not sold by this game. A refund request is not a refund.
 if(kinds[0]==='subscriptionNotification'||kinds[0]==='pendingRefundReviewNotification')return;
 const voided=event.voidedPurchaseNotification,note=voided||event.oneTimeProductNotification;
 if(typeof note.purchaseToken!=='string'||note.purchaseToken.length<10||note.purchaseToken.length>4096)throw new InvalidNotification('Invalid token');
 if(voided){
  // The store rejects multi-quantity purchases, so only a full one-time refund
  // can revoke a credited entitlement. The authenticated Google event is the
  // authority even when the product endpoint has not caught up with a refund.
  if(voided.productType!==2||voided.refundType!==1)return;
 }else if(![1,2].includes(note.notificationType))throw new InvalidNotification('Unknown event');
 const hash=await deps.hash(note.purchaseToken),owner=await deps.owner(hash);
 if(!owner||owner.revoked)return;
 if(voided){await deps.revoke(hash);return;}
 const purchase=await deps.purchase(owner.product_id,note.purchaseToken);
 if(purchase.purchaseState===1)await deps.revoke(hash);
}
