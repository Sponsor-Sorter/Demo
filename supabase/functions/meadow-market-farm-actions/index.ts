import {farmHandler,farmDatabaseError} from './handler.ts';
const base=Deno.env.get('SUPABASE_URL')!,secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const controlledRoutes:Record<string,string>={meadow_market_read_farm_command:'meadow_market_control_read_command',meadow_market_commit_farm_command:'meadow_market_control_commit_command'};
async function call(path:string,body:unknown,bearer=secret){
 const response=await fetch(base+path,{method:body===undefined?'GET':'POST',signal:AbortSignal.timeout(12000),headers:{apikey:secret,Authorization:'Bearer '+bearer,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 if(path==='/auth/v1/user'&&(response.status===401||response.status===403))return null;
 const data=await response.json();if(!response.ok)throw farmDatabaseError(data?.code,data?.message);return data;
}
Deno.serve(farmHandler({requireSession:true,
 identity:bearer=>call('/rest/v1/rpc/meadow_market_control_session',{},bearer),
 rpc:(name,body)=>call('/rest/v1/rpc/'+(controlledRoutes[name]||name),body),
 event:(user,id,code)=>call('/rest/v1/rpc/meadow_market_control_event',{p_user:user,p_event:id,p_code:code})
}));
