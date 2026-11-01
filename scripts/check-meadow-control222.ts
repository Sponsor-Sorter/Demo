import {farmHandler,farmDatabaseError,type Services} from '../supabase/functions/meadow-market-farm-actions/handler.ts';
const user='10000000-0000-4000-8000-000000000001',session='10000000-0000-4000-8000-000000000002',request='10000000-0000-4000-8000-000000000003';
const assert=(x:unknown)=>{if(!x)throw Error('Control assertion failed')};
const req=(extra={})=>new Request('https://game.invalid',{method:'POST',headers:{authorization:'Bearer signed-token',origin:'https://sponsorsorter.com'},body:JSON.stringify({request_id:request,expected_revision:1,commands:[{type:'workers.tick'}],...extra})});
Deno.test('Controlled gateway binds the live session and refuses actor/session fields',async()=>{
 const calls:any[]=[],services:Services={requireSession:true,identity:async()=>({id:user,session_id:session}),rpc:async(name,data)=>{calls.push({name,data});return {ok:true,replayed:true,revision:2}}};
 const handler=farmHandler(services);assert((await handler(req())).status===200);assert(calls[0].data.p_user===user&&calls[0].data.p_session===session);
 for(const fields of [{actor:'spoof'},{app:'littles'},{session_id:session},{p_session:session}])assert((await handler(req(fields))).status===422);
 services.identity=async()=>({id:user});assert((await handler(req())).status===401);
 services.identity=async()=>{throw farmDatabaseError('28000')};assert((await handler(req())).status===401);
});
Deno.test('Moderation and maintenance failures are bounded and create no candidate mutation',async()=>{
 for(const code of ['MEADOW_BANNED','MEADOW_SOCIAL_RESTRICTED','MEADOW_MAINTENANCE']){
  const events:any[]=[],services:Services={requireSession:true,identity:async()=>({id:user,session_id:session}),rpc:async()=>{throw farmDatabaseError('42501',code)},event:async(...args)=>events.push(args)};
  const response=await farmHandler(services)(req());assert(response.status===403);assert(events.length===1&&events[0][0]===user&&events[0][1]===request&&events[0][2]===code);const data=await response.json();assert(data.error===code&&!JSON.stringify(data).includes('signed-token'));
 }
});
