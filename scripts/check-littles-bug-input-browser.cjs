'use strict';
require('../tools/littles-local/qa-network.cjs');
// Isolated real-DOM input scenarios; no production services, saved account or phone.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),net=require('node:net'),http=require('node:http'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'..'),chrome=process.env.CHROME_BIN||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':'google-chrome');
const work=fs.mkdtempSync(path.join(os.tmpdir(),'littles-input100-')),profile=path.join(work,'profile'),html=path.join(work,'dom.html');let server,browser,socket,send;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function main(){
 await new Promise((resolve,reject)=>{const probe=net.createServer();probe.once('error',reject);probe.listen(4399,'127.0.0.1',()=>probe.close(resolve));});
 server=cp.spawn(process.execPath,[path.join(repo,'tools/littles-local/serve-bug-picnic.cjs')],{windowsHide:true,stdio:['ignore','pipe','pipe']});
 for(let i=0;i<50;i++){try{const r=await fetch('http://127.0.0.1:4399/qa/bug-input100');if(r.ok)break;}catch{}await delay(100);if(i===49)throw Error('Owned fixture server did not start');}
 for(const entry of ['/','/qa/bug-input100','/not-a-file','/%ZZ']){
  const response=await fetch('http://127.0.0.1:4399'+entry);
  assert.equal(response.headers.get('content-security-policy'),"connect-src 'self'; form-action 'self'",'QA isolation applies to full app, fixtures and errors');
  await response.arrayBuffer();
 }
 let stderr='';browser=cp.spawn(chrome,['--headless=new','--no-first-run','--no-default-browser-check','--disable-extensions','--disable-background-timer-throttling','--disable-renderer-backgrounding','--user-data-dir='+profile,'--window-size=1024,820','--remote-debugging-port=0','http://127.0.0.1:4399/qa/network-isolation'],{windowsHide:true,stdio:['ignore','ignore','pipe']});browser.stderr.on('data',b=>{stderr=(stderr+b).slice(-1e6);});
 let port;for(let i=0;i<150;i++){port=/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//.exec(stderr)?.[1];if(port)break;if(browser.exitCode!==null)throw Error('Owned Chrome exited early');await delay(100);}if(!port)throw Error('Owned Chrome debugging endpoint unavailable');
 let page;for(let i=0;i<100;i++){page=(await(await fetch('http://127.0.0.1:'+port+'/json/list')).json()).find(p=>p.type==='page'&&p.url.startsWith('http://127.0.0.1:4399/qa/network-isolation'));if(page)break;await delay(100);}if(!page||!page.webSocketDebuggerUrl.startsWith('ws://127.0.0.1:'+port+'/'))throw Error('Owned local test target unavailable');
 socket=new WebSocket(page.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});let serial=0;const pending=new Map();
 socket.addEventListener('message',event=>{const packet=JSON.parse(event.data),job=pending.get(packet.id);if(!job)return;pending.delete(packet.id);clearTimeout(job.timer);packet.error?job.reject(Error(packet.error.message)):job.resolve(packet.result);});
 send=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial,timer=setTimeout(()=>{pending.delete(id);reject(Error('Local browser command timed out: '+method));},5000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});
 await send('Runtime.enable');
 async function waitForPage(url){
  let state;
  for(let i=0;i<200;i++){
   try{const read=await send('Runtime.evaluate',{expression:'JSON.stringify({url:location.href,ready:document.readyState})',returnByValue:true});state=JSON.parse(read.result?.value||'{}');if(state.url===url&&state.ready==='complete')return;}
   catch(error){if(!/context|navigat/i.test(error.message))throw error;}
   await delay(100);
  }
  throw Error('Owned QA page did not finish navigating: '+JSON.stringify(state));
 }
 await waitForPage('http://127.0.0.1:4399/qa/network-isolation');
 let fixtureRequests=0;
 const fakeAuth=http.createServer((req,res)=>{fixtureRequests++;req.resume();res.writeHead(200,{'Access-Control-Allow-Origin':'*','Content-Type':'application/json'}).end('{"fake":true}');});
 await new Promise(resolve=>fakeAuth.listen(0,'127.0.0.1',resolve));
 try{
  const fakeUrl='http://127.0.0.1:'+fakeAuth.address().port+'/auth/v1/signup';
  await(await fetch(fakeUrl,{method:'POST',body:'{}'})).arrayBuffer();
  assert.equal(fixtureRequests,1,'Local fake auth endpoint is reachable by control');fixtureRequests=0;
  await send('Runtime.evaluate',{expression:`window.qaAuthBlocked=null;fetch(${JSON.stringify(fakeUrl)},{method:'POST',body:'{}'}).then(()=>window.qaAuthBlocked=false,()=>window.qaAuthBlocked=true);true`,returnByValue:true});
  let blocked;for(let i=0;i<40;i++){const attempt=await send('Runtime.evaluate',{expression:'window.qaAuthBlocked',returnByValue:true});blocked=attempt.result?.value;if(typeof blocked==='boolean')break;await delay(50);}
  if(blocked!==true){const diagnostic=await send('Runtime.evaluate',{expression:'JSON.stringify({url:location.href,fetch:String(fetch),state:document.readyState})',returnByValue:true});throw Error('CSP fixture did not reject signup: '+JSON.stringify({blocked,fixtureRequests,page:diagnostic.result?.value}));}
  await delay(100);assert.equal(fixtureRequests,0,'No OPTIONS or signup request escaped the QA page');
 }finally{await new Promise(resolve=>fakeAuth.close(resolve));}
 await send('Page.navigate',{url:'http://127.0.0.1:4399/qa/bug-input100'});await waitForPage('http://127.0.0.1:4399/qa/bug-input100');
 let result;for(let i=0;i<160;i++){const read=await send('Runtime.evaluate',{expression:"document.querySelector('#qa-input-results')?.textContent||''",returnByValue:true});const text=read.result?.value||'';if(text.startsWith('{')){result=JSON.parse(text);if(result.complete)break;}await delay(250);}
 const dump=await send('Runtime.evaluate',{expression:'document.documentElement.outerHTML',returnByValue:true});fs.writeFileSync(html,dump.result?.value||'');fs.writeFileSync(path.join(work,'browser.log'),stderr);if(!result?.complete)throw Error('DOM scenarios did not finish; see '+html);
 if(!result.complete||!result.pass)throw Error(JSON.stringify({...result,artifact:html}));
 const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(work,'desktop.png'),Buffer.from(shot.data,'base64'));
 console.log(JSON.stringify({...result,artifact:html,screenshot:path.join(work,'desktop.png'),profileIsolated:true,realAccount:false,phone:false,cspAuthBlocked:true,fakeAuthRequests:0}));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(async()=>{if(send&&socket?.readyState===1){try{await send('Browser.close');}catch{}socket.close();}if(browser&&browser.exitCode===null){await delay(500);if(browser.exitCode===null){const ended=new Promise(r=>browser.once('exit',r));browser.kill();await ended;}}if(server&&server.exitCode===null){const ended=new Promise(r=>server.once('exit',r));server.kill();await ended;}});
