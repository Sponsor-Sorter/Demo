// Explicit, isolated QA only. Creates an anonymous identity without a password.
// The session stays in this process's memory; no token is printed or persisted.
// After the emitted UUID, prepare ONLY that fixture in SQL, then send "go".
// Remove the fixture through its exact Auth UUID after the assertions complete.
const fs=require('node:fs'),readline=require('node:readline'),crypto=require('node:crypto');
const html=fs.readFileSync('meadow-and-market/index.html','utf8'),project=html.match(/const project='([^']+)'/)[1],key=html.match(/,key='([^']+)'/)[1];
let session;
function assert(x,message){if(!x)throw Error(message);}
async function call(path,body,authorization=session?.access_token){
 const r=await fetch(project+path,{method:body===undefined?'GET':'POST',headers:{apikey:key,...authorization?{Authorization:'Bearer '+authorization}:{},'Content-Type':'application/json',Origin:'https://sponsorsorter.com'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
 const data=await r.json();return {status:r.status,data};
}
(async()=>{
 assert(process.stdin.isTTY,'Run isolated live QA with an interactive terminal; ordinary CI must use the deterministic fixtures.');
 const signed=await call('/auth/v1/signup',{data:{game:'meadow-markets',qa_fixture:'farm-command204'}});
 assert(signed.status===200&&signed.data.access_token,'QA anonymous sign-in failed');session=signed.data;
 console.log(JSON.stringify({prepare_fixture_for:session.user.id}));
 const lines=readline.createInterface({input:process.stdin,terminal:false});let prepared=false;for await(const line of lines){if(line.trim()==='go'){prepared=true;break;}}lines.close();assert(prepared,'The disposable fixture must be prepared before continuing.');
 const current=await call('/rest/v1/meadow_market_saves?select=revision');assert(current.status===200&&current.data.length===1,'Exact fixture must be prepared');
 const id=crypto.randomUUID(),first={request_id:id,expected_revision:current.data[0].revision,commands:[{type:'plot.harvest',map:'willow',target:'qa-plot'}]};
 const path='/functions/v1/meadow-market-farm-actions',a=await call(path,first);assert(a.status===200&&a.data.ok,'Live command failed: '+a.status);assert(a.data.save_data.coins===252&&a.data.save_data.farms.willow.inventory.carrot===23,'Harvest arithmetic mismatch');
 const replay=await call(path,first);assert(replay.status===200&&replay.data.replayed&&replay.data.save_data.coins===252,'Lost-response replay repeated harvest');
 const second={request_id:crypto.randomUUID(),expected_revision:a.data.revision,commands:[{type:'plot.plant',map:'willow',target:'qa-plot',data:{crop:'carrot'}},{type:'plot.water',map:'willow',target:'qa-plot'}]};
 const b=await call(path,second);assert(b.status===200&&b.data.save_data.coins===248,'Live plant/water arithmetic mismatch');
 const old=await call(path,first);assert(old.status===200&&old.data.replayed&&old.data.revision===b.data.revision&&old.data.accepted_revision===a.data.revision&&old.data.save_data.coins===248,'Old retry lost newer farm state');
 const early=await call(path,{...first,request_id:crypto.randomUUID(),expected_revision:b.data.revision});assert(early.status===422&&early.data.error==='NOT_READY','Early harvest accepted');
 const changed=await call(path,{...first,commands:[{type:'shop.check'}]});assert(changed.status===422,'Changed request reused an accepted ID');
 const injected=await call(path,{...second,request_id:crypto.randomUUID(),expected_revision:b.data.revision,save_data:{coins:999999}});assert(injected.status===422,'Injected snapshot accepted');
 const direct=await call('/rest/v1/rpc/meadow_market_commit_farm_command',{p_user:session.user.id,p_request_id:crypto.randomUUID(),p_body:second,p_save_data:b.data.save_data,p_summary:{}});assert([401,403].includes(direct.status),'Client reached private commit RPC');
 console.log(JSON.stringify({passed:true,owner:session.user.id,checks:['real-auth','deployed-reducer','server-harvest','plant-water','exact-retry','old-retry-current-state','early-harvest-denied','changed-retry-denied','snapshot-injection-denied','private-rpc-denied'],final_revision:b.data.revision,final_gold:248}));
})().catch(()=>{console.error('Live farm QA failed. Inspect the exact disposable fixture without printing its session.');process.exitCode=1;});
