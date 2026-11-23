// Preserve the upstream HTTP result even when a proxy returns HTML/plain text.
// An untyped response can never supply player evidence or change retry status.
export function rewardRpcTransport(base:string,secret:string,fetcher:typeof fetch=fetch){return async(name:string,body:Record<string,unknown>,signal=AbortSignal.timeout(12000))=>{
 const response=await fetcher(base+'/rest/v1/rpc/'+name,{method:'POST',signal,headers:{apikey:secret,Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:JSON.stringify(body)});
 return {response,value:await response.json().catch(()=>null)};
};}
