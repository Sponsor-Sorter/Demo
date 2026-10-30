import {farmHandler,farmDatabaseError} from './handler.ts';
const base=Deno.env.get('SUPABASE_URL')!,secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
async function call(path:string,body:unknown,bearer=secret){
 const response=await fetch(base+path,{method:body===undefined?'GET':'POST',signal:AbortSignal.timeout(12000),headers:{apikey:secret,Authorization:'Bearer '+bearer,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 if(path==='/auth/v1/user'&&(response.status===401||response.status===403))return null;
 const data=await response.json();if(!response.ok)throw farmDatabaseError(data?.code);return data;
}
Deno.serve(farmHandler({identity:bearer=>call('/auth/v1/user',undefined,bearer),rpc:(name,body)=>call('/rest/v1/rpc/'+name,body)}));
