const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('meadow-and-market/control.js','utf8');
(async()=>{
 let who='account-a',data={enforced:true,admitted:true,moderation:{banned:false,restricted:false,decisions:[]},runtime:{maintenance:false,notices:[]}},rpcError=null;
 const calls=[],listeners={},scope={crypto:{randomUUID:()=> 'qa-request'},setInterval(){},window:{addEventListener(n,fn){listeners[n]=fn}},document:{hidden:false,querySelector(s){return s==='dialog[open]'?{}:null},addEventListener(){}}};
 vm.runInNewContext(source,scope);const control=scope.window.meadowControl;
 control.attach({user:()=>who?{id:who}:null,client:()=>({rpc:async(name,args)=>{calls.push({name,args});return {data,error:rpcError}}}),notify(){}});await control.refresh();assert.equal(control.blocked(),false);assert.equal(calls[0].args.p_data.build,222);assert(!('app' in calls[0].args.p_data)&&!('actor' in calls[0].args.p_data));
 data={...data,moderation:{banned:true,decisions:[]}};await control.refresh();assert.equal(control.blocked(),true);
 who='account-b';assert.equal(control.blocked(),false,'Another account never inherits old restrictions');
 data={...data,moderation:{banned:false},runtime:{maintenance:true},admitted:false};await control.refresh();assert.equal(control.blocked(),true);
 data={...data,admitted:true};await control.refresh();assert.equal(control.blocked(),false,'Existing admitted work remains available');
 data={...data,runtime:{maintenance:false},moderation:{banned:false,restricted:true,decisions:[]}};await control.refresh();assert.equal(control.blocked(),false,'Social restriction does not freeze private farming');
 rpcError={code:'28000',message:'Expired session'};await control.refresh();assert.equal(control.blocked(),true);who='';assert.equal(control.blocked(),false);await control.refresh();
 const transportScope={window:{}};vm.runInNewContext(fs.readFileSync('meadow-and-market/farm-commands.js','utf8'),transportScope);
 for(const status of [401,403]){const storage=new Map(),bodies=[];let denied=true;const a={owner:()=> 'account-a',revision:1,uuid:()=> 'request-a',storage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},apply(){},send:async body=>{bodies.push(JSON.stringify(body));return denied?{status,data:{message:'Account access paused'}}:{status:200,data:{ok:true,request_id:body.request_id,accepted_revision:2,revision:2,save_data:{coins:250}}}}};const c=transportScope.window.meadowFarmCommands.create(a);await assert.rejects(()=>c.run([{type:'workers.tick'}]),e=>e.code===(status===401?'SESSION_EXPIRED':'ACCESS_PAUSED'));assert(c.status().pending);assert.equal(storage.size,1);denied=false;await c.retry();assert.equal(bodies[0],bodies[1]);assert.equal(storage.size,0);}
 const game=fs.readFileSync('meadow-and-market/game.js','utf8');assert(game.includes("privacyCheck.error?.code==='28000'"));assert(game.includes('if(window.meadowControl?.blocked()){'));assert(game.includes('commandConnection(false);watchCloudAccount(client,cloudUser.id);window.meadowControl.open();return;'));
 assert(source.includes('esc(d.reason)')&&source.includes('esc(n.message)'),'Central text is escaped');assert(source.includes('Account, recovery & settings'));
 console.log('Control222 UI/transport: notice build, account boundary, ban/maintenance/restriction distinction, expired-session recovery, escaped text and retained exact request retry passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
