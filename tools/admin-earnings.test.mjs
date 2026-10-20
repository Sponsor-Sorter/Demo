import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateQueue,validatePreview,createEarningOperation,receiptText} from '../js/adminEarnings.mjs';
const id='12345678-1234-4123-8123-123456789abc';
const row={order_id:id,agreement_id:id,creator_id:id,offer_kind:'private',creator:'Fixture <b>literal</b>',offer_title:'Fixture',amount_cents:1000,currency:'usd',livemode:true,source:'wallet',completed:true,review_required:false,settlement_id:null,settlement_status:'awaiting_settlement',route:null,transfer_id:null,funded_at:'2026-10-20T00:00:00Z'};
const preview={ok:true,contract:'creator-earnings-v1',mode:'preview',snapshot:'a'.repeat(64),route:'wallet',amount_cents:1000,currency:'usd',livemode:true,writes_performed:false,bank_payout_confirmed:false};
const receipt={ok:true,contract:'creator-earnings-v1',status:'wallet_credited',route:'wallet',settlement_id:id,amount_cents:1000,currency:'usd',livemode:true,transfer_id:null,replayed:false,bank_payout_confirmed:false};
function fixture(replies){const calls=[];return {calls,client:{functions:{invoke:async(...args)=>{calls.push(args);const value=replies.shift();if(value instanceof Error)throw value;return value;}}}};}
test('queue schema and canonical identity reject malformed candidates',()=>{
 const data={ok:true,contract:'creator-earnings-queue-v1',items:[row],next_cursor:null,provider_verified:false,automatic_execution:false,limitations:[]};
 assert.equal(validateQueue(data),data);
 for(const bad of [{...row,agreement_id:null},{...row,amount_cents:Infinity},{...row,source:'unknown'}])assert.throws(()=>validateQueue({...data,items:[bad]}));
 assert.throws(()=>validateQueue({...data,automatic_execution:true}));
});
test('preview never executes; confirmation forwards exact snapshot and private reference',async()=>{
 const f=fixture([{data:preview},{data:receipt}]),op=createEarningOperation(f.client,row);
 await assert.rejects(op.execute(true),/fresh preview/);await op.preview();assert.deepEqual(f.calls[0],['settle-sponsorship',{body:{action:'preview',order_id:id}}]);
 await assert.rejects(op.execute(false),/confirmation/);assert.equal(f.calls.length,1);
 await op.execute(true);assert.deepEqual(f.calls[1][1].body,{action:'execute',order_id:id,confirmed:true,expected_snapshot:preview.snapshot});
 await assert.rejects(op.execute(true),/fresh preview/);
});
test('cancel and group references cannot execute without fresh review',async()=>{
 const f=fixture([{data:preview}]),op=createEarningOperation(f.client,{...row,offer_kind:'group'});
 await op.preview();op.cancel();await assert.rejects(op.execute(true));assert.equal(f.calls[0][0],'process-group-payouts');assert.deepEqual(f.calls[0][1].body,{action:'preview',agreement_id:id});
 assert.throws(()=>createEarningOperation(f.client,{...row,offer_kind:'group',agreement_id:null}));
});
test('completed preview is read-only receipt and cannot reconfirm',async()=>{
 const f=fixture([{data:{...receipt,replayed:true,writes_performed:false}}]),op=createEarningOperation(f.client,row);
 assert.equal((await op.preview()).completed,true);await assert.rejects(op.execute(true));assert.equal(f.calls.length,1);
 assert.match(receiptText({...receipt,replayed:true}),/Existing result/);assert.match(receiptText(receipt),/not an external withdrawal/);
});
test('malformed or sandbox wallet preview blocks execution',()=>{
 for(const patch of [{snapshot:'BAD'},{route:'unknown'},{amount_cents:NaN},{bank_payout_confirmed:true},{writes_performed:true},{livemode:false}])assert.throws(()=>validatePreview({...preview,...patch}));
});
test('unknown execution outcome requires new preview of same earning',async()=>{
 const f=fixture([{data:preview},{error:{status:503}},{data:preview}]),op=createEarningOperation(f.client,row);
 await op.preview();await assert.rejects(op.execute(true),/same earning/);await assert.rejects(op.execute(true),/fresh preview/);await op.preview();assert.deepEqual(f.calls[2][1].body,f.calls[0][1].body);
});
test('concurrent execution is blocked and mismatched receipt rejected',async()=>{
 let resolve;const calls=[];const client={functions:{invoke:async(name,args)=>{calls.push(args);if(args.body.action==='preview')return {data:preview};return new Promise(r=>resolve=r);}}};
 const op=createEarningOperation(client,row);await op.preview();const pending=op.execute(true);await assert.rejects(op.execute(true));resolve({data:{...receipt,amount_cents:1001}});await assert.rejects(pending,/differs/);assert.equal(calls.length,2);
});
test('UI has explicit MFA and confirmation, no old queue or automatic execution',()=>{
 const source=readFileSync(new URL('../js/adminSettlements.js',import.meta.url),'utf8');assert.match(source,/currentLevel!=='aal2'/);assert.match(source,/admin_creator_earnings_queue/);assert.match(source,/check.type='checkbox'/);assert.match(source,/operation.execute\(true\)/);assert.doesNotMatch(source,/innerHTML|admin_verified_settlement_queue|setInterval|setTimeout/);
});
