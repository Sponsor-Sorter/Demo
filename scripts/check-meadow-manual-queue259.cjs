'use strict';
// Actual client modules, synthetic deferred transport; no live server/phone.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const plain=x=>JSON.parse(JSON.stringify(x)),base=()=>({version:1,coins:100,level:10,xp:0,active:'willow',view:'farm',farms:{willow:{objects:[{id:'p',type:'plot',x:4,y:3,crop:'carrot',stage:3,plantedAt:1000}],inventory:{carrot:0}},coast:{objects:[],inventory:{}}}});
function fixture(failSend=false){
 const context={window:{},document:{hidden:false},Date};for(const n of ['farm-commands.js','farm-command-ui.js'])vm.runInNewContext(fs.readFileSync('meadow-and-market/'+n,'utf8'),context);
 let s=base(),owner='own',time=10000,id=0;const memory=new Map(),calls=[],pending=[],messages=[],persisted=[];
 const a={canonical:base(),revision:1,owner:()=>owner,state:()=>s,now:()=>time,screen:()=>s.view,storage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)},uuid:()=>'req-'+(++id),notify:t=>messages.push(t),render(){},persist:(next,rev,who)=>{assert.equal(who,owner);persisted.push(plain(next));},apply:next=>s=next,send:body=>{calls.push(plain(body));return failSend?Promise.reject(Error('offline')):new Promise((resolve,reject)=>pending.push({resolve,reject}));},wait:async()=>{time+=250;}};
 const c=context.window.meadowCommandUI.create(a);
 function finish(index,change){const body=calls[index],save=plain(s);if(change)change(save);pending[index].resolve({status:200,data:{ok:true,request_id:body.request_id,accepted_revision:body.expected_revision+1,revision:body.expected_revision+1,save_data:save,summary:{results:[]}}});}
 return{c,context,a,calls,messages,persisted,memory,finish,pending,state:()=>s,owner:v=>owner=v,time:v=>time=v};
}
const turn=()=>new Promise(resolve=>setImmediate(resolve)),filters=process.argv.slice(2);let passed=0;
const guard=setTimeout(()=>{console.error('Manual intent tests did not reach a terminal result.');process.exitCode=1;},10000);
async function test(name,fn){if(filters.length&&!filters.some(prefix=>name.startsWith(prefix)))return;await fn();passed++;console.log('PASS '+name);}
(async()=>{
 await test('one free harvest waits for quiet worker receipt, not local rewards, then uses its new revision',async()=>{
  const f=fixture(),bg=f.c.run([{type:'workers.tick',map:'willow'}],{quiet:true});
  f.c.route('plot.harvest','p');assert.equal(f.calls.length,1);assert.equal(f.state().coins,100);assert.equal(f.c.status().queuedManual,true);
  f.finish(0);await bg;await turn();assert.equal(f.calls.length,2);assert.equal(f.calls[1].expected_revision,2);assert.equal(f.calls[1].commands[0].type,'plot.harvest');assert.equal(f.state().coins,100);
  f.finish(1,s=>{s.coins=102;s.farms.willow.objects[0].plantedAt=0;s.farms.willow.inventory.carrot=3;});await f.c.flush();assert.equal(f.state().coins,102);assert.equal(f.state().farms.willow.inventory.carrot,3);assert.equal(f.c.status().busy,false);
 });
 await test('repeated taps reserve just one action and background cannot take its slot',async()=>{
  const f=fixture(),bg=f.c.run([{type:'workers.tick'}],{quiet:true});f.c.route('plot.harvest','p');f.c.route('plot.harvest','p');
  await assert.rejects(f.c.run([{type:'workers.tick'}],{quiet:true}));f.finish(0);await bg;await turn();assert.equal(f.calls.length,2);f.finish(1);await f.c.flush();assert.equal(f.calls.length,2);
 });
 for(const [name,change] of [
  ['changed map',f=>{f.state().active='coast';}],
  ['changed screen',f=>{f.state().view='animals';}],
  ['expired five-second intent',f=>f.time(15001)],
  ['changed target cycle',f=>{f.state().farms.willow.objects[0].plantedAt=2000;}],
  ['removed target',f=>{f.state().farms.willow.objects=[];}],
  ['hidden app',f=>{f.context.document.hidden=true;}],
  ['blocked account',f=>{f.context.window.meadowControl={blocked:()=>true};}]
 ])await test(name+' cancels without sending another action',async()=>{
  const f=fixture(),bg=f.c.run([{type:'workers.tick'}],{quiet:true});f.c.route('plot.harvest','p');f.finish(0);change(f);await bg;await f.c.flush();assert.equal(f.calls.length,1);assert.equal(f.state().coins,100);
 });
 await test('account switch never sends queued action or applies old account response',async()=>{
  const f=fixture(),bg=f.c.run([{type:'workers.tick'}],{quiet:true});f.c.route('plot.harvest','p');f.owner('other');f.finish(0);await assert.rejects(bg);await turn();assert.equal(f.calls.length,1);assert.equal(f.persisted.length,0);
 });
 await test('stop invalidates queued intent',async()=>{
  const f=fixture(),bg=f.c.run([{type:'workers.tick'}],{quiet:true});f.c.route('plot.harvest','p');f.c.stop();f.finish(0);await assert.rejects(bg);await turn();assert.equal(f.calls.length,1);
 });
 for(const type of ['build.place','build.move','build.upgrade','plot.plant','plot.water','wallet.credit'])await test('never buffers '+type,async()=>{
  const f=fixture(),bg=f.c.run([{type:'workers.tick'}],{quiet:true});f.c.route(type,'p');assert.equal(f.c.status().queuedManual,false);f.finish(0);await bg;await f.c.flush();assert.equal(f.calls.length,1);
 });
 await test('animal treats are not free intents',async()=>{
  const f=fixture(),bg=f.c.run([{type:'workers.tick'}],{quiet:true});f.c.route('animal.care','p',{action:'treat'});assert.equal(f.c.status().queuedManual,false);f.finish(0);await bg;await f.c.flush();assert.equal(f.calls.length,1);
 });
 await test('a foreground action still cannot queue a second tap',async()=>{
  const f=fixture(),manual=f.c.run([{type:'plot.till',target:'p'}]);f.c.route('plot.harvest','p');assert.equal(f.c.status().queuedManual,false);f.finish(0);await manual;await f.c.flush();assert.equal(f.calls.length,1);
 });
 await test('uncertain background receipt retains the same durable ID and never sends the queued tap',async()=>{
  const f=fixture(true);
  const bg=f.c.run([{type:'workers.tick'}],{quiet:true});f.c.route('plot.harvest','p');await assert.rejects(bg);await turn();assert.equal(f.calls.length,3);assert.equal(new Set(f.calls.map(c=>c.request_id)).size,1);assert(f.calls.every(c=>c.commands[0].type==='workers.tick'));assert.equal(f.c.status().pending,true);assert.equal(f.state().coins,100);
 });
 await test('receipt refresh follows the reserved manual tap without deadlock',async()=>{
  const f=fixture(),bg=f.c.run([{type:'workers.tick'}],{quiet:true});f.c.route('plot.harvest','p');const refresh=f.c.refreshReceipts();f.finish(0);await bg;await turn();assert.equal(f.calls[1].commands[0].type,'plot.harvest');f.finish(1);await turn();assert.equal(f.calls[2].commands[0].type,'shop.check');f.finish(2);await refresh;await f.c.flush();
 });
 await test('owned travel waits for the confirmed revision and keeps one cloned destination',async()=>{
  const f=fixture(),bg=f.c.run([{type:'workers.tick'}],{quiet:true}),data={destination:'coast'};let after=0;
  f.c.route('map.visit',null,data,'willow',{after:()=>after++});data.destination='pine';
  assert.equal(f.calls.length,1);assert.equal(f.state().active,'willow');assert.equal(f.c.status().queuedManual,true);
  f.finish(0);await bg;await turn();assert.equal(f.calls.length,2);assert.equal(f.calls[1].expected_revision,2);
  assert.deepEqual(f.calls[1].commands,[{type:'map.visit',map:'willow',data:{destination:'coast'}}]);assert.equal(after,0);assert.equal(f.state().active,'willow');
  f.finish(1,s=>{s.active='coast';});await f.c.flush();assert.equal(f.state().active,'coast');assert.equal(f.state().coins,100);assert.equal(after,1);
 });
 await test('owned travel reserves only one tap and prevents another worker poll taking its slot',async()=>{
  const f=fixture(),bg=f.c.run([{type:'workers.tick'}],{quiet:true});f.c.route('map.visit',null,{destination:'coast'});f.c.route('map.visit',null,{destination:'coast'});
  await assert.rejects(f.c.run([{type:'workers.tick'}],{quiet:true}));f.finish(0);await bg;await turn();assert.equal(f.calls.length,2);f.finish(1,s=>{s.active='coast';});await f.c.flush();assert.equal(f.calls.length,2);
 });
 await test('owned travel retains the actual map-picker screen identity until its confirmed callback',async()=>{
  const f=fixture(),dialog={mapPicker:true};let screen=dialog,after=0;f.a.screen=()=>screen;
  const bg=f.c.run([{type:'workers.tick'}],{quiet:true});f.c.route('map.visit',null,{destination:'coast'},'willow',{after:()=>{after++;screen='farm';}});
  f.finish(0);await bg;await turn();assert.equal(screen,dialog);assert.equal(after,0);f.finish(1,s=>{s.active='coast';});await f.c.flush();assert.equal(after,1);assert.equal(screen,'farm');
 });
 for(const [name,start] of [
  ['maintenance',f=>f.c.maintenance([{type:'workers.return'}])],
  ['receipt refresh',f=>f.c.refreshReceipts()]
 ])await test('owned travel follows quiet '+name,async()=>{
  const f=fixture(),bg=start(f);f.c.route('map.visit',null,{destination:'coast'});assert.equal(f.c.status().queuedManual,true);
  f.finish(0);await bg;await turn();assert.equal(f.calls[1].commands[0].type,'map.visit');f.finish(1,s=>{s.active='coast';});await f.c.flush();assert.equal(f.state().active,'coast');
 });
 await test('owned travel waits for all previously reserved background receipts without deadlock',async()=>{
  const f=fixture(),bg=f.c.run([{type:'workers.tick'}],{quiet:true}),maintenance=f.c.maintenance([{type:'workers.return'}]),refresh=f.c.refreshReceipts();
  f.c.route('map.visit',null,{destination:'coast'});f.finish(0);await bg;await turn();assert.equal(f.calls[1].commands[0].type,'workers.return');
  f.finish(1);await maintenance;await turn();assert.equal(f.calls[2].commands[0].type,'shop.check');f.finish(2);await refresh;await turn();assert.equal(f.calls[3].commands[0].type,'map.visit');
  f.finish(3,s=>{s.active='coast';});await f.c.flush();assert.equal(f.state().active,'coast');
 });
 await test('owned travel runs before later maintenance and receipt refresh without deadlock',async()=>{
  const f=fixture(),bg=f.c.run([{type:'workers.tick'}],{quiet:true});f.c.route('map.visit',null,{destination:'coast'});
  const maintenance=f.c.maintenance([{type:'workers.return'}]),refresh=f.c.refreshReceipts();f.finish(0);await bg;await turn();assert.equal(f.calls[1].commands[0].type,'map.visit');
  f.finish(1,s=>{s.active='coast';});await turn();assert.equal(f.calls[2].commands[0].type,'workers.return');f.finish(2);await maintenance;await turn();assert.equal(f.calls[3].commands[0].type,'shop.check');f.finish(3);await refresh;await f.c.flush();
 });
 for(const [name,change] of [
  ['source map changes',f=>{f.state().active='coast';}],
  ['screen changes',f=>{f.state().view='animals';}],
  ['build mode starts',f=>{f.state().mode='build';}],
  ['an item move starts',f=>{f.state().moving='p';}],
  ['item placement starts',f=>{f.state().placing='tree';}],
  ['intent expires',f=>f.time(15001)],
  ['destination disappears locally',f=>{delete f.state().farms.coast;}],
  ['app is hidden',f=>{f.context.document.hidden=true;}],
  ['account control blocks',f=>{f.context.window.meadowControl={blocked:()=>true};}]
 ])await test('owned travel cancels when '+name,async()=>{
  const f=fixture(),bg=f.c.run([{type:'workers.tick'}],{quiet:true});f.c.route('map.visit',null,{destination:'coast'});f.finish(0);change(f);await bg;await f.c.flush();assert.equal(f.calls.length,1);assert.equal(f.state().coins,100);
 });
 await test('owned travel cancels if the confirmed destination no longer exists',async()=>{
  const f=fixture(),bg=f.c.run([{type:'workers.tick'}],{quiet:true});f.c.route('map.visit',null,{destination:'coast'});f.finish(0,s=>{delete s.farms.coast;});await bg;await f.c.flush();assert.equal(f.calls.length,1);
 });
 await test('owned travel cancels if the background reply already changed maps',async()=>{
  const f=fixture(),bg=f.c.run([{type:'workers.tick'}],{quiet:true});f.c.route('map.visit',null,{destination:'coast'});f.finish(0,s=>{s.active='coast';});await bg;await f.c.flush();assert.equal(f.calls.length,1);
 });
 await test('owned travel never follows an account switch',async()=>{
  const f=fixture(),bg=f.c.run([{type:'workers.tick'}],{quiet:true});f.c.route('map.visit',null,{destination:'coast'});f.owner('other');f.finish(0);await assert.rejects(bg);await turn();assert.equal(f.calls.length,1);assert.equal(f.persisted.length,0);
 });
 await test('owned travel stops with the controller',async()=>{
  const f=fixture(),bg=f.c.run([{type:'workers.tick'}],{quiet:true});f.c.route('map.visit',null,{destination:'coast'});f.c.stop();f.finish(0);await assert.rejects(bg);await turn();assert.equal(f.calls.length,1);
 });
 for(const [name,data] of [
  ['unowned farm',{destination:'pine'}],['inherited key',{destination:'constructor'}],['current farm',{destination:'willow'}],['non-string destination',{destination:5}],
  ['extra money field',{destination:'coast',coins:1}],['missing destination',{}],['unlock field',{destination:'coast',unlock:true}]
 ])await test('owned travel rejects '+name,async()=>{
  const f=fixture(),bg=f.c.run([{type:'workers.tick'}],{quiet:true});f.c.route('map.visit',null,data);assert.equal(f.c.status().queuedManual,false);f.finish(0);await bg;await f.c.flush();assert.equal(f.calls.length,1);
 });
 await test('owned travel rejects an unexpected object target',async()=>{
  const f=fixture(),bg=f.c.run([{type:'workers.tick'}],{quiet:true});f.c.route('map.visit','p',{destination:'coast'});assert.equal(f.c.status().queuedManual,false);f.finish(0);await bg;await f.c.flush();assert.equal(f.calls.length,1);
 });
 await test('owned travel rejects a farm present only in unconfirmed local state',async()=>{
  const f=fixture(),bg=f.c.run([{type:'workers.tick'}],{quiet:true});f.state().farms.pine={objects:[]};f.c.route('map.visit',null,{destination:'pine'});
  assert.equal(f.c.status().queuedManual,false);f.finish(0,s=>{delete s.farms.pine;});await bg;await f.c.flush();assert.equal(f.calls.length,1);
 });
 await test('owned travel never queues behind a foreground transaction',async()=>{
  const f=fixture(),manual=f.c.run([{type:'plot.till',target:'p'}]);f.c.route('map.visit',null,{destination:'coast'});assert.equal(f.c.status().queuedManual,false);f.finish(0);await manual;await f.c.flush();assert.equal(f.calls.length,1);
 });
 await test('owned travel never creates a new request after an uncertain background save',async()=>{
  const f=fixture(true),bg=f.c.run([{type:'workers.tick'}],{quiet:true});f.c.route('map.visit',null,{destination:'coast'});await assert.rejects(bg);await turn();
  assert.equal(f.calls.length,3);assert.equal(new Set(f.calls.map(c=>c.request_id)).size,1);assert(f.calls.every(c=>c.commands[0].type==='workers.tick'));assert.equal(f.state().active,'willow');assert.equal(f.c.status().pending,true);
 });
 assert.equal(passed,filters.length||52);clearTimeout(guard);console.log(JSON.stringify({passed,filtered:filters.length>0,actualDeviceCalls:0,liveServerCalls:0,rewardsOnlyFromSyntheticVerifiedReplies:true}));
})().catch(error=>{clearTimeout(guard);console.error(error);process.exitCode=1;});
