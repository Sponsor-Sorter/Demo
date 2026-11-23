import {validatePurchase} from './rules.ts';
import {StoreBindingConflict,type CommerceObserver} from '../_shared/meadow-commerce-security-v1.ts';
type Data=Record<string,any>;
export type StoreServices={purchase:(product:string,token:string)=>Promise<Data>;hash:(value:string)=>Promise<string>;deliver:(body:Data)=>Promise<Data>;settle:(product:string,token:string,consumable:boolean)=>Promise<unknown>;markSettled:(hash:string)=>Promise<unknown>;observer:CommerceObserver};
const keepsakes=new Set(['mm_welcome_garden','mm_coop_charm','mm_market_makeover']);
const consumables=new Set(['mm_pocket_gems','mm_gem_chest','mm_starter_pack','mm_builders_pack','mm_reward_tickets','mm_pantry_pack']);
// user is the authenticated/protected account from the HTTP handler. A wrong
// account Restore fails provider binding before any ledger evidence is emitted.
export function purchaseVerifier(services:StoreServices){return async(user:string,product:string,purchaseToken:string,testOnly=false)=>{
 if(!consumables.has(product)&&product!=='mm_premium'&&!keepsakes.has(product))throw Error('UNKNOWN_PRODUCT');
 if(purchaseToken.length<10||purchaseToken.length>4096)throw Error('INVALID_PURCHASE');
 const purchase=await services.purchase(product,purchaseToken);
 const checked=validatePurchase(purchase,await services.hash('meadow-markets:'+user),testOnly),hash=await services.hash(purchaseToken);
 await services.observer.heartbeat();
 let delivered:Data;
 try{delivered=await services.deliver({p_user:user,p_product:product,p_token_hash:hash,p_order:purchase.orderId||null,p_test:checked.test});}
 catch(error){if(error instanceof StoreBindingConflict)await services.observer.signal(user,[hash],error.field);throw error;}
 // Credit first, then acknowledge; retries preserve the global token binding.
 if(!delivered.settled){
  if(consumables.has(product)?purchase.consumptionState!==1:purchase.acknowledgementState!==1)await services.settle(product,purchaseToken,consumables.has(product));
  await services.markSettled(hash);
 }
 return {verified:true,receipt_id:delivered.receipt_id,duplicate:delivered.duplicate};
};}
