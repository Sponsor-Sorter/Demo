const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'../meadow-market-littles'),context={};
vm.runInNewContext(fs.readFileSync(root+'/harvest-slice-core.js','utf8'),context);
const {Game,segmentHits,types}=context.meadowHarvestSliceCore;
const random=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
assert(segmentHits({x:-200,y:200},{x:1200,y:200},{x:500,y:200},40),'A fast swipe cannot skip a fruit');
assert(!segmentHits({x:500,y:200},{x:500,y:200},{x:500,y:200},40),'A stationary touch is not slicing');
assert(!segmentHits({x:0,y:0},{x:800,y:0},{x:400,y:100},40),'A distant swipe does not cut');
assert(!segmentHits({x:NaN,y:0},{x:800,y:0},{x:400,y:0},40));
let rounds=0;
for(const [width,height]of [[320,330],[390,620],[1024,560],[1366,800]])for(let seed=1;seed<=20;seed++){
  const game=new Game(width,height,{goal:seed%2?12:16,random:random(seed)}),seenTypes=new Set();
  for(let i=0;i<12000&&!game.done;i++){
    game.step(1/60);assert(game.fruit.length<=4);assert(game.drops.length<=140);
    const ready=game.fruit.find(f=>f.y<height*.58&&f.y>0);
    if(ready){const hit=game.slice({x:-20,y:ready.y},{x:width+20,y:ready.y});for(const f of hit)seenTypes.add(f.type);}
    for(const f of [...game.fruit,...game.pieces])assert([f.x,f.y,f.vx,f.vy,f.r].every(Number.isFinite));
  }
  assert(game.done,'Every seeded round can be completed at this screen size');assert.equal(game.hits,game.goal);assert.equal(seenTypes.size,types.length,'Fruit and vegetables all appear');
  const serial=game.serial,hits=game.hits;for(let i=0;i<300;i++)game.step(1/60);assert.equal(game.serial,serial,'Winning stops new throws');assert.equal(game.hits,hits);rounds++;
}
const missed=new Game(390,620,{random:random(22)});
for(let i=0;i<3600;i++)missed.step(1/60);
assert(missed.missed>0);assert.equal(missed.hits,0);assert(!missed.done,'Missing produce never ends or spends a round');assert(missed.fruit.length>0,'Fresh throws continue');
missed.paused=true;const frozen=JSON.stringify(missed);
for(let i=0;i<100;i++)missed.step(1);assert.equal(JSON.stringify(missed),frozen,'Pause freezes physics and elapsed time');
assert.equal(missed.slice({x:0,y:200},{x:390,y:200}).length,0);
missed.paused=false;const old=missed.fruit[0],before={x:old.x,y:old.y};missed.resize(1024,560);assert.equal(old.x,before.x*1024/390);assert.equal(old.y,before.y*560/620);assert.equal(old.r,missed.radius);
const limit=new Game(800,600,{goal:2,random:random(4)});for(let i=0;i<3;i++)limit.toss();limit.fruit.forEach((f,i)=>{f.x=150+i*220;f.y=200;});
const ids=limit.fruit.map(f=>f.id);assert.equal(limit.slice({x:0,y:200},{x:800,y:200}).length,2);assert.equal(limit.hits,2);assert(limit.done);assert.equal(limit.accessibleCut(ids[0]).length,0,'Already cut fruit cannot award twice');assert.equal(limit.accessibleCut(ids[2]).length,0,'Winning cannot overshoot the goal');assert.equal(limit.pieces.length,4,'Each cut releases exactly two separate halves');
const bag=new Game(800,600,{random:random(1)});const order=Array.from({length:24},()=>bag.nextType());for(let i=0;i<24;i+=6)assert.equal(new Set(order.slice(i,i+6)).size,6);for(let i=1;i<24;i++)assert.notEqual(order[i],order[i-1]);
const cache=JSON.parse(fs.readFileSync(root+'/sw.js','utf8').match(/FILES=(\[[\s\S]*?\]);/)[1]);
for(const file of ['harvest-slice-core.js?v=1','harvest-slice.js?v=1','harvest-slice.css?v=2','assets/generated/harvest-slice/orchard.webp','assets/generated/harvest-slice/produce-atlas.webp','assets/generated/harvest-slice/preview.webp']){assert(cache.includes('./'+file));assert(fs.existsSync(root+'/'+file.split('?')[0]));}
console.log(`Harvest Slice: ${rounds} complete screen-size/seed rounds, continuous swipes, no stationary cuts, two cut halves, repeat protection, free misses, pause, resize, varied bags and offline assets passed.`);
const atlas=JSON.parse(fs.readFileSync(root+'/assets/generated/harvest-slice/atlas.json','utf8'));
assert.equal(atlas.frames.length,6);for(const row of atlas.frames){assert.equal(row.length,3);for(const r of row)assert(r.x>=0&&r.y>=0&&r.w>80&&r.h>100&&r.x+r.w<=atlas.width&&r.y+r.h<=atlas.height,'Every separate whole/half sprite stays inside its atlas');}
assert(cache.includes('./assets/generated/harvest-slice/atlas.json'));
const approved={window:{}};vm.runInNewContext(fs.readFileSync(root+'/approved-voices.js','utf8'),approved);
const narration=JSON.parse(fs.readFileSync(root+'/assets/audio/slice-jay-generation.json','utf8'));
for(const id of ['slice-jay-intro','slice-jay-done']){const item=narration.files.find(f=>f.id===id),clip=fs.readFileSync(root+'/assets/audio/'+id+'.mp3');assert(item&&item.farmer==='jay'&&item.voice===approved.window.meadowApprovedVoices.cast.jay);assert.equal(clip.length,item.bytes);assert.equal(require('node:crypto').createHash('sha256').update(clip).digest('hex'),item.sha256);assert.equal(approved.window.meadowApprovedVoices.clips[id].farmer,'jay');assert(cache.includes('./assets/audio/'+id+'.mp3?v=56'));}
// Exercise closing the real view while image decoding is still pending.
(async()=>{
  const images=[],nodes=new Map();let disconnects=0,rewards=0,controller;
  class Node extends EventTarget{constructor(){super();this.style={setProperty(){}};this.classList={remove(){}};this.firstElementChild={style:{}};}setAttribute(){}append(){}showModal(){this.open=true;}close(){this.open=false;}querySelector(selector){if(!nodes.has(selector))nodes.set(selector,new Node());return nodes.get(selector);}getContext(){return {};}focus(){}}
  const document=new Node();document.body=new Node();document.createElement=()=>new Node();
  const view={window:{meadowHarvestSliceCore:context.meadowHarvestSliceCore,meadowAudio:{stopVoice(){}}},document,matchMedia:()=>({matches:false}),AbortController:class extends AbortController{constructor(){super();controller=this;}},ResizeObserver:class{observe(){}disconnect(){disconnects++;}},cancelAnimationFrame(){},requestAnimationFrame(){throw Error('A closed loading screen must not start animation');},Image:class{constructor(){images.push(this);}set src(v){}},fetch:async()=>({ok:true,json:async()=>atlas})};
  vm.runInNewContext(fs.readFileSync(root+'/harvest-slice.js','utf8'),view);const api=view.window.meadowHarvestSlice;api.attach(()=>rewards++);const pending=api.open();api.close();for(const img of images)img.onload();await pending;assert(controller.signal.aborted);assert.equal(disconnects,1);assert.equal(rewards,0);assert(!nodes.has('[data-hs-start]'),'A stale decode cannot create an active start handler');
  console.log('Harvest Slice: clean atlas frames, exact approved Jay recordings and close-during-decoding cleanup passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
