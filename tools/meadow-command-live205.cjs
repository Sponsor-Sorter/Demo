// Manual isolated QA: the anonymous session stays only in process memory.
// Prepare only the printed disposable UUID, send "go", then remove that UUID.
const fs=require('node:fs'),readline=require('node:readline'),crypto=require('node:crypto');
const html=fs.readFileSync('meadow-and-market/index.html','utf8'),project=html.match(/const project='([^']+)'/)[1],key=html.match(/,key='([^']+)'/)[1];let session;
function assert(v){if(!v)throw Error('Fixture assertion failed');}
async function call(path,body){const r=await fetch(project+path,{method:body===undefined?'GET':'POST',headers:{apikey:key,...session?{Authorization:'Bearer '+session.access_token}:{},'Content-Type':'application/json',Origin:'https://sponsorsorter.com'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});return{status:r.status,data:await r.json()};}
(async()=>{
 assert(process.stdin.isTTY);const signed=await call('/auth/v1/signup',{data:{game:'meadow-markets',qa_fixture:'farm-command205'}});assert(signed.status===200&&signed.data.access_token);session=signed.data;console.log(JSON.stringify({prepare_fixture_for:session.user.id}));
 const lines=readline.createInterface({input:process.stdin,terminal:false});let prepared=false;for await(const line of lines){if(line.trim()==='go'){prepared=true;break;}}lines.close();assert(prepared);
 const stored=await call('/rest/v1/meadow_market_saves?select=revision');assert(stored.status===200&&stored.data.length===1);let revision=stored.data[0].revision;const path='/functions/v1/meadow-market-farm-actions';
 const send=async commands=>{const body={request_id:crypto.randomUUID(),expected_revision:revision,commands},r=await call(path,body);assert(r.status===200&&r.data.ok);revision=r.data.revision;return{body,data:r.data};};
 const hired=await send([{type:'workers.hire',map:'willow',target:'rowan'}]);assert(hired.data.save_data.coins===9350);
 const replay=await call(path,hired.body);assert(replay.status===200&&replay.data.replayed&&replay.data.save_data.coins===9350);
 await send([{type:'workers.assign',map:'willow',target:'rowan',data:{x:4,y:4,expectedMap:null}}]);
 const tick=await send([{type:'workers.tick',map:'willow'}]),lease=tick.data.save_data._serverWorkers.leases['hire-rowan'];assert(lease.target==='qa-plot');
 const early=await send([{type:'workers.tick',map:'willow'}]);assert(early.data.save_data.farms.willow.inventory.carrot===20);
 await new Promise(resolve=>setTimeout(resolve,Math.max(0,lease.readyAt-Date.now()+100)));
 const done=await send([{type:'workers.tick',map:'willow'}]);assert(done.data.save_data.farms.willow.inventory.carrot===23&&done.data.save_data.workforce.rowan.jobs===1);
 const repeat=await send([{type:'workers.tick',map:'willow'}]);assert(repeat.data.save_data.farms.willow.inventory.carrot===23&&repeat.data.save_data.workforce.rowan.jobs===1);
 const injected=await call(path,{request_id:crypto.randomUUID(),expected_revision:revision,commands:[{type:'workers.tick',data:{task:'qa-plot',readyAt:1}}]});assert(injected.status===422);
 const raw=await call('/rest/v1/rpc/meadow_market_play_service',{p_action:'event',p_data:{id:crypto.randomUUID(),event:'harvest',amount:100}});assert(raw.status===403);
 const status=await call('/rest/v1/rpc/meadow_market_play_service',{p_action:'status',p_data:{}});assert(status.status===200&&status.data.missions.find(m=>m.id==='daily_harvest').progress===1);
 const old=await call(path,hired.body);assert(old.status===200&&old.data.replayed&&old.data.revision===revision&&old.data.save_data.workforce.rowan.jobs===1);
 console.log(JSON.stringify({passed:true,owner:session.user.id,checks:['real-auth','deployed-hire-price','exact-hire-retry','assignment','saved-worker-lease','early-poll-no-reward','server-time-completion','duplicate-poll-no-reward','task-injection-rejected','raw-mission-rejected','one-verified-mission','old-retry-current-farm'],final_revision:revision,final_gold:repeat.data.save_data.coins}));
})().catch(()=>{console.error('Live worker QA failed. Inspect only the disposable fixture without printing its session.');process.exitCode=1});
