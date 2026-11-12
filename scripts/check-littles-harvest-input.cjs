const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../meadow-market-littles'),atlas=JSON.parse(fs.readFileSync(root+'/assets/generated/harvest-slice/atlas.json','utf8'));
const core={};vm.runInNewContext(fs.readFileSync(root+'/harvest-slice-core.js','utf8'),core);
const nodes=new Map();let game,frames=0;
class Node {
  constructor(){this.listeners=new Map();this.classes=new Set();this.classList={add:x=>this.classes.add(x),remove:x=>this.classes.delete(x)};this.style={setProperty(){}};this.firstElementChild={style:{}};this.boundary=false;}
  addEventListener(type,fn,options={}){if(!this.listeners.has(type))this.listeners.set(type,[]);this.listeners.get(type).push({fn,signal:options.signal});}
  fire(type,props={}){const e={type,target:this,button:0,isPrimary:true,pointerId:1,clientX:200,clientY:780,preventDefault(){},...props};for(const l of this.listeners.get(type)||[])if(!l.signal?.aborted)l.fn(e);}
  querySelector(s){if(!nodes.has(s))nodes.set(s,new Node());return nodes.get(s);}
  closest(){return this.boundary?this:null;}
  getBoundingClientRect(){return {left:12,top:84,width:400,height:600};}
  getContext(){return {setTransform(){},drawImage(){}};}
  setPointerCapture(id){this.captured=id;}
  setAttribute(){}append(){}remove(){}focus(){}showModal(){}close(){}disconnect(){}
}
const document=new Node();document.body=new Node();document.createElement=()=>new Node();document.hidden=false;
const context={window:{meadowHarvestSliceCore:{...core.meadowHarvestSliceCore,Game:class extends core.meadowHarvestSliceCore.Game{constructor(...a){super(...a);game=this;}}},meadowAudio:{play(){},speak(){},stopVoice(){}},meadowLittlesAccess:{begin:()=>true}},document,matchMedia:()=>({matches:false}),devicePixelRatio:1,performance:{now:()=>1},AbortController,ResizeObserver:class{observe(){}disconnect(){}},requestAnimationFrame:()=>++frames,cancelAnimationFrame(){},Image:class{constructor(){this.naturalWidth=atlas.width;this.naturalHeight=atlas.height;}set src(value){queueMicrotask(()=>this.onload());}},fetch:async()=>({ok:true,json:async()=>atlas})};
(async()=>{
  vm.runInNewContext(fs.readFileSync(root+'/harvest-slice.js','utf8'),context);const api=context.window.meadowHarvestSlice;await api.open();nodes.get('[data-hs-start]').fire('click');
  const scene=nodes.get('.hs-scene');assert(scene.classes.has('hs-playing'));
  const fruit=()=>{game.fruit=[{id:++game.serial,type:0,x:188,y:416,r:50,vx:0,vy:0,angle:0,spin:0}];};
  fruit();scene.fire('pointerdown');assert.equal(scene.captured,1);scene.fire('pointermove',{clientY:300});scene.fire('pointerup',{clientY:300});assert.equal(game.hits,1,'An upward swipe starting below the fruit field cuts fruit as it enters the field');
  fruit();const header=new Node();header.boundary=true;scene.fire('pointerdown',{target:header,clientY:40});scene.fire('pointermove',{clientY:500});assert.equal(game.hits,1,'Help, pause, close and overlay controls cannot begin a slice');
  scene.fire('pointerdown',{isPrimary:false,pointerId:2});scene.fire('pointermove',{pointerId:2,clientY:300});assert.equal(game.hits,1,'A secondary finger cannot start a slice');
  scene.fire('pointerdown');scene.fire('pointermove',{pointerId:2,clientY:300});assert.equal(game.hits,1,'A different finger cannot move the active swipe');scene.fire('pointercancel');scene.fire('pointermove',{clientY:300});assert.equal(game.hits,1,'Cancellation clears the active swipe');
  scene.fire('pointerdown');scene.fire('lostpointercapture');scene.fire('pointermove',{clientY:300});assert.equal(game.hits,1,'Lost capture clears the active swipe');
  nodes.get('[data-hs-pause]').fire('click');assert(game.paused);assert(!scene.classes.has('hs-playing'));scene.fire('pointerdown');scene.fire('pointermove',{clientY:300});assert.equal(game.hits,1,'Paused swipes award nothing');nodes.get('[data-resume]').onclick();assert(!game.paused);assert(scene.classes.has('hs-playing'));
  scene.fire('pointerdown');scene.fire('pointerup',{clientY:300});assert.equal(game.hits,2,'The final lift segment works after resuming');
  fruit();api.close();scene.fire('pointerdown');scene.fire('pointermove',{clientY:300});assert.equal(game.hits,2,'Closed views release gesture listeners');assert.equal(frames,2,'Only start and resume schedule a loop');
  console.log('Harvest Slice actual view: bench-to-fruit swipes, excluded controls, primary pointer, capture/cancel cleanup, pause, resume and final lift passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
