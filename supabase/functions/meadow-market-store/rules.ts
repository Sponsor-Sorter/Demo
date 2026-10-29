export function validatePurchase(purchase:Record<string,unknown>,expectedAccount:string){
 if(purchase.purchaseState!==0)throw Error(purchase.purchaseState===2?'PURCHASE_PENDING':'PURCHASE_NOT_COMPLETED');
 if((purchase.quantity??1)!==1)throw Error('MULTI_QUANTITY_UNSUPPORTED');
 if(purchase.obfuscatedExternalAccountId!==expectedAccount)throw Error('PURCHASE_ACCOUNT_MISMATCH');
 return {test:purchase.purchaseType===0};
}
