// Session storage, reconnects and account-name changes across isolated app restarts.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../meadow-market-littles/littles-cloud.js'),'utf8');
const authKey='meadow-littles-auth-v1',rememberedKey='meadow-littles-account-v1';
const storage=()=>{const data=new Map();return {data,getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)}};
const rows=new Map(),calls=[];
function row(id){if(!rows.has(id))rows.set(id,{name:'Little Farmer',revision:0,data:{schema:1,stars:0}});return rows.get(id)}
function document(){class Element{constructor(tag){this.tag=tag;this.children=[];this.style={}}append(...nodes){for(const n of nodes){n.parent=this;this.children.push(n)}}replaceChildren(...nodes){this.children=[];this.append(...nodes)}setAttribute(){}addEventListener(){}focus(){}showModal(){this.open=true}close(){this.open=false}remove(){this.parent.children=this.parent.children.filter(n=>n!==this)}}return {body:new Element('body'),createElement:t=>new Element(t),addEventListener(){}}}
const all=e=>[e,...e.children.flatMap(all)];
function app(store,network={online:true}){
 const events={},tasks=[],dom=document();let listener,authOptions,identity=null,insideAuthCallback=false,applied=0;
 const context={document:dom,URL,location:{pathname:'/meadow-market-littles/',origin:'https://sponsorsorter.com'},localStorage:store,crypto:{randomUUID:()=>crypto.randomUUID()},setTimeout:f=>{tasks.push(f);return f},clearTimeout:f=>{const i=tasks.indexOf(f);if(i>=0)tasks.splice(i,1)},addEventListener:(n,f)=>events[n]=f};context.globalThis=context;
 function emit(event){insideAuthCallback=true;listener?.(event,{user:identity});insideAuthCallback=false}
 function session(){return JSON.parse(store.getItem(authKey)||'null')}
 function save(user){identity=user;store.setItem(authKey,JSON.stringify({user,access_token:'mock-access',refresh_token:'mock-refresh'}))}
 const client={auth:{
  onAuthStateChange:f=>{listener=f;return {data:{subscription:{unsubscribe(){}}}}},
  async getSession(){assert(!insideAuthCallback);calls.push('session');if(!network.online)return {data:{session:null},error:{status:0}};identity=session()?.user||null;return {data:{session:session()}}},
  async getUser(){assert(!insideAuthCallback);if(!network.online)return {error:{status:0}};return identity?{data:{user:identity}}:{error:{status:401}}},
  async signInAnonymously(){calls.push('guest');save({id:'guest-'+rows.size,is_anonymous:true});emit('SIGNED_IN');return {data:{user:identity}}},
  async signInWithPassword({email,password}){assert(password==='test-only-password');calls.push('password');save({id:email==='second@example.test'?'parent-two':'parent-one',email,is_anonymous:false,email_confirmed_at:'2026-11-13'});emit('SIGNED_IN');return {data:{user:identity}}},
  async signOut(){calls.push('signout');identity=null;store.removeItem(authKey);emit('SIGNED_OUT');return {}},
 },functions:{async invoke(_,{body}){if(body.action==='connect'&&network.connectGate){network.connectStarted?.();await network.connectGate;}if(!network.online)return {error:{}};const r=row(identity.id);if(body.action==='save'){assert.equal(body.save.p_expected_revision,r.revision);r.revision++;r.data=structuredClone(body.save.p_save_data);return {data:{ok:true,result:{request_id:body.save.p_request_id,revision:r.revision,replayed:false}}}}return {data:{ok:true,moderation:{banned:false,decisions:[]},runtime:{notices:[]},...(body.action==='connect'?{account:account()}:{} )}}}},
  async rpc(name,args){assert(!insideAuthCallback);calls.push({rpc:name,id:identity.id,args});const r=row(identity.id);if(args.p_display_name)r.name=args.p_display_name;return {data:{ok:true,contract:'meadow-littles-cloud-v1',entitlements_verified:false,...account()}}}
 };
 function account(){const r=row(identity.id);return {profile:{user_id:identity.id,display_name:r.name},save:{cloud_version:1,revision:r.revision,data:structuredClone(r.data)}}}
 context.testSdk={createClient:(_url,_key,opts)=>{authOptions=opts.auth;return client}};
 vm.runInNewContext(source.replace("await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm')",'globalThis.testSdk'),context);
 const api=context.meadowLittlesCloud;
 return {api,dom,events,network,emit,client,get options(){return authOptions},get applied(){return applied},async init(){return api.init({storage:store,getState:()=>({schema:1,stars:27}),applyState:()=>{applied++;return true}})},async drain(){for(const f of tasks.splice(0))await f();await api.reconnect()}};
}
async function run(){
 const store=storage(),a=app(store);await a.init();
 assert.equal(a.options.storage,store,'SDK receives the actual persistent device storage');assert.equal(a.options.storageKey,authKey,'stable existing key preserves installed sessions');assert(a.options.persistSession&&a.options.autoRefreshToken);
 await a.api.signIn('parent@example.test','test-only-password');assert.equal(a.api.getStatus().state,'choice_required');
 const b=app(store);await b.init();assert.equal(b.api.getStatus().state,'choice_required','restart before choosing progress cannot upload another account’s local save');
 await b.api.choose('device');assert.equal(row('parent-one').data.stars,27);
 const passwordCalls=calls.filter(x=>x==='password').length,guestCalls=calls.filter(x=>x==='guest').length;
 const c=app(store);await c.init();assert.equal(c.api.getStatus().userId,'parent-one');assert.equal(c.api.getStatus().state,'ready');assert(c.api.getStatus().parentReady);assert.equal(calls.filter(x=>x==='password').length,passwordCalls,'cold restart needs no password');
 const before=structuredClone(row('parent-one'));await c.api.changeName('  Orchard Helper  ');assert.equal(c.api.getStatus().displayName,'Orchard Helper');assert.equal(row('parent-one').name,'Orchard Helper');assert.equal(row('parent-one').revision,before.revision);assert.deepEqual(row('parent-one').data,before.data);assert.equal(c.applied,0,'name change never imports cloud data');assert.equal(c.api.getStatus().userId,'parent-one');
 for(const name of ['','   ','x'.repeat(33),'name\nline','name\u0000','a\u0085b'])await assert.rejects(c.api.changeName(name),e=>e.code==='LITTLES_INVALID_DISPLAY_NAME');
 c.api.openAccount();let controls=all(c.dom.body.children.at(-1));assert(controls.some(n=>n.value==='Orchard Helper'));assert(controls.some(n=>n.value==='parent-one'&&n.readOnly));
 let releaseConnect,startConnect;const delayedNetwork={online:true,connectGate:new Promise(r=>releaseConnect=r),connectStarted:()=>startConnect()};const started=new Promise(r=>startConnect=r);const delayed=app(store,delayedNetwork),initializing=delayed.init();await started;delayed.api.openAccount();assert(all(delayed.dom.body.children.at(-1)).some(n=>n.textContent==='Connecting to your saved account…'));releaseConnect();await initializing;assert(all(delayed.dom.body.children.at(-1)).some(n=>n.value==='Orchard Helper'),'an account dialog opened during startup updates when the profile arrives');assert(all(delayed.dom.body.children.at(-1)).some(n=>n.textContent==='Connected. Your sign-in is saved on this device.'));
 c.network.online=false;await c.api.reconnect();assert.equal(c.api.getStatus().state,'offline');assert.equal(c.api.getStatus().userId,'parent-one');c.network.online=true;c.events.online();await c.drain();assert.equal(c.api.getStatus().state,'ready');assert.equal(calls.filter(x=>x==='guest').length,guestCalls,'offline recovery never creates a replacement guest');
 c.emit('TOKEN_REFRESHED');await c.drain();assert.equal(c.api.getStatus().userId,'parent-one');
 await c.api.signOut();assert.equal(c.api.getStatus().userId,null);const d=app(store);await d.init();assert.equal(d.api.getStatus().state,'auth_required');assert.equal(calls.filter(x=>x==='guest').length,guestCalls,'sign-out remains signed out across restart');d.api.openAccount();controls=all(d.dom.body.children.at(-1));assert(controls.some(n=>n.textContent==='Sign in to an existing account'),'signed-out screen still has sign-in controls');
 await d.api.signIn('second@example.test','test-only-password');assert.equal(d.api.getStatus().state,'choice_required');assert.equal(d.api.getStatus().userId,'parent-two');assert.equal(row('parent-one').name,'Orchard Helper');const e=app(store);await e.init();assert.equal(e.api.getStatus().state,'choice_required');assert.equal(e.applied,0);
 store.removeItem(authKey);const f=app(store);await f.init();assert.equal(f.api.getStatus().state,'auth_required');assert.equal(calls.filter(x=>x==='guest').length,guestCalls,'expired saved account asks for login instead of replacing identity');assert(store.getItem(rememberedKey));
 assert(![...store.data.values()].some(v=>v.includes('test-only-password')),'password is never written to device storage');
 console.log('Littles accounts59: persistent SDK storage, cold restart auto-login, deferred token refresh, offline reconnect, durable save choice, signed-out/expired recovery, owner-only name changes and unchanged save/UUID passed.');
}
run().catch(e=>{console.error(e);process.exitCode=1});
