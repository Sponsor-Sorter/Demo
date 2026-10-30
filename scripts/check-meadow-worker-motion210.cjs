const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const context={window:{}};vm.runInNewContext(fs.readFileSync('meadow-and-market/workers.js','utf8'),context);
const pose=context.window.meadowWorkers.serverPose,plain=x=>JSON.parse(JSON.stringify(x));
const lease={startedAt:1000,readyAt:6000,path:[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:2,y:2}]};
assert.equal(pose(lease,1000).mode,'walk');assert.deepEqual(plain(pose(lease,1480)),{x:.5,y:0,dir:7,mode:'walk'});
const second=pose(lease,2440);assert.equal(second.x,1);assert.equal(second.y,.5);assert.equal(second.dir,1);
const diagonal=pose(lease,1000+1920+Math.SQRT2*480);assert(Math.abs(diagonal.x-1.5)<1e-9);assert(Math.abs(diagonal.y-1.5)<1e-9);assert.equal(diagonal.mode,'walk');
assert.equal(pose(lease,4300).mode,'idle');assert.equal(pose(lease,4400).mode,'action');assert.equal(pose(lease,6000).mode,'idle');assert.equal(pose(lease,5000,true).mode,'idle');assert.equal(pose(null,1000),null);
assert.equal(pose({...lease,path:[{x:2,y:2}]},5000).mode,'action');
console.log('Verified worker motion: exact saved path, directional interpolation, diagonal speed, action window and drink arrival passed.');
// A populated farm must not rebuild its object/roster lookup once per actor
// per animation frame. The adapter caches that lookup by canonical state.
const probeContext={window:{},document:{hidden:false},performance:{now:()=>200},requestAnimationFrame(){}};
const instrumented=fs.readFileSync('meadow-and-market/workers.js','utf8').replace('window.meadowWorkers={','window.frameProbe={actors,frame,install(a){api=a;gridWidth=gridHeight=100;lastFrame=0;}};window.meadowWorkers={');
vm.runInNewContext(instrumented,probeContext);let snapshots=0,worldCalls=0;
const world={paused:{},server:{people:{},leases:{},targets:{}}},probe=probeContext.window.frameProbe;
probe.install({verified(){snapshots++;return world;},clock:()=>2000,world(){worldCalls++;throw Error('Frame requested the full live world');}});
for(let i=0;i<12;i++)probe.actors.set('actor-'+i,{id:'actor-'+i,name:'Worker',skin:'jade',node:{style:{},dataset:{},hidden:false},sprite:{style:{}},x:0,y:0,dir:0,mode:'idle',frame:0,phase:0});
probe.frame(200);assert.equal(snapshots,1);assert.equal(worldCalls,0);
console.log('Twelve actors share one cached verified scene per frame; no per-actor world rebuild.');
