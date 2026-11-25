'use strict';
// Real view + real rules, synthetic DOM/time/touches. No browser, phone, network or account.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../meadow-market-littles');
async function round({background,reduced}){
 const raf=new Map(),voices=[],overlays=[];let serial=0,time=0,game,awards=0,dialog;
 class N extends EventTarget{
  constructor(){super();this.map=new Map();this.children=[];this.style={};this.className='';this.attrs={};this.isConnected=true;this.classList={add(){},remove(){}};this.firstElementChild={style:{}};}
  setAttribute(k,v){this.attrs[k]=v;}getAttribute(k){return this.attrs[k];}getBoundingClientRect(){return{left:0,top:0,width:390,height:600};}
  querySelector(selector){if(selector==='.bsm-overlay')return overlays.filter(n=>!n.removed).at(-1)||null;if(!this.map.has(selector))this.map.set(selector,new N());return this.map.get(selector);}
  getContext(){return{setTransform(){}};}setPointerCapture(){}focus(){}showModal(){this.open=true;}close(){this.open=false;}
  append(n){this.children.push(n);if(n.className.includes('bsm-overlay'))overlays.push(n);}remove(){this.removed=true;this.isConnected=false;}
  set innerHTML(html){this.html=html;if(html.includes('bsm-overlay bsm-start')){const intro=new N();intro.className='bsm-overlay bsm-start';overlays.push(intro);}}
 }
 const document=new N();document.body=new N();document.hidden=false;document.createElement=tag=>{const n=new N();if(tag==='dialog')dialog=n;return n;};
 const env={document,AbortController,Image:class{set src(url){queueMicrotask(()=>this.onload());}},ResizeObserver:class{observe(){}disconnect(){}},matchMedia:()=>({matches:reduced}),devicePixelRatio:1,
  requestAnimationFrame:fn=>{const id=++serial;raf.set(id,fn);return id;},cancelAnimationFrame:id=>raf.delete(id),meadowWeeklyFair:{getQualityBuild:()=>96},meadowBugSmashPaint:{draw(){}},meadowAudio:{play(){},stopVoice(){},speak:id=>voices.push(id)}};
 env.window=env;const bag=new Map();env.localStorage={getItem:k=>bag.get(k)||null,setItem:(k,v)=>bag.set(k,v)};vm.createContext(env);vm.runInContext(fs.readFileSync(root+'/play-access.js','utf8'),env);env.meadowLittlesAccess.configure({enabled:true});
 const core=require(root+'/bug-smash-core.js');env.meadowBugSmashCore={...core,Game:class extends core.Game{constructor(...args){super(...args);game=this;}}};
 vm.runInContext(fs.readFileSync(root+'/bug-smash.js','utf8'),env);env.meadowBugSmash.attach({level:()=>1,completed:()=>{awards++;return env.meadowLittlesAccess.complete('bug_smash');}});await env.meadowBugSmash.open();
 const click=node=>node.dispatchEvent(new Event('click'));
 const frame=()=>{time+=50;const callbacks=[...raf.values()];raf.clear();for(const fn of callbacks)fn(time);};
 const frames=n=>{for(let i=0;i<n;i++)frame();};
 const touch=(x,y)=>{const field=dialog.querySelector('.bsm-field');for(const type of ['pointerdown','pointerup']){const e=new Event(type,{cancelable:true});for(const[k,v]of Object.entries({button:0,pointerId:1,clientX:x,clientY:y}))Object.defineProperty(e,k,{value:v});field.dispatchEvent(e);}};
 const pauseResume=()=>{const overlay=overlays.filter(n=>!n.removed).at(-1);assert(overlay?.html.includes('A little pause'));document.hidden=false;overlay.querySelector('[data-bsm-resume]').onclick();};
 click(dialog.querySelector('[data-bsm-start]'));assert(game);assert.equal(awards,0);
 for(let i=0;i<1000&&game.phase==='ants';i++){frames(2);const ant=game.ants.find(a=>a.x>a.r*2&&a.x<game.width-a.r*2);if(ant)touch(ant.x,ant.y);}
 assert.equal(game.phase,'boss-enter');for(let i=0;i<100&&game.phase!=='boss';i++)frame();assert.equal(game.phase,'boss');
 for(const part of game.parts()){frames(2);touch(part.x,part.y);}assert.equal(game.boss.stage,'body');assert.equal(voices.at(-1),'bug-rhys-tummy');
 // An ordinary playing pause must still repeat the current useful instruction.
 click(dialog.querySelector('[data-bsm-pause]'));const beforePlayingResume=voices.length;pauseResume();assert.equal(voices.length,beforePlayingResume+1);assert.equal(voices.at(-1),'bug-rhys-tummy');
 while(!game.done){frames(2);touch(game.boss.x,game.boss.y);}assert.equal(awards,0,'The splash must finish before accounting');assert.equal(env.meadowLittlesAccess.remaining('bug_smash'),5);
 // The actual farmer button must already describe completion during the splash.
 click(dialog.querySelector('[data-bsm-listen]'));assert.equal(voices.at(-1),'bug-rhys-done');
 if(background){document.hidden=true;document.dispatchEvent(new Event('visibilitychange'));}else click(dialog.querySelector('[data-bsm-pause]'));
 assert(game.paused);const beforeResume=voices.length;frames(100);assert.equal(awards,0,'A paused/background splash cannot award a round');pauseResume();assert.equal(voices.length,beforeResume,'Finishing resume must not replay the old tummy instruction');
 frames(50);assert.equal(voices.at(-1),'bug-rhys-done');assert.equal(awards,1);assert.equal(env.meadowLittlesAccess.remaining('bug_smash'),4,'Exactly one allowance is consumed');assert(overlays.some(n=>!n.removed&&n.className.includes('bsm-win')));
 frames(100);assert.equal(awards,1,'Later animation callbacks cannot double-award');env.meadowBugSmash.close();frames(100);assert.equal(awards,1);assert.equal(raf.size,0);
}
(async()=>{for(const background of [false,true])for(const reduced of [false,true])await round({background,reduced});console.log('Bug Smash finish: four real view/rules rounds; playing instructions resume, finishing/background pauses never replay tummy, completion speaks Done and consumes exactly one round after resume. No phone/account IO.');})().catch(e=>{console.error(e);process.exitCode=1;});
