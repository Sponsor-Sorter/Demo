import {createFarmBaseline} from '../_shared/meadow-farm-origin212.ts';
import {applyFarmCommands,FarmActionError} from '../_shared/meadow-farm-actions204.ts';
type Data=Record<string,any>;
export type Services={identity:(bearer:string)=>Promise<Data|null>;rpc:(name:string,body:Data)=>Promise<Data>;requireSession?:boolean;event?:(user:string,id:string,code:string)=>Promise<unknown>};
const uuid=(x:unknown)=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const origins=new Set(['https://sponsorsorter.com','https://localhost','http://localhost:8771','http://127.0.0.1:8773']);
export function farmDatabaseError(code:unknown,message:unknown=''){
 if(String(code)==='28000')return new FarmActionError('SESSION_EXPIRED','Sign in again to reconnect this farm.');
 if(['MEADOW_BANNED','MEADOW_SOCIAL_RESTRICTED','MEADOW_MAINTENANCE'].includes(String(message)))return new FarmActionError(String(message),'Open Settings → Community & blocked farms to review this notice. Your saved farm is retained.');
 return ['22023','22P02'].includes(String(code))?new FarmActionError('INVALID_REQUEST','Reopen your saved farm before retrying this action.'):new Error('FARM_UNAVAILABLE');
}
async function read(req:Request){
 const reader=req.body?.getReader();if(!reader)throw new FarmActionError('INVALID_REQUEST','Choose a farm action.');
 const chunks:Uint8Array[]=[];let length=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>65536){await reader.cancel();throw new FarmActionError('REQUEST_TOO_LARGE','Too many farm actions.');}chunks.push(value);}}
 finally{reader.releaseLock();}
 const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new FarmActionError('INVALID_REQUEST','Choose a valid farm action.');}
}
export function farmHandler(services:Services){return async(req:Request)=>{
 let actor='',requestId='';
 const origin=req.headers.get('origin')||'',headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Origin':origins.has(origin)?origin:'https://sponsorsorter.com','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
 const reply=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers});
 if(origin&&!origins.has(origin))return reply(403,{error:'UNSUPPORTED_ORIGIN'});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply(405,{error:'POST_REQUIRED'});
 try{
  const bearer=(req.headers.get('authorization')||'').match(/^Bearer (\S+)$/i)?.[1];if(!bearer)return reply(401,{error:'SIGN_IN_REQUIRED'});
  const user=await services.identity(bearer);if(!uuid(user?.id)||(services.requireSession&&!uuid(user?.session_id)))return reply(401,{error:'SIGN_IN_REQUIRED'});actor=user!.id;
  const body=await read(req);
  if(!body||Array.isArray(body)||typeof body!=='object'||Object.keys(body).some(k=>!['request_id','expected_revision','commands'].includes(k))||!uuid(body.request_id)||!Number.isSafeInteger(body.expected_revision)||body.expected_revision<0||!Array.isArray(body.commands)||!body.commands.length||body.commands.length>32)throw new FarmActionError('INVALID_REQUEST','Reopen the saved farm before trying again.');
  requestId=body.request_id;
  const args={p_user:user!.id,...(services.requireSession?{p_session:user!.session_id}:{}),p_request_id:body.request_id,p_body:{expected_revision:body.expected_revision,commands:body.commands}};
  const context=await services.rpc('meadow_market_read_farm_command',args);
  if(context.enabled===false)return reply(409,{error:'COMMAND_ROLLOUT_PENDING'});
  if(context.replayed)return reply(200,context);
  if(context.conflict)return reply(409,context);
  if(!context.ok||!Number.isSafeInteger(context.server_time)||context.server_time<1||(!context.initializing&&!context.save_data))throw Error('FARM_UNAVAILABLE');
  if(context.initializing&&(body.expected_revision!==0||JSON.stringify(body.commands)!=='[{"type":"farm.initialize"}]'))throw Error('FARM_UNAVAILABLE');
  const applied=context.initializing?createFarmBaseline(context.server_time,context.profile):applyFarmCommands(context.save_data,body.commands,context.server_time,{ownedCollections:context.owned_collections||[],packGrants:context.pack_grants||[],pendingHelp:context.pending_help||[],marketRounds:context.market_rounds||[],roundRecords:context.round_records||[],sharedLandmarks:context.shared_landmarks||[],visitedFriend:context.visited_friend===true});
  const answer=await services.rpc('meadow_market_commit_farm_command',{...args,p_save_data:applied.save,p_summary:{results:applied.results,events:applied.events,help:applied.help,market_sales:applied.marketSales,messages:applied.messages,rules:applied.rules}});
  if(answer.enabled===false)return reply(409,{error:'COMMAND_ROLLOUT_PENDING'});
  return reply(answer.conflict?409:200,answer);
 }catch(error){
  if(error instanceof FarmActionError){
   if(actor&&requestId&&error.code.startsWith('MEADOW_'))try{await services.event?.(actor,requestId,error.code)}catch{/* Telemetry cannot change action outcome. */}
   return reply(error.code==='SESSION_EXPIRED'?401:error.code.startsWith('MEADOW_')?403:error.code==='REQUEST_TOO_LARGE'?413:422,{error:error.code,message:error.message});
  }
  // Never return/log credentials, snapshots, database errors or provider bodies.
  return reply(503,{error:'FARM_UNAVAILABLE',message:'Your farm could not confirm this action. Retry the same action when connected.'});
 }
};}
