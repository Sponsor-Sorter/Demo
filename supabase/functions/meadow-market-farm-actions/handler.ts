import {applyFarmCommands,FarmActionError} from '../_shared/meadow-farm-actions204.ts';
type Data=Record<string,any>;
export type Services={identity:(bearer:string)=>Promise<Data|null>;rpc:(name:string,body:Data)=>Promise<Data>};
const uuid=(x:unknown)=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const origins=new Set(['https://sponsorsorter.com','https://localhost','http://localhost:8771']);
export function farmDatabaseError(code:unknown){return ['22023','22P02'].includes(String(code))?new FarmActionError('INVALID_REQUEST','Reopen your saved farm before retrying this action.'):new Error('FARM_UNAVAILABLE');}
async function read(req:Request){
 const reader=req.body?.getReader();if(!reader)throw new FarmActionError('INVALID_REQUEST','Choose a farm action.');
 const chunks:Uint8Array[]=[];let length=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>65536){await reader.cancel();throw new FarmActionError('REQUEST_TOO_LARGE','Too many farm actions.');}chunks.push(value);}}
 finally{reader.releaseLock();}
 const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new FarmActionError('INVALID_REQUEST','Choose a valid farm action.');}
}
export function farmHandler(services:Services){return async(req:Request)=>{
 const origin=req.headers.get('origin')||'',headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Origin':origins.has(origin)?origin:'https://sponsorsorter.com','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
 const reply=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers});
 if(origin&&!origins.has(origin))return reply(403,{error:'UNSUPPORTED_ORIGIN'});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply(405,{error:'POST_REQUIRED'});
 try{
  const bearer=(req.headers.get('authorization')||'').match(/^Bearer (\S+)$/i)?.[1];if(!bearer)return reply(401,{error:'SIGN_IN_REQUIRED'});
  const user=await services.identity(bearer);if(!uuid(user?.id))return reply(401,{error:'SIGN_IN_REQUIRED'});
  const body=await read(req);
  if(!body||Array.isArray(body)||typeof body!=='object'||Object.keys(body).some(k=>!['request_id','expected_revision','commands'].includes(k))||!uuid(body.request_id)||!Number.isSafeInteger(body.expected_revision)||body.expected_revision<0||!Array.isArray(body.commands)||!body.commands.length||body.commands.length>32)throw new FarmActionError('INVALID_REQUEST','Reopen the saved farm before trying again.');
  const args={p_user:user!.id,p_request_id:body.request_id,p_body:{expected_revision:body.expected_revision,commands:body.commands}};
  const context=await services.rpc('meadow_market_read_farm_command',args);
  if(context.enabled===false)return reply(409,{error:'COMMAND_ROLLOUT_PENDING'});
  if(context.replayed)return reply(200,context);
  if(context.conflict)return reply(409,context);
  if(!context.ok||!Number.isSafeInteger(context.server_time)||context.server_time<1||!context.save_data)throw Error('FARM_UNAVAILABLE');
  const applied=applyFarmCommands(context.save_data,body.commands,context.server_time,{ownedCollections:context.owned_collections||[],pendingHelp:context.pending_help||[],marketRounds:context.market_rounds||[]});
  const answer=await services.rpc('meadow_market_commit_farm_command',{...args,p_save_data:applied.save,p_summary:{results:applied.results,events:applied.events,help:applied.help,market_sales:applied.marketSales,messages:applied.messages,rules:applied.rules}});
  if(answer.enabled===false)return reply(409,{error:'COMMAND_ROLLOUT_PENDING'});
  return reply(answer.conflict?409:200,answer);
 }catch(error){
  if(error instanceof FarmActionError)return reply(error.code==='REQUEST_TOO_LARGE'?413:422,{error:error.code,message:error.message});
  // Never return/log credentials, snapshots, database errors or provider bodies.
  return reply(503,{error:'FARM_UNAVAILABLE',message:'Your farm could not confirm this action. Retry the same action when connected.'});
 }
};}
