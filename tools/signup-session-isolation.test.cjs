const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

test('signup uses a separate in-memory client while preserving the existing dashboard client',()=>{
  const existing={name:'existing-admin-session'};
  const calls=[];
  const source=fs.readFileSync(path.join(__dirname,'../js/supabaseClient.js'),'utf8')
    .replace(/^import .*$/gm,'').replace(/export /g,'');
  const context={window:{__SS_SUPABASE__:existing},createClient:(url,key,options)=>{
    const client={url,key,options};calls.push(client);return client;
  }};
  vm.createContext(context);
  vm.runInContext(source+'\nthis.fixtureSignup=createSignupClient();this.fixtureDashboard=supabase;',context);
  assert.equal(calls.length,1);
  assert.equal(context.fixtureDashboard,existing);
  assert.equal(context.window.__SS_SUPABASE__,existing);
  assert.notEqual(context.fixtureSignup,existing);
  const auth=context.fixtureSignup.options.auth;
  assert.equal(auth.persistSession,false);
  assert.equal(auth.autoRefreshToken,false);
  assert.equal(auth.detectSessionInUrl,false);
});

test('completion uses its isolated client for both account creation and profile completion',()=>{
  const html=fs.readFileSync(path.join(__dirname,'../payment-success-signup.html'),'utf8');
  assert.match(html,/import \{ createSignupClient \} from '\.\/js\/supabaseClient\.js\?v=20261026-signup-isolation1'/);
  assert.match(html,/const supabase = createSignupClient\(\);/);
  assert.match(html,/createOrResumeSignupAccount\(supabase,/);
  assert.match(html,/\.rpc\('register_pending_profile'/);
});
