const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/login.js','utf8');
function fixture({blocked=false,discard=false}={}) {
 const values=new Map();let now=1000;
 const context={window:{localStorage:{getItem:k=>values.get(k)??null,setItem(k,v){if(blocked)throw Error('blocked');if(!discard)values.set(k,v);}}},Date:{now:()=>now},Number,console:{warn(){}},TWOFA_TRUSTED_KEY:'trusted'};
 vm.createContext(context);
 vm.runInContext(source.slice(source.indexOf('function readJsonFromStorage'),source.indexOf('// Attempt tracking')),context);
 vm.runInContext(source.slice(source.indexOf('function isDeviceTrustedForUser'),source.indexOf('function rememberDeviceOrExplain')),context);
 return {context,values,advance(ms){now+=ms;}};
}
test('remembered browser survives reload, isolates accounts and expires after 30 days',()=>{
 const f=fixture();assert.equal(f.context.setDeviceTrustedForUser('creator',30),true);
 assert.equal(f.context.isDeviceTrustedForUser('creator'),true);assert.equal(f.context.isDeviceTrustedForUser('sponsor'),false);
 f.advance(30*86400000);assert.equal(f.context.isDeviceTrustedForUser('creator'),false);
});
test('blocked or silently discarded browser storage does not report a remembered device',()=>{
 for(const options of [{blocked:true},{discard:true}]){const f=fixture(options);assert.equal(f.context.setDeviceTrustedForUser('creator',30),false);assert.equal(f.context.isDeviceTrustedForUser('creator'),false);}
});
test('malformed or non-numeric expiry does not bypass the additional code',()=>{
 const f=fixture();for(const value of ['broken','{"creator":{"trustedUntil":"Infinity"}}','{"creator":{"trustedUntil":null}}']){f.values.set('trusted',value);assert.equal(f.context.isDeviceTrustedForUser('creator'),false);}
});
test('ordinary website logout and cancelled login preserve other signed-in devices',()=>{
 for(const path of ['auth.js','js/adminLogic.js','js/login.js','privacy.html','reviews.html','terms.html']) {
  const text=fs.readFileSync(path,'utf8');
  assert.doesNotMatch(text,/supabase\.auth\.signOut\(\)/,path);
  assert.match(text,/signOut\(\{ scope: 'local' \}\)/,path);
 }
 // Changing a password still revokes other sessions intentionally.
 assert.match(fs.readFileSync('js/resetPassword.js','utf8'),/supabase\.auth\.signOut\(\{\s*scope:\s*'global'\s*\}\)/);
});
