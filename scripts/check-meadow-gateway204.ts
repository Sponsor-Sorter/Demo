import {earnedTutorial} from './check-meadow-fixtures209.ts';
import {farmHandler,farmDatabaseError,type Services} from '../supabase/functions/meadow-market-farm-actions/handler.ts';
const user='10000000-0000-4000-8000-000000000001',id='20000000-0000-4000-8000-000000000002',now=1793354400000;
const base={version:1,tutorial:earnedTutorial(),coins:250,level:1,xp:0,active:'willow',farms:{willow:{objects:[{id:'plot',type:'plot',x:4,y:3,stage:0}],inventory:{},shop:{unlocked:false,stock:{}}}}};
const body={request_id:id,expected_revision:5,commands:[{type:'plot.till',map:'willow',target:'plot'}]};
function assert(x:unknown,message='Assertion failed'):asserts x{if(!x)throw Error(message);}
const req=(value:unknown=body,authorization='Bearer player-token',origin='https://sponsorsorter.com')=>new Request('https://game.invalid',{method:'POST',headers:{authorization,origin},body:JSON.stringify(value)});
function fixture(context:Record<string,unknown>={ok:true,enabled:true,revision:5,server_time:now,save_data:base,owned_collections:[]}){
 const calls:{name:string;data:any}[]=[];
 const services:Services={identity:async()=>({id:user,is_anonymous:true}),rpc:async(name,data)=>{calls.push({name,data});return name==='meadow_market_read_farm_command'?context:{ok:true,revision:6,save_data:data.p_save_data};}};
 return {calls,services,handler:farmHandler(services)};
}
Deno.test('Command gateway derives owner from verified identity and clock/state from database',async()=>{
 const f=fixture(),r=await f.handler(req());assert(r.status===200);const answer=await r.json();assert(answer.save_data.farms.willow.objects[0].stage===1);
 assert(f.calls.length===2);const args=f.calls[1].data;assert(args.p_user===user&&args.p_request_id===id);assert(args.p_save_data.coins===250);assert(args.p_save_data.seen===now);assert(args.p_summary.rules.length===64);
});
Deno.test('Command gateway refuses callers, owner/snapshot/time injection and oversized bodies',async()=>{
 const f=fixture();assert((await f.handler(req(body,''))).status===401);
 for(const extra of [{user:'someone'},{save_data:{coins:999999}},{now:1},{expected_revision:1.5},{commands:[]},{pending_help:[]},{shared_landmarks:['garden']},{round_records:[{game:'eggs',level:999}]}])assert((await f.handler(req({...body,...extra}))).status===422);
 assert((await f.handler(req({padding:'x'.repeat(66000)}))).status===413);assert(f.calls.length===0);
 f.services.identity=async()=>null;assert((await f.handler(req())).status===401);
 assert((await f.handler(req(body,'Bearer token','https://wrong.invalid'))).status===403);
});
Deno.test('Only database-supplied visitor help reaches the candidate and atomic acknowledgment',async()=>{
 const save=JSON.parse(JSON.stringify(base));Object.assign(save.farms.willow.objects[0],{crop:'carrot',plantedAt:now-600000,stage:1});
 const help={id:'30000000-0000-4000-8000-000000000003',map_id:'willow',target_id:'plot',target_cycle:now-600000,action:'water'};
 const f=fixture({ok:true,enabled:true,revision:5,server_time:now,save_data:save,owned_collections:[],pending_help:[help]});
 const r=await f.handler(req({...body,commands:[{type:'plot.harvest',target:'plot'}]}));assert(r.status===200);assert(f.calls[1].data.p_save_data.farms.willow.inventory.carrot===4);assert(f.calls[1].data.p_summary.help[0].id===help.id&&f.calls[1].data.p_summary.help[0].outcome==='applied');
});
Deno.test('Market commands use the database proof and never a client supplied win, amount or price',async()=>{
 const save=JSON.parse(JSON.stringify(base));save.farms.willow.inventory.carrot=6;
 const proof={id:'40000000-0000-4000-8000-000000000004',map:'willow',game:'market_pack',goal:3,verified:true,won:true,expires_at:now+600000};
 const f=fixture({ok:true,enabled:true,revision:5,server_time:now,save_data:save,owned_collections:[],market_rounds:[proof]});
 const command={type:'market.sell',map:'willow',data:{round:proof.id,item:'carrot'}};const r=await f.handler(req({...body,commands:[command]}));assert(r.status===200);assert(f.calls[1].data.p_save_data.coins===286);assert(f.calls[1].data.p_summary.market_sales[0].id===proof.id);
 const fake=fixture();assert((await fake.handler(req({...body,commands:[command]}))).status===422);assert(fake.calls.length===1);
 assert((await fake.handler(req({...body,commands:[{...command,data:{...command.data,won:true,price:999}}]}))).status===422);
});
Deno.test('Command gateway returns replay/conflict/disabled state without rerunning a command',async()=>{
 for(const [context,status]of [[{ok:true,replayed:true,revision:9},200],[{ok:false,conflict:true,revision:9},409],[{ok:false,enabled:false},409]] as const){
  const f=fixture(context);const r=await f.handler(req());assert(r.status===status);assert(f.calls.length===1);
 }
});
Deno.test('Invalid reducer batches and unavailable services never commit or disclose internal errors',async()=>{
 const f=fixture();assert((await f.handler(req({...body,commands:[...body.commands,{type:'wallet.credit',data:{gold:99999}}]}))).status===422);assert(f.calls.length===1);
 f.services.rpc=async()=>{throw Error('private-secret-and-save-body');};const r=await f.handler(req());assert(r.status===503);assert(!(await r.text()).includes('private-secret'));
 f.services.rpc=async()=>{throw farmDatabaseError('22023');};const invalid=await f.handler(req());assert(invalid.status===422,'Permanent request errors must not become endless network retries');
});

Deno.test('New farms use only issued server baseline and cannot accept a supplied snapshot',async()=>{
 const f=fixture({ok:true,enabled:true,initializing:true,server_time:now,profile:{friend_code:'MEADOW-START',display_name:'Temporary starter'}});const request={request_id:id,expected_revision:0,commands:[{type:'farm.initialize'}]};const response=await f.handler(req(request));assert(response.status===200);const save=f.calls[1].data.p_save_data;assert(save.coins===250&&save.level===1&&save.farms.willow.objects.length===9);assert((await f.handler(req({...request,save_data:{coins:999999}}))).status===422);
});
