const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');const context={window:{}};vm.runInNewContext(fs.readFileSync(__dirname+'/../meadow-market-littles/pip-day.js','utf8'),context);const {brushPatch,distance}=context.window.meadowPipDay;
assert.equal(distance({x:5,y:3},{x:0,y:0},{x:10,y:0}),3);
assert.equal(distance({x:15,y:0},{x:0,y:0},{x:10,y:0}),5);
let patches=Array(6).fill(0);for(let i=0;i<100;i++)patches=brushPatch(patches,{x:380,y:342},{x:380,y:342});assert(patches.every(v=>v===0),'holding still must not clean wool');
patches=brushPatch(patches,{x:0,y:0},{x:900,y:0});assert(patches.every(v=>v===0),'scrubbing the sky must not clean Pip');
patches=brushPatch(patches,{x:320,y:342},{x:440,y:342});assert(patches[0]>0&&patches[5]===0,'a stroke only affects nearby patches');assert(patches[0]<100,'one movement must not instantly clean the whole coat');
for(let i=0;i<8;i++)for(const [x,y] of [[380,342],[445,310],[508,350],[410,403],[485,412],[552,396]])patches=brushPatch(patches,{x:x-65,y},{x:x+65,y});assert(patches.every(v=>v===100),'natural repeated strokes clean every patch');
assert.equal(brushPatch([84,0,0,0,0,0],{x:380,y:342},{x:390,y:342})[0],100,'nearly clean patches must finish without invisible residue');
console.log('Pip: stationary touches, off-animal strokes, local coverage, and full brushing passed.');
