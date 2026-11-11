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
 console.log('Littles commerce: signed proofs bind account/package/product; tampering, expiry, future issuance, invalid claims and overlong gift leases denied.');
}
check().catch(error=>{console.error(error);process.exitCode=1});
