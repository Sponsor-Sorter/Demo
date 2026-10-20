import test from 'node:test';
import assert from 'node:assert/strict';
import {withdrawalDto,retainWithdrawalRequest,sendWithdrawalRequest} from '../js/walletWithdrawal.mjs';
const base={requestId:'12345678-1234-4123-8123-123456789abc',amount:'10.01',method:'paypal',destination:'test@example.com'};
test('USD converted exactly to integer cents and canonical RPC parameter names',async()=>{
 const dto=withdrawalDto(base);assert.equal(dto.p_amount_cents,1001);assert.equal(Object.isFrozen(dto),true);
 let call;await sendWithdrawalRequest({rpc:async(...args)=>{call=args;return {data:{ok:true,replayed:false,request_id:dto.p_request_id,payout_id:'fixture',status:'pending',amount_cents:1001,currency:'usd',method:'paypal',processing:'manual_admin',funds_sent:false,wallet_debited_at_request:false}};}},dto);
 assert.equal(call[0],'request_wallet_withdrawal');assert.equal(call[1],dto);
});
test('invalid amounts, rails and destination rejected',()=>{
 for(const amount of ['Infinity','1e3','10.001','-10','9.99','9007199254740991']) assert.throws(()=>withdrawalDto({...base,amount}));
 assert.throws(()=>withdrawalDto({...base,method:'unknown'}));assert.throws(()=>withdrawalDto({...base,destination:'bad'}));
});
test('retry preserves exact identity and does not silently replace prior details',()=>{
 const original=withdrawalDto(base);const proposed=withdrawalDto({...base,requestId:'87654321-1234-4123-8123-123456789abc'});
 assert.equal(retainWithdrawalRequest(original,proposed),original);
 assert.throws(()=>retainWithdrawalRequest(original,withdrawalDto({...base,amount:'11'})));
});

test('ambiguous reply and business failure never become success',async()=>{
 const dto=withdrawalDto(base);
 await assert.rejects(sendWithdrawalRequest({rpc:async()=>({data:{ok:true}})},dto),/confirmation unavailable/i);
 await assert.rejects(sendWithdrawalRequest({rpc:async()=>({data:{ok:false,code:'PAYOUT_METHOD_UNAVAILABLE'}})},dto),/unavailable/i);
 await assert.rejects(sendWithdrawalRequest({rpc:async()=>({error:{message:'CURRENT_ACCOUNT_REQUIRED'}})},dto),/Sign in again/);
});
test('unsupported Stripe rejected and destination normalized',()=>{
 assert.throws(()=>withdrawalDto({...base,method:'stripe'}));
 assert.equal(withdrawalDto({...base,destination:' TEST@Example.com '}).p_destination,'test@example.com');
});
test('wallet source uses RPC, blocks stale reservations and labels manual process',async()=>{
 const {readFileSync}=await import('node:fs');const source=readFileSync(new URL('../js/wallet.js',import.meta.url),'utf8');
 assert.doesNotMatch(source,/\.insert\(/);assert.match(source,/throw Error\('Pending withdrawal reservations are unavailable/);
 assert.match(source,/sessionStorage.setItem\(storageKey,JSON.stringify\(pending\)\)/);
 assert.match(source,/if\(submitting\) return/);assert.match(source,/Stripe withdrawals — unavailable/);assert.doesNotMatch(source,/up to 3 days/);
});
