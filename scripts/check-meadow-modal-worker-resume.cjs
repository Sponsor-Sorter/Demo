'use strict';
// Executes the actual game polling closure; no browser, network or saved farm.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../meadow-and-market/game.js'),'utf8');
const begin='let lastPoll=0,wasAway=true;',end='},1000);';
assert.equal(source.indexOf(begin),source.lastIndexOf(begin),'Unique real worker-poll closure required');
const start=source.indexOf(begin);assert(start>=0);const finish=source.indexOf(end,start);assert(finish>start);
const closure=source.slice(start,finish+end.length);
function fixture(){
 const c={clock:12000,modal:false,hidden:false,blocked:false,ready:true,active:true,cleared:0,calls:[],status:{busy:false,pending:false,leases:{}}},owner='fixture-owner';let callback;
 const state={active:'willow',mode:'tend',_serverWorkers:{leases:{}}},pointers=new Set();
 const sandbox={owner,cloudUser:{id:owner},cloudReady:true,activeVisit:null,state,uiPointers:pointers,commandPollTimer:null,document:{get hidden(){return c.hidden;},querySelector:s=>s==='dialog[open]'&&c.modal?{}:null},window:{meadowControl:{blocked:()=>c.blocked},meadowCommandUI:{active:()=>c.active}},performance:{now:()=>c.clock},controller:{status:()=>c.status,run:commands=>{c.calls.push(Array.from(commands,x=>({type:x.type,map:x.map})));return Promise.resolve();}},setInterval(fn,ms){assert.equal(ms,1000);callback=fn;return 1;},clearInterval(){c.cleared++;}};
 vm.runInNewContext(closure,sandbox,{timeout:1000});c.cleared=0;
 c.tick=(at,changes={})=>{c.clock=at;Object.assign(c,changes);callback();};c.state=state;c.pointers=pointers;c.sandbox=sandbox;
 c.tick(12000);assert.deepEqual(c.calls.map(a=>a.map(x=>x.type)),[['workers.return','workers.tick']]);c.calls=[];
 return c;
}
test('long full-screen dialog pauses requests, then catches up hired work once',()=>{
 const c=fixture();for(let at=24000;at<=612000;at+=12000)c.tick(at,{modal:true});assert.equal(c.calls.length,0);
 c.tick(624000,{modal:false});assert.deepEqual(c.calls.map(a=>a.map(x=>x.type)),[['workers.return','workers.tick']]);
 c.tick(625000);assert.equal(c.calls.length,1);c.tick(636000);assert.deepEqual(c.calls[1].map(x=>x.type),['workers.tick']);
});
test('covered UI does not bypass a pending receipt when it closes',()=>{
 const c=fixture();c.tick(24000,{modal:true});c.status.pending=true;c.tick(36000,{modal:false});assert.equal(c.calls.length,0);
 c.status.pending=false;c.tick(48000);assert.deepEqual(c.calls[0].map(x=>x.type),['workers.return','workers.tick']);
});
test('covered UI does not dispatch while a finger is placing or dragging',()=>{
 const c=fixture();c.tick(24000,{modal:true});c.pointers.add('finger');c.tick(36000,{modal:false});assert.equal(c.calls.length,0);
 c.pointers.clear();c.tick(48000);assert.deepEqual(c.calls[0].map(x=>x.type),['workers.return','workers.tick']);
});
test('existing background resume keeps its single return and tick',()=>{const c=fixture();c.tick(24000,{hidden:true});assert.equal(c.calls.length,0);c.tick(36000,{hidden:false});assert.deepEqual(c.calls[0].map(x=>x.type),['workers.return','workers.tick']);});
test('ordinary visible farm polls keep the established cadence',()=>{const c=fixture();c.tick(13000);assert.equal(c.calls.length,0);c.tick(24000);assert.deepEqual(c.calls[0].map(x=>x.type),['workers.tick']);c.tick(25000);assert.equal(c.calls.length,1);});
test('Build-mode pause retains its existing behavior',()=>{const c=fixture();c.state.mode='build';c.tick(24000);assert.equal(c.calls.length,0);c.state.mode='tend';c.tick(36000);assert.deepEqual(c.calls[0].map(x=>x.type),['workers.tick']);});
test('control and visit boundaries still prevent worker commands',()=>{const c=fixture();c.tick(24000,{blocked:true});assert.equal(c.calls.length,0);c.blocked=false;c.sandbox.activeVisit={id:'visited-farm'};c.tick(36000);assert.equal(c.calls.length,0);});
test('changing the signed-in actor ends the old poll without requests',()=>{const c=fixture();c.sandbox.cloudUser={id:'other-fixture-owner'};c.tick(24000,{modal:true});assert.equal(c.calls.length,0);assert.equal(c.cleared,1);});
