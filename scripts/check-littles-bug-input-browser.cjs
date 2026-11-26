'use strict';
// Isolated real-DOM input scenarios; no production services, saved account or phone.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),net=require('node:net');
const repo=path.resolve(__dirname,'..'),chrome=process.env.CHROME_BIN||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':'google-chrome');
const work=fs.mkdtempSync(path.join(os.tmpdir(),'littles-input100-')),profile=path.join(work,'profile'),html=path.join(work,'dom.html');let server,browser,socket,send;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function main(){
 await new Promise((resolve,reject)=>{const probe=net.createServer();probe.once('error',reject);probe.listen(4399,'127.0.0.1',()=>probe.close(resolve));});
 server=cp.spawn(process.execPath,[path.join(repo,'tools/littles-local/serve-bug-picnic.cjs')],{windowsHide:true,stdio:['ignore','pipe','pipe']});
 for(let i=0;i<50;i++){try{const r=await fetch('http://127.0.0.1:4399/qa/bug-input100');if(r.ok)break;}catch{}await delay(100);if(i===49)throw Error('Owned fixture server did not start');}
 let stderr='';browser=cp.spawn(chrome,['--headless=new','--no-first-run','--no-default-browser-check','--disable-extensions','--disable-background-timer-throttling','--disable-renderer-backgrounding','--user-data-dir='+profile,'--window-size=1024,820','--remote-debugging-port=0','http://127.0.0.1:4399/qa/bug-input100'],{windowsHide:true,stdio:['ignore','ignore','pipe']});browser.stderr.on('data',b=>{stderr=(stderr+b).slice(-1e6);});
 let port;for(let i=0;i<150;i++){port=/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//.exec(stderr)?.[1];if(port)break;if(browser.exitCode!==null)throw Error('Owned Chrome exited early');await delay(100);}if(!port)throw Error('Owned Chrome debugging endpoint unavailable');
 let page;for(let i=0;i<100;i++){page=(await(await fetch('http://127.0.0.1:'+port+'/json/list')).json()).find(p=>p.type==='page'&&p.url.startsWith('http://127.0.0.1:4399/qa/bug-input100'));if(page)break;await delay(100);}if(!page||!page.webSocketDebuggerUrl.startsWith('ws://127.0.0.1:'+port+'/'))throw Error('Owned local test target unavailable');
 socket=new WebSocket(page.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});let serial=0;const pending=new Map();
 socket.addEventListener('message',event=>{const packet=JSON.parse(event.data),job=pending.get(packet.id);if(!job)return;pending.delete(packet.id);clearTimeout(job.timer);packet.error?job.reject(Error(packet.error.message)):job.resolve(packet.result);});
 send=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial,timer=setTimeout(()=>{pending.delete(id);reject(Error('Local browser command timed out'));},5000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});
 let result;for(let i=0;i<160;i++){const read=await send('Runtime.evaluate',{expression:"document.querySelector('#qa-input-results')?.textContent||''",returnByValue:true});const text=read.result?.value||'';if(text.startsWith('{')){result=JSON.parse(text);if(result.complete)break;}await delay(250);}
 const dump=await send('Runtime.evaluate',{expression:'document.documentElement.outerHTML',returnByValue:true});fs.writeFileSync(html,dump.result?.value||'');fs.writeFileSync(path.join(work,'browser.log'),stderr);if(!result?.complete)throw Error('DOM scenarios did not finish; see '+html);
 if(!result.complete||!result.pass)throw Error(JSON.stringify({...result,artifact:html}));
 const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(work,'desktop.png'),Buffer.from(shot.data,'base64'));
 console.log(JSON.stringify({...result,artifact:html,screenshot:path.join(work,'desktop.png'),profileIsolated:true,realAccount:false,phone:false}));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(async()=>{if(send&&socket?.readyState===1){try{await send('Browser.close');}catch{}socket.close();}if(browser&&browser.exitCode===null){await delay(500);if(browser.exitCode===null){const ended=new Promise(r=>browser.once('exit',r));browser.kill();await ended;}}if(server&&server.exitCode===null){const ended=new Promise(r=>server.once('exit',r));server.kill();await ended;}});
