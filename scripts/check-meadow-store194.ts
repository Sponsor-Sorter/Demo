import {validatePurchase} from '../supabase/functions/meadow-market-store/rules.ts';
import {signatureRaw,verifyCallback} from '../supabase/functions/meadow-market-ad-reward/verify.ts';
function assert(value:unknown,message:string){if(!value)throw Error(message);}
function rejects(fn:()=>unknown,message:string){try{fn()}catch(e){assert((e as Error).message===message,message);return;}throw Error('Accepted invalid purchase');}
Deno.test('Google purchase requires paid state, account binding and one quantity',()=>{
 const valid={purchaseState:0,quantity:1,obfuscatedExternalAccountId:'account',purchaseType:0};
 assert(validatePurchase(valid,'account').test,'Google license test is recognized');
 assert(!validatePurchase({...valid,purchaseType:undefined},'account').test,'Real purchase remains real');
 rejects(()=>validatePurchase({...valid,purchaseState:2},'account'),'PURCHASE_PENDING');
 rejects(()=>validatePurchase({...valid,purchaseState:1},'account'),'PURCHASE_NOT_COMPLETED');
 rejects(()=>validatePurchase({...valid,quantity:2},'account'),'MULTI_QUANTITY_UNSUPPORTED');
 rejects(()=>validatePurchase(valid,'other'),'PURCHASE_ACCOUNT_MISMATCH');
 rejects(()=>validatePurchase({...valid,obfuscatedExternalAccountId:undefined},'account'),'PURCHASE_ACCOUNT_MISMATCH');
});
function der(raw:Uint8Array){
 const integer=(part:Uint8Array)=>{let v=part;while(v.length>1&&v[0]===0)v=v.slice(1);if(v[0]&128)v=new Uint8Array([0,...v]);return new Uint8Array([2,v.length,...v]);};
 const a=integer(raw.slice(0,32)),b=integer(raw.slice(32));return new Uint8Array([48,a.length+b.length,...a,...b]);
}
const b64=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
Deno.test('AdMob callback verifies exact signed bytes and rejects tampering',async()=>{
 const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
 const publicBytes=new Uint8Array(await crypto.subtle.exportKey('spki',pair.publicKey));
 const pem='-----BEGIN PUBLIC KEY-----\n'+btoa(String.fromCharCode(...publicBytes))+'\n-----END PUBLIC KEY-----';
 const signed='ad_network=5450213213286189855&ad_unit=123&custom_data=nonce&reward_amount=5&reward_item=gems&timestamp=1793300000000&transaction_id=12345678&user_id=account';
 const raw=new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},pair.privateKey,new TextEncoder().encode(signed)));
 assert(signatureRaw(der(raw)).every((n,i)=>n===raw[i]),'DER conversion round trip');
 const original=globalThis.fetch;globalThis.fetch=()=>Promise.resolve(Response.json({keys:[{keyId:1,pem}]}));
 try{
  const valid=new URL('https://example.test/?'+signed+'&signature='+b64(der(raw))+'&key_id=1');
  assert((await verifyCallback(valid)).get('reward_item')==='gems','Valid provider signature');
  let denied=false;try{await verifyCallback(new URL(valid.href.replace('reward_amount=5','reward_amount=500')))}catch{denied=true;}assert(denied,'Tampered amount rejected');
  denied=false;try{await verifyCallback(new URL(valid.href+'&signature=again'))}catch{denied=true;}assert(denied,'Duplicate signature rejected');
 }finally{globalThis.fetch=original;}
});
