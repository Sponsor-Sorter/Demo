'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const path=require('node:path'),root=path.resolve(__dirname,'..'),C=require(root+'/meadow-market-littles/friends-core.js');
const source=fs.readFileSync(root+'/meadow-market-littles/friends-play.js','utf8'),anchor='window.meadowFriends={';
assert.equal(source.split(anchor).length,2);
const retry='Look at the pictures. You can try again!',rng=n=>()=>((n=(n*1664525+1013904223)>>>0)/4294967296);
function drag(s,target,to){const from={x:.5,y:.86};assert(C.start(s,from,target));for(let i=1;i<=20;i++)C.move(s,{x:from.x+(to.x-from.x)*i/20,y:from.y+(to.y-from.y)*i/20});C.end(s,to);}
function pack(s){while(s.phase==='watch'){C.continueWatch(s,.1);for(let i=0;i<4;i++)C.tick(s,.05);}}
function harness(){const effects=[],scope={window:{meadowFriendsCore:C,meadowAudio:{play:id=>effects.push(id),speak:()=>Promise.resolve(0)}},document:{createElement:()=>({style:{},remove(){}})}};vm.createContext(scope);vm.runInContext(source.replace(anchor,'window.__captionEvents=events;'+anchor),scope);return{effects,events:scope.window.__captionEvents};}
for(const id of ['farmerpattern','farmpicture'])for(const level of [1,4,9])test(id+' level '+level+': two wrong drops, hint, then correct partial placement restores the instruction',()=>{
 const s=C.create(id,level,rng(7),0,{progressive:true});if(id==='farmerpattern')pack(s);
 const h=harness(),caption={textContent:'starting instruction'},a={s,caption,field:{querySelector:()=>({append(){}})},hooks:{later(){}}};
 const correct=id==='farmerpattern'?s.pattern[0]:String(s.pieces[0]);
 const wrong=id==='farmerpattern'?s.options.find(x=>x!==correct):correct;
 const destination=id==='farmerpattern'?C.wagonPoint(s,0):C.slotPoint(s,s.pieces.find(x=>String(x)!==correct));
 for(let i=1;i<=2;i++){drag(s,wrong,destination);h.events(a);assert.equal(caption.textContent,retry);assert.equal(s.misses,i);assert.equal(s.hintReady,i===2);}
 const score=s.score,phase=s.phase;assert(C.hint(s));h.events(a);assert.equal(caption.textContent,retry);assert.equal(s.score,score);
 C.start(s,{x:.5,y:.86},correct);C.cancel(s);C.end(s,destination);h.events(a);assert.equal(caption.textContent,retry,'Cancelling does not claim a correct answer');
 drag(s,correct,id==='farmerpattern'?C.wagonPoint(s,0):C.slotPoint(s,+correct));h.events(a);
 assert.equal(s.phase,phase,'Regression must cover a success without a scene/phase change');assert.equal(s.misses,0);assert.equal(s.hintReady,false);assert.equal(s.hints.length,0);
 assert.equal(id==='farmerpattern'?s.loaded.length:s.placed.length,1);
 assert.equal(caption.textContent,id==='farmerpattern'?'Load the foods in the same order.':'Fit the big pieces into the farm picture.');
 assert(h.effects.includes('care'),'Existing success sound still plays');
});
for(const id of ['farmerpattern','farmpicture'])test(id+': legacy quality88 event behaviour is unchanged',()=>{
 const s=C.create(id,9,rng(7),0,{progressive:false});if(id==='farmerpattern')pack(s);
 const h=harness(),caption={textContent:'starting instruction'},a={s,caption,field:{querySelector:()=>({append(){}})},hooks:{later(){}}};
 const correct=id==='farmerpattern'?s.pattern[0]:String(s.pieces[0]),wrong=id==='farmerpattern'?s.options.find(x=>x!==correct):correct;
 drag(s,wrong,id==='farmerpattern'?C.wagonPoint(s,0):C.slotPoint(s,s.pieces.find(x=>String(x)!==correct)));h.events(a);assert.equal(caption.textContent,retry);
 drag(s,correct,id==='farmerpattern'?C.wagonPoint(s,0):C.slotPoint(s,+correct));h.events(a);
 assert.equal(id==='farmerpattern'?s.loaded.length:s.placed.length,1);assert.equal(caption.textContent,retry,'The private progressive correction must not change the existing public88 route');assert(h.effects.includes('care'));
});
