const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict');
async function check(){
 const pair=crypto.generateKeyPairSync('rsa',{modulusLength:2048}),user='11111111-1111-4111-8111-111111111111';
 const config={contract:'littles-play-v1',package:'com.meadowmarket.littles',product:'ml_plus',proofKey:pair.publicKey.export({format:'jwk'})};
 const window={meadowLittlesCommerceConfig:config,meadowLittlesAccess:{configure(){}}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../meadow-market-littles/commerce.js'),'utf8'),{window,crypto:crypto.webcrypto,TextDecoder,TextEncoder,Uint8Array,atob,Date,Number,Promise,WeakMap});
 const now=Math.floor(Date.now()/1000),base={iss:config.contract,aud:config.package,sub:user,product:config.product,iat:now,exp:now+3600,paid:true,complimentary:false};
 const sign=claims=>{const data=Buffer.from(JSON.stringify({alg:'RS256'})).toString('base64url')+'.'+Buffer.from(JSON.stringify(claims)).toString('base64url');return data+'.'+crypto.sign('RSA-SHA256',Buffer.from(data),pair.privateKey).toString('base64url');};
 const valid=claims=>window.meadowLittlesCommerce.validProof(sign({...base,...claims}),user);
 assert(await valid({}));assert(await valid({paid:false,complimentary:true,exp:now+300}));
 for(const claims of [{sub:'other-user'},{aud:'com.meadowandmarket.game'},{product:'mm_premium'},{exp:now-1},{iat:now+60},{exp:now+86401},{paid:'true'},{paid:false,complimentary:false},{paid:false,complimentary:true,exp:now+301},{iat:now,exp:now}])assert.equal(await valid(claims),false,JSON.stringify(claims));
 const proof=sign(base),parts=proof.split('.');parts[1]=Buffer.from(JSON.stringify({...base,exp:now+7200})).toString('base64url');assert.equal(await window.meadowLittlesCommerce.validProof(parts.join('.'),user),false);
 assert.equal(await window.meadowLittlesCommerce.validProof('malformed',user),false);
 const controller=async(data,answer)=>{
  const storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
  const env={localStorage:storage,crypto:crypto.webcrypto,TextDecoder,TextEncoder,Uint8Array,atob,setInterval(){},MutationObserver:class{observe(){}},document:{body:{style:{}},querySelector(){return null},addEventListener(){}},meadowLittlesCommerceConfig:config,meadowLittlesCloud:{getStatus:()=>({userId:user}),commerce:async()=>{if(!answer)throw Error('Offline');return {contract:config.contract,user_id:user,parent_ready:true,proof:null,...answer};}}};env.window=env;
  const context=vm.createContext(env);for(const file of ['play-access.js','commerce.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../meadow-market-littles/'+file),'utf8'),context);
  await env.meadowLittlesCommerce.init();return env.meadowLittlesAccess;
 };
 const ledger=new Map();let access=await controller(ledger,{checkout_enabled:true,checkout_test_only:false});
 for(let i=0;i<5;i++){assert(access.begin('memory'));assert(access.complete('memory'));}
 access=await controller(ledger,null);assert.equal(access.remaining('memory'),0,'A restarted offline app keeps the last confirmed public allowance');
 await controller(ledger,{checkout_enabled:false,checkout_test_only:false});access=await controller(ledger,null);assert.equal(access.remaining('memory'),Infinity,'A confirmed public rollback remains available offline');
 const privateLedger=new Map();await controller(privateLedger,{checkout_enabled:true,checkout_test_only:true});access=await controller(privateLedger,null);assert.equal(access.getStatus().enabled,false,'Private provider acceptance cannot persist a public rollout policy');
 console.log('Littles commerce: signed proofs bind account/package/product; tampering, expiry, future issuance, invalid claims and overlong gift leases denied.');
 console.log('Littles rollout policy: free allowance survives offline restart; confirmed rollback persists; private tests do not enable public limits.');
}
check().catch(error=>{console.error(error);process.exitCode=1});
