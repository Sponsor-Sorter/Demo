const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const cents=n=>Number.isSafeInteger(n)&&n>0;
const routes=new Set(['wallet','stripe_connect']);
export function validateQueue(data){
 if(data?.ok!==true||data.contract!=='creator-earnings-queue-v1'||data.provider_verified!==false||data.automatic_execution!==false||!Array.isArray(data.items)||data.items.length>100||!(data.next_cursor===null||UUID.test(data.next_cursor))||!Array.isArray(data.limitations)||data.limitations.some(v=>typeof v!=='string'))throw Error('Earnings queue response is unavailable.');
 for(const r of data.items){
  if(!['order_id','agreement_id','creator_id'].every(k=>UUID.test(r[k]))||!['private','group'].includes(r.offer_kind)||!(r.creator===null||typeof r.creator==='string')||typeof r.offer_title!=='string'||!(r.amount_cents===null||cents(r.amount_cents))||r.currency!=='usd'||typeof r.livemode!=='boolean'||!['wallet','stripe'].includes(r.source)||typeof r.completed!=='boolean'||typeof r.review_required!=='boolean'||!(r.settlement_id===null||UUID.test(r.settlement_id))||!['awaiting_settlement','processing','transferred','wallet_credited'].includes(r.settlement_status)||!(r.route===null||routes.has(r.route))||!(r.transfer_id===null||/^tr_[A-Za-z0-9]+$/.test(r.transfer_id))||typeof r.funded_at!=='string'||!Number.isFinite(Date.parse(r.funded_at)))throw Error('An earnings queue item needs review.');
 }
 return data;
}
export function earningReference(row){
 const key=row.offer_kind==='group'?'agreement_id':row.offer_kind==='private'?'order_id':null;
 if(!key||!UUID.test(row[key]))throw Error('Canonical earning reference missing.');
 return Object.freeze({[key]:row[key]});
}
export function validateReceipt(data){
 if(data?.ok!==true||data.contract!=='creator-earnings-v1'||!['wallet_credited','transferred'].includes(data.status)||!UUID.test(data.settlement_id)||!cents(data.amount_cents)||data.currency!=='usd'||typeof data.livemode!=='boolean'||typeof data.replayed!=='boolean'||data.bank_payout_confirmed!==false||
   (data.status==='wallet_credited'&&(data.route!=='wallet'||data.transfer_id!==null||!data.livemode))||
   (data.status==='transferred'&&(data.route!=='stripe_connect'||!/^tr_[A-Za-z0-9]+$/.test(data.transfer_id))))throw Error('Earnings receipt could not be verified. Reconcile this same earning.');
 return data;
}
export function validatePreview(data){
 if(data?.status){const receipt=validateReceipt(data);if(receipt.replayed!==true||data.writes_performed!==false)throw Error('Existing earnings receipt is unavailable.');return {completed:true,data:receipt};}
 if(data?.ok!==true||data.contract!=='creator-earnings-v1'||data.mode!=='preview'||!/^([a-f0-9]{64})$/.test(data.snapshot)||!routes.has(data.route)||!cents(data.amount_cents)||data.currency!=='usd'||typeof data.livemode!=='boolean'||data.writes_performed!==false||data.bank_payout_confirmed!==false||(data.route==='wallet'&&!data.livemode))throw Error('Preview could not be verified. No earning was executed.');
 return {completed:false,data:Object.freeze({...data})};
}
export const amountText=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n/100);
export function receiptText(r){return `${r.replayed?'Existing result: ':''}${amountText(r.amount_cents)} ${r.status==='wallet_credited'?'credited to Sponsor Sorter wallet; not an external withdrawal':'transferred to Stripe balance; not a confirmed bank payout'}.`;}
export function createEarningOperation(client,row){
 const reference=earningReference(row),endpoint=row.offer_kind==='group'?'process-group-payouts':'settle-sponsorship';let reviewed=null,busy=false;
 async function invoke(body){const {data,error}=await client.functions.invoke(endpoint,{body});if(error)throw Error('Earnings confirmation unavailable. Re-preview this same earning or request reconciliation.');return data;}
 return {reference,
  async preview(){if(busy)throw Error('An operation is already in progress.');busy=true;reviewed=null;try{const result=validatePreview(await invoke({action:'preview',...reference}));if(!result.completed)reviewed=result.data;return result;}finally{busy=false;}},
  cancel(){reviewed=null;},
  async execute(confirmed){if(busy||confirmed!==true||!reviewed)throw Error('A fresh preview and explicit confirmation are required.');
   const expected=reviewed;reviewed=null;busy=true;
   try{const receipt=validateReceipt(await invoke({action:'execute',...reference,confirmed:true,expected_snapshot:expected.snapshot}));if(['route','amount_cents','currency','livemode'].some(k=>receipt[k]!==expected[k]))throw Error('Result differs from the reviewed earning. Reconcile this same earning.');return receipt;}finally{busy=false;}
  }
 };
}
