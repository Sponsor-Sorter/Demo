const test = require('node:test');
const assert = require('node:assert/strict');
const { moderateSignupWithFamBot } = require('../js/famBotSignup.js');
const id = 'e607909c-d68b-46fa-bc75-dbf2a3b96775';
const valid = (overrides = {}) => ({ ok:true, flagged:false, allowed:true, account_penalty:false, flaggedCategories:[], check_id:id, policy_version:'signup-moderation-v1', replayed:false, ...overrides });
const client = data => ({functions:{invoke:async()=>({data,error:null})}});
test('signup sends normalized content, null actor, UUID and abort signal', async () => {
  let args;
  const result = await moderateSignupWithFamBot({functions:{invoke:async(...value)=>{args=value;return {data:valid()};}}}, ' e\u0301 ', {request_id:id});
  assert.equal(result.status,'allowed');
  assert.equal(args[0],'FamBotSignup');
  assert.deepEqual(args[1].body,{user_id:null,content:'é',request_id:id});
  assert.ok(args[1].signal instanceof AbortSignal);
});
test('blocked and replayed decisions remain blocked', async()=>{
  for(const replayed of [false,true]) assert.equal((await moderateSignupWithFamBot(client(valid({flagged:true,allowed:false,flaggedCategories:['violence'],replayed})), 'sample')).status,'blocked');
});
test('errors and all malformed decision metadata fail closed', async()=>{
  const variants=[null,{flagged:false},valid({ok:false}),valid({allowed:false}),valid({account_penalty:true}),valid({check_id:'bad'}),valid({policy_version:'old'}),valid({replayed:0}),valid({flaggedCategories:[1]}),valid({flagged:'false'}),valid({flagged:true,allowed:true})];
  for(const data of variants) assert.equal((await moderateSignupWithFamBot(client(data),'sample')).status,'unavailable');
  assert.equal((await moderateSignupWithFamBot({functions:{invoke:async()=>{throw Error('fixture');}}},'sample')).status,'unavailable');
  assert.equal((await moderateSignupWithFamBot({functions:{invoke:async()=>({data:valid(),error:{status:429}})}},'sample')).status,'unavailable');
});
test('invalid input never invokes backend and unicode uses codepoints',async()=>{
  let calls=0;
  const api={functions:{invoke:async()=>{calls++;return {data:valid()};}}};
  for(const content of [null,' ','x'.repeat(12001),'😀'.repeat(12001)]) assert.equal((await moderateSignupWithFamBot(api,content)).status,'unavailable');
  assert.equal((await moderateSignupWithFamBot(api,'sample',{request_id:'bad'})).status,'unavailable');
  assert.equal(calls,0);
  assert.equal((await moderateSignupWithFamBot(api,'😀'.repeat(12000))).status,'allowed');
});
test('whole-operation deadline aborts stalled SDK without retry',async()=>{
  const original=global.setTimeout;
  let signal,calls=0;
  global.setTimeout=(fn,ms)=>original(fn,ms===25000?10:ms);
  try {
    const result=await moderateSignupWithFamBot({functions:{invoke:(_name,options)=>{calls++;signal=options.signal;return new Promise(()=>{});}}},'sample');
    assert.equal(result.status,'unavailable');assert.equal(signal.aborted,true);assert.equal(calls,1);
  } finally {global.setTimeout=original;}
});
