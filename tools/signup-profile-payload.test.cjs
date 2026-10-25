const test=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const html=readFileSync(path.join(__dirname,'../payment-success-signup.html'),'utf8');
const moduleSource=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace(/^import .*;\s*$/gm,'');

async function complete(mode,heardAbout,{fail=false}={}) {
  const reg={email:'fixture@example.invalid',username:'Fixture',userType:'besponsored',planType:mode==='free'?'free':'pro',heard_about:heardAbout};
  const store=new Map([['pendingRegistration',JSON.stringify(reg)]]),calls=[],status={};
  const context={URL,document:{getElementById:()=>status,addEventListener(){}},
    window:{location:{href:`https://fixture.invalid/payment-success-signup.html?mode=${mode}&session_id=cs_test_fixture&payment_status=success`},__signupPassword:'fixture-only'},
    localStorage:{getItem:key=>store.get(key)??null,removeItem:key=>store.delete(key)},
    createOrResumeSignupAccount:async()=>({data:{user:{id:'fixture-user'},session:null},error:null}),
    escapeHtml:value=>String(value),console:{error(){}},setTimeout(){},
    supabase:{
      rpc:async(name,args)=>{calls.push({name,args});return {data:true,error:fail?Error('fixture failure'):null};},
      functions:{invoke:async(name,args)=>{calls.push({name,args});return {data:{success:true},error:fail?Error('fixture failure'):null};}},
      storage:{from(){throw Error('unexpected storage call');}}
    }
  };
  await vm.runInNewContext(moduleSource+'\nfinalizeSignupAfterPayment();',context,{timeout:1000});
  assert.equal(calls.length,1);
  const call=calls[0];
  assert.equal(call.name,mode==='free'?'register_pending_profile':'complete-paid-signup');
  return {profile:mode==='free'?call.args.p_profile:call.args.body.profile,call,store,status};
}

for(const mode of ['free','paid']) {
  test(`${mode} completion carries normalized heard_about before clearing pending registration`,async()=>{
    const {profile,store}=await complete(mode,'  Search Engine  ');
    assert.equal(profile.heard_about,'Search Engine');
    assert.equal(profile.user_id,'fixture-user');
    assert.equal(store.has('pendingRegistration'),false);
  });
  test(`${mode} completion preserves the already-normalized Other answer`,async()=>{
    // formSubmit normalizes Other to its text and removes heard_about_other.
    const {profile}=await complete(mode,'Local community newsletter');
    assert.equal(profile.heard_about,'Local community newsletter');
    assert.equal(Object.hasOwn(profile,'heard_about_other'),false);
  });
  test(`${mode} completion uses null for absent, blank or non-string answer`,async()=>{
    for(const answer of [undefined,'  ',42])assert.equal((await complete(mode,answer)).profile.heard_about,null);
  });
  test(`${mode} failed profile completion retains pending registration for retry`,async()=>{
    const {store,status}=await complete(mode,'Friend',{fail:true});
    assert.equal(JSON.parse(store.get('pendingRegistration')).heard_about,'Friend');
    assert.match(status.innerHTML,/profile setup did not finish/);
  });
}
