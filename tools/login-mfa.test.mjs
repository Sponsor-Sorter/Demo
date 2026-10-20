import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {existingAuthenticator,verifyAuthenticator} from '../js/loginMfa.mjs';
test('verified native authenticator preferred; no secrets returned',async()=>{
 const client={auth:{mfa:{listFactors:async()=>({data:{totp:[{id:'verified',status:'verified',friendly_name:'Phone'},{id:'pending',status:'unverified'}]}})}}};
 assert.deepEqual(await existingAuthenticator(client),[{id:'verified',name:'Phone'}]);
 await assert.rejects(existingAuthenticator({auth:{mfa:{listFactors:async()=>({error:{message:'network'}})}}}));
});
test('server verifies code then requires actual AAL2 session',async()=>{
 const calls=[];const client={auth:{mfa:{challengeAndVerify:async arg=>{calls.push(arg);return {};},getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:'aal2'}})}}};
 assert.equal(await verifyAuthenticator(client,'factor','123456'),true);assert.deepEqual(calls,[{factorId:'factor',code:'123456'}]);
 client.auth.mfa.getAuthenticatorAssuranceLevel=async()=>({data:{currentLevel:'aal1'}});await assert.rejects(verifyAuthenticator(client,'factor','123456'),/session/);
});
test('bad code and rate limit never succeed or use local verification',async()=>{
 let count=0;const client={auth:{mfa:{challengeAndVerify:async()=>{count++;return {error:{status:429}};}}}};
 await assert.rejects(verifyAuthenticator(client,'factor','nototp'));assert.equal(count,0);
 await assert.rejects(verifyAuthenticator(client,'factor','123456'),/Wait/);
});
test('native selection precedes legacy email and trusted-device bypass',()=>{
 const s=readFileSync(new URL('../js/login.js',import.meta.url),'utf8');
 assert.ok(s.indexOf('const nativeFactors=await existingAuthenticator')<s.indexOf('if (twofaEnabled)'));
 const handler=s.slice(s.indexOf("totpSubmitBtn.addEventListener('click'"));
 assert.ok(handler.indexOf('if (twofaContext.nativeFactors)')<handler.indexOf('isTwofaLocked('));
 const native=handler.slice(0,handler.indexOf('const lockInfo ='));
 assert.doesNotMatch(native,/twofa_totp_secret|verifyTotpToken|rememberDeviceOrExplain/);
 assert.match(s,/current.data\?\.user\?\.id!==user.id/);
});
test('targeted legacy lock reset preserves other user entries',()=>{
 const s=readFileSync(new URL('../js/login.js',import.meta.url),'utf8');const start=s.indexOf('function resetTwofaAttempts('),end=s.indexOf('\nfunction isTwofaLocked',start);
 const all={affected:{count:3},other:{count:1}};let saved;
 const reset=vm.runInNewContext(s.slice(start,end)+';resetTwofaAttempts',{readJsonFromStorage:()=>all,writeJsonToStorage:(key,value)=>saved=value,TWOFA_ATTEMPTS_KEY:'ss_twofa_attempts'});
 reset('affected');assert.deepEqual(Object.keys(saved),['other']);assert.equal(saved.other.count,1);
});
