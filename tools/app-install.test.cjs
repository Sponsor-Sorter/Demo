const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const script=fs.readFileSync('js/appInstall.js','utf8');
test('shared navigation list wrappers fill their grid cells',()=>{
 const css=fs.readFileSync('connection-header.css','utf8');
 assert.match(css,/\.header\.connection-header > nav > li\s*\{[^}]*width:\s*100%;[^}]*max-width:\s*none;/);
 const html=fs.readFileSync('install.html','utf8');
 assert.doesNotMatch(html,/>Logout<\/a>/);
 assert.match(html,/Why does Android show an installation warning/);
});
test('worker revalidates navigation and removes only obsolete Sponsor Sorter caches',async()=>{
 const events={},deleted=[],requests=[];
 const context={URL,Response,self:{location:{origin:'https://sponsorsorter.com'},addEventListener:(name,fn)=>events[name]=fn,clients:{claim:async()=>{}},skipWaiting:async()=>{}},caches:{keys:async()=>['sponsorsorter-offline-v1','sponsorsorter-offline-v2','another-app-cache'],delete:async key=>deleted.push(key)},fetch:async(request,options)=>{requests.push(options);return new Response('fresh');}};
 vm.runInNewContext(fs.readFileSync('service-worker.js','utf8'),context);
 let activation;events.activate({waitUntil:p=>activation=p});await activation;
 assert.deepEqual(deleted,['sponsorsorter-offline-v1']);
 let navigation;events.fetch({request:{method:'GET',mode:'navigate',url:'https://sponsorsorter.com/index.html'},respondWith:p=>navigation=p});
 assert.equal(await (await navigation).text(),'fresh');assert.equal(requests[0].cache,'no-cache');
});
test('Android guide publishes the verified signed APK and truthful update instructions',()=>{
 const release=JSON.parse(fs.readFileSync('app-assets/android-release.json','utf8'));
 const page=fs.readFileSync('install.html','utf8');
 assert.equal(release.package,'com.sponsorsorter.app');assert.equal(release.versionCode,5);
 assert.match(release.apkUrl,/^https:\/\/expo\.dev\/artifacts\/eas\/[A-Za-z0-9_-]+\.apk$/);
 assert.ok(page.includes('href="'+release.apkUrl+'"'));assert.ok(page.includes(release.sha256));assert.ok(page.includes(release.signingCertificateSha256));
 assert.match(page,/next full launch/);assert.match(page,/Android asks you to confirm/);assert.match(page,/Keep Google Play Protect enabled/);
 assert.doesNotMatch(page,/Native App Store and Google Play downloads are not available here yet/);
});
function fixture(standalone=false){const events={},button={disabled:true,textContent:'',addEventListener(name,fn){this[name]=fn}},status={textContent:''};let registered;
 vm.runInNewContext(script,{document:{getElementById:id=>id==='install-app-button'?button:status},window:{matchMedia:()=>({matches:standalone}),addEventListener:(n,f)=>events[n]=f},navigator:{serviceWorker:{register:(url,options)=>{registered={url,options};return Promise.resolve();}}},location:{protocol:'https:',hostname:'sponsorsorter.com'}});return {events,button,status,registered};}
test('installation registration uses root scope and the published manifest uses local assets',()=>{const f=fixture();assert.equal(f.registered.url,'/service-worker.js');assert.equal(f.registered.options.scope,'/');const m=JSON.parse(fs.readFileSync('manifest.webmanifest'));assert.equal(m.display,'standalone');assert.equal(m.scope,'/');for(const icon of m.icons)assert.ok(fs.existsSync('.'+icon.src));const png=fs.readFileSync('app-assets/icon-512.png');assert.equal(png.readUInt32BE(16),512);assert.equal(png.readUInt32BE(20),512);});
test('install action is offered only after a browser prompt and cancellation is handled',async()=>{const f=fixture();assert.equal(f.button.disabled,true);let prompted=0,prevented=0;f.events.beforeinstallprompt({preventDefault(){prevented++},prompt:async()=>{prompted++},userChoice:Promise.resolve({outcome:'dismissed'})});assert.equal(f.button.disabled,false);await f.button.click();assert.equal(prompted,1);assert.equal(prevented,1);assert.match(f.status.textContent,/cancelled/);await f.button.click();assert.equal(prompted,1);});
test('standalone app never prompts to reinstall',()=>{const f=fixture(true);assert.equal(f.button.disabled,true);assert.match(f.status.textContent,/already/);let prevented=false;f.events.beforeinstallprompt({preventDefault(){prevented=true}});assert.equal(prevented,false);});
test('all published HTML pages with footers include a working install link',()=>{
 const path=require('node:path'),cp=require('node:child_process');
 const pages=cp.execFileSync('git',['ls-files','*.html'],{encoding:'utf8'}).trim().split(/\r?\n/).filter(p=>!p.startsWith('tools/')&&!p.startsWith('app-assets/')&&p!=='link.html');
 for(const page of pages){const html=fs.readFileSync(page,'utf8'),footer=html.match(/<footer\b[\s\S]*?<\/footer>/i);assert.ok(footer,page);const link=footer[0].match(/href=["']([^"']*install\.html)["']/);assert.ok(link,page);assert.equal(path.resolve(path.dirname(page),link[1]),path.resolve('install.html'),page);}
});
test('updates check on launch, resume and reconnect without forcing reloads',async()=>{
 const events={},documentEvents={};let checks=0,now=100000,options;
 const document={visibilityState:'visible',getElementById:()=>null,addEventListener:(n,f)=>documentEvents[n]=f};
 const navigator={onLine:true,serviceWorker:{register:async(_url,o)=>{options=o;return {update:async()=>{checks++;}}}}};
 vm.runInNewContext(script,{document,navigator,Date:{now:()=>now},location:{protocol:'https:',hostname:'sponsorsorter.com'},window:{matchMedia:()=>({matches:true}),addEventListener:(n,f)=>events[n]=f}});
 await Promise.resolve();await Promise.resolve();assert.equal(checks,1);assert.equal(options.updateViaCache,'none');
 events.online();assert.equal(checks,1);
 now+=60001;document.visibilityState='hidden';documentEvents.visibilitychange();assert.equal(checks,1);
 document.visibilityState='visible';documentEvents.visibilitychange();assert.equal(checks,2);
 now+=60001;navigator.onLine=false;events.online();assert.equal(checks,2);
 navigator.onLine=true;events.online();assert.equal(checks,3);
 assert.doesNotMatch(script,/location\.reload|controllerchange/);
});
test('service worker caches only the public offline page and never APIs or account pages',async()=>{const events={},added=[],intercepted=[];const context={URL,Response,self:{location:{origin:'https://sponsorsorter.com'},addEventListener:(n,f)=>events[n]=f,skipWaiting:async()=>{},clients:{claim:async()=>{}}},caches:{open:async()=>({add:async path=>added.push(path)}),keys:async()=>[],match:async()=>new Response('offline')},fetch:async()=>{throw Error('offline')}};vm.runInNewContext(fs.readFileSync('service-worker.js','utf8'),context);let installed;events.install({waitUntil:p=>installed=p});await installed;assert.deepEqual(added,['/app-assets/offline.html']);for(const request of [{method:'POST',mode:'navigate',url:'https://sponsorsorter.com/login.html'},{method:'GET',mode:'cors',url:'https://mqixtrnhotqqybaghgny.supabase.co/rest/v1/private_offers'},{method:'GET',mode:'navigate',url:'https://checkout.stripe.com/pay/fixture'}])events.fetch({request,respondWith:p=>intercepted.push(p)});assert.equal(intercepted.length,0);events.fetch({request:{method:'GET',mode:'navigate',url:'https://sponsorsorter.com/settings.html'},respondWith:p=>intercepted.push(p)});assert.equal(await (await intercepted[0]).text(),'offline');});
