'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('meadow-and-market/build-layout.js','utf8');
function setup(missing=false){
 let building=true,rotating=false,writes=0,taps=0;const classes=new Set(),attrs=new Map([['aria-pressed','false']]),events={};
 const scene={classList:{contains:k=>classes.has(k),toggle(k,on){writes++;on?classes.add(k):classes.delete(k)}}};
 let hidden=false;const button={get hidden(){return hidden},set hidden(v){writes++;hidden=v},getAttribute:k=>attrs.get(k),setAttribute(k,v){writes++;attrs.set(k,v)},addEventListener:(n,f)=>events[n]=f};
 const c={window:{meadowAudio:{play:()=>taps++}},document:{getElementById:id=>missing?null:id==='farm-land'?scene:button,querySelector:()=>rotating?{}:null}};
 vm.runInNewContext(source,c);const api=c.window.meadowBuildLayout;api.attach({inBuild:()=>building});
 return{api,scene,button,events,attrs,classes,get writes(){return writes},get taps(){return taps},building:v=>building=v,rotating:v=>rotating=v};
}
const h=setup();assert.equal(h.classes.has('layout-view'),false);assert.equal(h.button.hidden,false);
const originalWrites=h.writes;for(let i=0;i<1000;i++)h.api.refresh();assert.equal(h.writes,originalWrites,'Unchanged farm renders do not rewrite layout DOM');
h.events.click();assert(h.classes.has('layout-view'));assert.equal(h.attrs.get('aria-pressed'),'true');assert.equal(h.taps,1);
h.rotating(true);h.api.refresh();assert(h.button.hidden,'Existing placement rotation controls retain their two rows');h.events.click();assert.equal(h.taps,1,'Hidden toggle cannot change placement state');assert(h.classes.has('layout-view'),'The active view remains available to the existing placement preview');
h.rotating(false);h.api.refresh();assert.equal(h.button.hidden,false);
h.building(false);h.api.refresh();assert.equal(h.classes.has('layout-view'),false);assert.equal(h.attrs.get('aria-pressed'),'false');assert(h.button.hidden);
h.building(true);h.api.refresh();assert.equal(h.classes.has('layout-view'),false,'Build reentry uses normal artwork');assert.equal(h.button.hidden,false);
const absent=setup(true);assert.doesNotThrow(()=>absent.api.refresh(),'Missing optional build controls do not break the farm');
console.log('Build layout: opt-in view, normal-art reset, placement controls, inert hidden toggle, 1,000 unchanged renders and optional-control safety passed.');
