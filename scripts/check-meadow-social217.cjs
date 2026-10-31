const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('meadow-and-market/social.js','utf8');
function harness(){
 let who='account-a',reply={data:{id:'recorded-visit'}},resolve,online=false,rpc=async()=>reply;const calls=[],window={meadowStory:{event:id=>calls.push('story:'+id)},meadowGuides:{event:id=>calls.push('lesson:'+id)}};
 const context={window,document:{hidden:false,addEventListener:()=>{}},crypto:{randomUUID:()=> 'request-id'},setInterval:()=>{},console};
 window.addEventListener=()=>{};vm.runInNewContext(source,context);
 const api={state:()=>({active:'willow'}),ready:()=>online,user:()=>({id:who}),notify:m=>calls.push('notice:'+m),save:()=>calls.push('save'),client:()=>({rpc:(...args)=>rpc(...args)})};
 window.meadowSocial.attach(api);online=true;
 return {window,calls,visit:{map:'east',userId:'friend'},reply:r=>reply=r,owner:v=>who=v,online:v=>online=v,delayed:()=>{rpc=()=>new Promise(r=>resolve=r);return r=>resolve(r)}};
}
(async()=>{
 const verified=harness();verified.window.meadowCommandUI={required:()=>true,maintenance:async commands=>verified.calls.push(JSON.parse(JSON.stringify(commands)))};
 await verified.window.meadowSocial.record(verified.visit,'visit');assert.deepEqual(verified.calls,[[{type:'social.visit',map:'willow'}]]);
 const denied=harness();denied.reply({error:{message:'Not an accepted friend'}});denied.window.meadowCommandUI=verified.window.meadowCommandUI;await denied.window.meadowSocial.record(denied.visit,'visit');assert.equal(denied.calls.length,1);assert.match(denied.calls[0],/notice:/);
 const legacy=harness();await legacy.window.meadowSocial.record(legacy.visit,'visit');assert.deepEqual(legacy.calls,['story:visit','lesson:friends','save']);
 const switched=harness(),finish=switched.delayed(),pending=switched.window.meadowSocial.record(switched.visit,'visit');switched.owner('account-b');finish({data:{id:'old-account-visit'}});assert.equal(await pending,null);assert.deepEqual(switched.calls,[]);
 const waiting=harness();waiting.window.meadowCommandUI={required:()=>true,maintenance:async()=>{throw Error('offline')}};await waiting.window.meadowSocial.record(waiting.visit,'visit');assert.equal(waiting.calls.length,1);assert.match(waiting.calls[0],/Reconnect/);
 const game=fs.readFileSync('meadow-and-market/game.js','utf8'),visit=game.slice(game.indexOf('  async function visitFriendFarm('),game.indexOf('  function closeFriendVisit(',game.indexOf('  async function visitFriendFarm(')));
 assert(visit.includes("window.meadowSocial?.record(activeVisit,'visit')"));assert(!visit.includes("meadowStory?.event('visit')"),'Viewing a snapshot alone must not award social progress');
 console.log('Friend visits: recorded proof before progress, legacy compatibility, account isolation and uncertain command retry passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
