const bytes=(s:string)=>new TextEncoder().encode(s);
const decode=(s:string)=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
// AdMob sends ASN.1 DER ECDSA; WebCrypto verifies fixed-width r || s.
export function signatureRaw(der:Uint8Array){
 let at=0;if(der[at++]!==0x30)throw Error('Invalid signature');const length=der[at++];if(length!==der.length-2||length>=128)throw Error('Invalid signature');
 const parts=[];
 for(let i=0;i<2;i++){if(der[at++]!==2)throw Error('Invalid signature');const n=der[at++];if(n<1||n>33||at+n>der.length)throw Error('Invalid signature');let part=der.slice(at,at+n);at+=n;if(part[0]===0)part=part.slice(1);if(part.length>32)throw Error('Invalid signature');const out=new Uint8Array(32);out.set(part,32-part.length);parts.push(out);}
 if(at!==der.length)throw Error('Invalid signature');const out=new Uint8Array(64);out.set(parts[0]);out.set(parts[1],32);return out;
}
let cached:{until:number,keys:Array<{keyId:number,pem:string}>}|null=null;
export async function verifyCallback(url:URL){
 const query=url.search.slice(1),cut=query.indexOf('&signature=');if(cut<1)throw Error('Missing signature');
 const signed=query.slice(0,cut),suffix=new URLSearchParams(query.slice(cut+1));
 if([...suffix.keys()].join(',')!=='signature,key_id')throw Error('Invalid signature parameters');
 const params=new URLSearchParams(signed);if(new Set(params.keys()).size!==[...params.keys()].length)throw Error('Duplicate parameters');
 if(!cached||cached.until<Date.now()){
  const response=await fetch('https://www.gstatic.com/admob/reward/verifier-keys.json',{signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('Key service unavailable');
  const value=await response.json();cached={until:Date.now()+3600000,keys:value.keys};
 }
 const key=cached.keys.find(k=>String(k.keyId)===suffix.get('key_id'));if(!key){cached=null;throw Error('Unknown key');}
 const der=decode(key.pem.replace(/-----[^-]+-----/g,'').replace(/\s/g,''));
 const publicKey=await crypto.subtle.importKey('spki',der,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
 if(!await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},publicKey,signatureRaw(decode(suffix.get('signature')||'')),bytes(signed)))throw Error('Invalid signature');
 return params;
}
