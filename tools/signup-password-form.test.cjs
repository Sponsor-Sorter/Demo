const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../payment-success-signup.html'), 'utf8');
const source = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace(/^import .*;\s*$/gm, '');

for (const mode of ['free', 'paid']) test(`${mode}: password recovery form waits for submission and never stores credentials`, async () => {
  const elements = [];
  const element = tag => {
    const node = {tag, children: [], value: '', handlers: {}, append(...children) { this.children.push(...children); }, addEventListener(name, fn) { this.handlers[name] = fn; }, remove() { this.removed = true; }};
    elements.push(node);
    return node;
  };
  const status = element('status');
  const registration = JSON.stringify({email:'fixture@example.invalid',username:'Fixture',planType:mode==='free'?'free':'pro',userType:'besponsored'});
  const store = new Map([['pendingRegistration',registration]]);
  const calls = [];
  const client = {
    rpc: async () => ({data:true,error:null}),
    functions:{invoke:async()=>({data:{success:true},error:null})},
  };
  const context = {URL, console, document:{getElementById:()=>status,createElement:element,addEventListener(){}},
    window:{location:{href:`https://fixture.invalid/?mode=${mode}&session_id=fixture&payment_status=success`}},
    localStorage:{getItem:key=>store.get(key)??null,removeItem:key=>store.delete(key),setItem(){throw Error('unexpected credential storage');}},
    prompt(){throw Error('browser prompt must not be used');},
    createOrResumeSignupAccount:async(_,args)=>{calls.push(args);return {data:{user:{id:'fixture'},session:null},error:null};},
    supabase:client,escapeHtml:String,setTimeout(){}
  };
  const completion = vm.runInNewContext(source+'\nfinalizeSignupAfterPayment();',context);
  assert.equal(calls.length,0);
  assert.equal(store.get('pendingRegistration'),registration);
  const form=elements.find(e=>e.tag==='form'), input=elements.find(e=>e.tag==='input');
  assert.equal(input.type,'password');
  assert.equal(input.required,true);
  assert.equal(elements.find(e=>e.tag==='label').htmlFor,input.id);
  form.handlers.submit({preventDefault(){}});
  assert.equal(calls.length,0);
  input.value='synthetic-test-password';
  form.handlers.submit({preventDefault(){}});
  await completion;
  assert.equal(calls.length,1);
  assert.equal(calls[0].password,'synthetic-test-password');
  assert.equal(input.value,'');
  assert.equal(form.removed,true);
  assert.equal(store.has('pendingRegistration'),false);
});
