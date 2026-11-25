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
 assert.equal(passed,filters.length||21);clearTimeout(guard);console.log(JSON.stringify({passed,filtered:filters.length>0,actualDeviceCalls:0,liveServerCalls:0,rewardsOnlyFromSyntheticVerifiedReplies:true}));
})().catch(error=>{clearTimeout(guard);console.error(error);process.exitCode=1;});
