'use strict';
require('../tools/littles-local/qa-network.cjs');
const assert=require('node:assert/strict'),http=require('node:http'),https=require('node:https'),net=require('node:net');
const {once}=require('node:events');
async function main(){
 const blocked=/LITTLES_QA_NETWORK_BLOCKED/;
 // Reserved invalid hosts only: all attempts must fail before DNS or a socket.
 for(const url of ['https://production.invalid/auth/v1/signup','http://localhost.production.invalid/','https://127.0.0.1.production.invalid/','https://user:password@localhost/'])await assert.rejects(fetch(url,{method:'POST',body:'{}'}),blocked);
 assert.throws(()=>http.request('http://production.invalid/auth/v1/signup'),blocked);
 assert.throws(()=>https.get('https://production.invalid/'),blocked);
 assert.throws(()=>http.request('http://127.0.0.1/',{hostname:'production.invalid'}),blocked);
 assert.throws(()=>http.request({host:'production.invalid',port:443}),blocked);
 const socket=new net.Socket();try{assert.throws(()=>socket.connect(443,'production.invalid'),blocked);}finally{socket.destroy();}
 assert.throws(()=>new WebSocket('wss://production.invalid/'),blocked);
 let requests=0;
 const fixture=http.createServer((req,res)=>{requests++;if(req.url==='/redirect'){res.writeHead(302,{Location:'https://production.invalid/auth/v1/signup'}).end();}else{res.writeHead(200,{'Content-Type':'application/json'}).end('{"local":true}');}});
 fixture.listen(0,'127.0.0.1');await once(fixture,'listening');
 const url='http://127.0.0.1:'+fixture.address().port;
 try{
  assert.deepEqual(await(await fetch(url+'/auth/v1/signup',{method:'POST',body:'{}'})).json(),{local:true});
  await new Promise((resolve,reject)=>http.get(url,r=>{r.resume();r.once('end',resolve);}).once('error',reject));
  await assert.rejects(fetch(url+'/redirect'));
  assert.equal(requests,3,'Only local controls and the first redirect response reached a fixture');
  console.log('Littles QA isolation: remote fetch, HTTP, HTTPS, raw sockets, WebSockets and redirects blocked; local fixtures work. No live services contacted.');
 }finally{await new Promise(resolve=>fixture.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
