// A retry retains its original immutable request. Server responses must match the original USD manual request.
export function withdrawalDto({requestId, amount, method, destination}) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId || '')) throw Error('Invalid request ID.');
  const text=String(amount ?? '').trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw Error('Enter a USD amount with at most two decimal places.');
  const [whole,fraction='']=text.split('.');
  const cents=Number(whole)*100+Number(fraction.padEnd(2,'0'));
  if (!Number.isSafeInteger(cents) || cents<1000) throw Error('Minimum withdrawal is USD 10.00.');
  if (method!=='paypal') throw Error('Unsupported withdrawal method.');
  const value=method==='paypal'?String(destination || '').trim().toLowerCase():null;
  if(method==='paypal' && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || value.length>254)) throw Error('Enter a valid PayPal email.');
  return Object.freeze({p_request_id:requestId,p_amount_cents:cents,p_method:method,p_destination:value});
}
export function retainWithdrawalRequest(existing, proposed) {
  if (!existing) return proposed;
  if (['p_amount_cents','p_method','p_destination'].some(key=>existing[key]!==proposed[key])) throw Error('Resolve the previous withdrawal request before changing its details.');
  return existing;
}
export function validateWithdrawalReceipt(data,dto) {
  if(data?.ok!==true || typeof data.replayed!=='boolean' || data.request_id!==dto.p_request_id ||
     typeof data.payout_id!=='string' || !data.payout_id || typeof data.status!=='string' || !data.status ||
     data.amount_cents!==dto.p_amount_cents || data.currency!=='usd' || data.method!=='paypal' ||
     data.processing!=='manual_admin' || data.funds_sent!==false || data.wallet_debited_at_request!==false) {
    throw Error('Withdrawal confirmation unavailable. Retry the same request or contact support.');
  }
  return data;
}
const ERROR_MESSAGES={
 PAYOUT_METHOD_UNAVAILABLE:'This withdrawal method is unavailable.',
 INSUFFICIENT_AVAILABLE_WALLET:'Available wallet funds are insufficient. Refresh your wallet.',
 WALLET_REVIEW_REQUIRED:'Your wallet needs Admin review.',
 ACCOUNT_ROLE_REVIEW_REQUIRED:'Your account role needs Admin review.',
 RESERVATION_REVIEW_REQUIRED:'Pending withdrawals need Admin review.',
 CURRENT_ACCOUNT_REQUIRED:'Sign in again before requesting a withdrawal.',
 INVALID_WITHDRAWAL_AMOUNT:'Enter a valid USD amount of at least 10.00.',
 INVALID_PAYOUT_DESTINATION:'Enter a valid PayPal email.',
 REQUEST_BINDING_CONFLICT:'This request ID is already bound to different details. Contact support.'
};
export async function sendWithdrawalRequest(client,dto) {
 const {data,error}=await client.rpc('request_wallet_withdrawal',dto);
 if(error || data?.ok!==true){
  const code=data?.code || Object.keys(ERROR_MESSAGES).find(key=>String(error?.message || '').includes(key));
  throw Error(ERROR_MESSAGES[code] || 'Confirmation unavailable. Retry the same request; do not create another withdrawal.');
 }
 return validateWithdrawalReceipt(data,dto);
}
