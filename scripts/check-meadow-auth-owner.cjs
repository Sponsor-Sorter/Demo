const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),game=fs.readFileSync('meadow-and-market/game.js','utf8');
for(const event of ['SIGNED_IN','SIGNED_OUT']){
  let callback;const writes=new Map(),trace=[],tasks=[],scope={cloudReady:true,replacingFarm:false,cloudWriter:{pause:()=>trace.push('pause')},cloudSaveTimer:1,state:{coins:400,version:1},SAVE_KEY:'farm',localStorage:{setItem:(k,v)=>writes.set(k,v),removeItem:k=>writes.delete(k)},defaultState:()=>({coins:250,version:1}),clearTimeout(){},setTimeout:f=>tasks.push(f),location:{reload:()=>trace.push('reload')},notify(){}};
  vm.createContext(scope);vm.runInContext(game.slice(game.indexOf('  function watchCloudAccount('),game.indexOf('  async function startCloud(')),scope);scope.watchCloudAccount({auth:{onAuthStateChange:f=>callback=f}},'old');
  callback('TOKEN_REFRESHED',{user:{id:'old'}});callback('SIGNED_IN',{user:{id:'old'}});assert.equal(trace.length,0);
  callback(event,event==='SIGNED_IN'?{user:{id:'new'}}:null);assert.equal(scope.cloudReady,false);assert(scope.replacingFarm);assert.deepEqual(trace,['pause']);assert.equal(tasks.length,1);tasks[0]();assert.equal(JSON.parse(writes.get('farm-account-old')).coins,400);assert.equal(JSON.parse(writes.get('farm')).coins,250);assert.equal(trace.at(-1),'reload');
  if(event==='SIGNED_IN'){assert.equal(writes.get('farm-load-account'),'new');assert(!writes.has('meadow-markets-login-required'));}else assert.equal(writes.get('meadow-markets-login-required'),'1');
  callback('SIGNED_IN',{user:{id:'third'}});assert.equal(tasks.length,1,'An in-progress account transition cannot run twice');
}
console.log('External account changes: same-owner refresh ignored, writes frozen before SDK callback returns, old farm backed up, clean next-account gate and duplicate protection passed.');
