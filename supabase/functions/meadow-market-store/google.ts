// Google credentials remain in Edge secrets, never in a game bundle.
const PACKAGE='com.meadowandmarket.game';
let cached:{token:string,until:number}|null=null;
const bytes=(s:string)=>new TextEncoder().encode(s);
const b64=(b:Uint8Array)=>btoa(String.fromCharCode(...b)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
export const sha=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes(s)))).map(x=>x.toString(16).padStart(2,'0')).join('');
async function token(){
 if(cached&&cached.until>Date.now())return cached.token;
 const raw=Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT');if(!raw)throw Error('STORE_NOT_CONFIGURED');
 const service=JSON.parse(raw);const now=Math.floor(Date.now()/1000);
 const header=b64(bytes(JSON.stringify({alg:'RS256',typ:'JWT'})));
 const body=b64(bytes(JSON.stringify({iss:service.client_email,scope:'https://www.googleapis.com/auth/androidpublisher',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600})));
 const der=Uint8Array.from(atob(service.private_key.replace(/-----[^-]+-----/g,'').replace(/\s/g,'')),c=>c.charCodeAt(0));
 const key=await crypto.subtle.importKey('pkcs8',der,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
 const jwt=header+'.'+body+'.'+b64(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,bytes(header+'.'+body))));
 const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',signal:AbortSignal.timeout(12000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:jwt})});
 if(!r.ok)throw Error('STORE_AUTH_UNAVAILABLE');const result=await r.json();
 cached={token:result.access_token,until:Date.now()+Math.min(Number(result.expires_in)||3600,3600)*1000-60000};return cached.token;
}
export async function googlePurchase(product:string,purchaseToken:string){
 const r=await fetch('https://androidpublisher.googleapis.com/androidpublisher/v3/applications/'+PACKAGE+'/purchases/products/'+encodeURIComponent(product)+'/tokens/'+encodeURIComponent(purchaseToken),{signal:AbortSignal.timeout(12000),headers:{Authorization:'Bearer '+await token()}});
 if(!r.ok)throw Error('PURCHASE_NOT_VERIFIED');return r.json();
}
export async function settle(product:string,purchaseToken:string,consumable:boolean){
 const r=await fetch('https://androidpublisher.googleapis.com/androidpublisher/v3/applications/'+PACKAGE+'/purchases/products/'+encodeURIComponent(product)+'/tokens/'+encodeURIComponent(purchaseToken)+(consumable?':consume':':acknowledge'),{method:'POST',signal:AbortSignal.timeout(12000),headers:{Authorization:'Bearer '+await token(),'Content-Type':'application/json'},body:consumable?undefined:'{}'});
 if(!r.ok)throw Error('SETTLEMENT_PENDING');
}
