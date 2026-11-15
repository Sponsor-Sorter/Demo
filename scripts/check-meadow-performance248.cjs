const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const game=fs.readFileSync('meadow-and-market/game.js','utf8');
const line=prefix=>{const value=game.split(/\r?\n/).find(s=>s.startsWith(prefix));assert(value,'Missing actual source '+prefix);return value;};
const plain=value=>JSON.parse(JSON.stringify(value));

// Exercise the real polygon/projection functions, including their invalidation.
let rect={left:20,top:20,width:800,height:800};
const terrain={state:{active:'coast'},addEventListener(){},$:id=>({getBoundingClientRect:()=>id==='#farm-grid'?rect:{left:0,top:0,width:1000,height:1000}})};
vm.createContext(terrain);
vm.runInContext([line('  const meadowOutline='),line('  const areaOutlines='),line('  Object.assign(areaOutlines,'),line('  function pointInMeadow('),line('  let meadowProjection='),line('  function resetMeadowProjection('),line('  function getMeadowProjection('),line('  function meadowCell('),line('  let grassCellsKey='),line('  function meadowGrass('),'function gridRows(){return 10}'].join('\n'),terrain);
vm.runInContext('const originalCell=meadowCell;var scans=0;meadowCell=(x,y)=>{scans++;return originalCell(x,y)}',terrain);
const cells=terrain.meadowGrass();assert(cells.length>0);
const expected=[];for(let y=-10;y<22;y++)for(let x=-10;x<26;x++)if(terrain.meadowCell(x,y))expected.push({x,y});
assert.deepEqual(plain(cells),expected,'Cached cells exactly retain the original 33-point grass test');
terrain.scans=0;for(let i=0;i<100;i++)assert.equal(terrain.meadowGrass(),cells);
assert.equal(terrain.scans,0,'Unchanged renders neither rescan cells nor invalidate walking terrain identity');
terrain.resetMeadowProjection();assert.equal(terrain.meadowGrass(),cells,'Same geometry after a pan/resize retains identity');
rect={left:100,top:0,width:700,height:700};terrain.resetMeadowProjection();const resized=terrain.meadowGrass();assert.notEqual(resized,cells);assert.equal(terrain.scans,1152);
terrain.scans=0;terrain.state.active='back';terrain.resetMeadowProjection();const other=terrain.meadowGrass();assert.notEqual(other,resized);assert.equal(terrain.scans,1152);
console.log('Grass cache: identical accepted cells, no repeated scans, correct resize/map invalidation.');

// Run the actual renderer. Intercept only the replacement branch, after its
// retention decision, to count DOM churn without fabricating the artwork DOM.
let objects=Array.from({length:500},(_,i)=>({id:'item-'+i,type:'hay',x:i,y:1})),rebuilds=0;
const nodes=objects.map(o=>({dataset:{id:o.id},_farmObject:o,remove(){}}));
const grid={dataset:{renderMap:'willow'},style:{setProperty(){}},querySelectorAll:s=>s===':scope > .farm-object'?nodes:[],append(){}};
const paint={state:{active:'willow',mode:'tend',placing:null,moving:null,selected:null},current:()=>({objects}),isHousedInFarm:()=>false,footprint:()=>({w:1,h:1}),gridRows:()=>10,meadowGrass:()=>[],expansionLevel:()=>0,window:{meadowHitShapes:{apply(){}}},$:()=>grid,syncCropNeedLayer(){},rebuilt:0};
vm.createContext(paint);vm.runInContext(line('  const transientVisualFields=')+'\n'+line('  function objectVisualKey('),paint);
for(let i=0;i<nodes.length;i++)nodes[i]._visualKey=paint.objectVisualKey(objects[i]);
grid.dataset.terrainKey=JSON.stringify(['willow','tend',null,0,objects.map(o=>o.x+','+o.y),[]]);
const renderer=game.slice(game.indexOf('  gridRender=function('),game.indexOf('  function stationNeedBadge('));
assert(renderer.includes('old?.remove();const d='));
vm.runInContext(renderer.replace('old?.remove();const d=','rebuilt++;old?.remove();return;const d='),paint);
for(let i=0;i<100;i++){objects=plain(objects);paint.gridRender();}
assert.equal(paint.rebuilt,0,'50,000 unchanged canonical objects retain their real DOM nodes');
for(let i=0;i<nodes.length;i++)assert.equal(nodes[i]._farmObject,objects[i],'Retained nodes refer to the latest canonical object');
objects[0].name='Changed';paint.gridRender();assert.equal(paint.rebuilt,1,'A changed visible property still replaces its tile');
objects[0].name=undefined;paint.state.selected=objects[1].id;paint.gridRender();assert.equal(paint.rebuilt,2,'Selection still updates its tile');
const animal={id:'loose-hen',type:'chicken',kind:'animal',hunger:90,clean:90};const healthyKey=paint.objectVisualKey(animal);animal.hunger=80;assert.equal(paint.objectVisualKey(animal),healthyKey,'Ordinary healthy decay does not repaint');animal.hunger=34;assert.notEqual(paint.objectVisualKey(animal),healthyKey,'Crossing the rendered needs threshold must repaint');animal.hunger=90;animal.clean=34;assert.notEqual(paint.objectVisualKey(animal),healthyKey,'Cleaning need also invalidates the visual');
console.log('Farm renderer: 50,000 unchanged replacements avoided; changed art and selection invalidate normally.');

// A retained node's long-hold must resolve the current canonical coordinates.
const listeners={},node={dataset:{id:'plot'},classList:{add(){}},querySelectorAll:()=>[],addEventListener:(type,fn)=>listeners[type]=fn};
let held,preview;
const gestures={pendingTransfer:null,obj:()=>({id:'plot',x:7,y:8}),cancelObjectHold(){},setTimeout:fn=>(held=fn,1),OBJECT_HOLD_MS:1200,camera:{pointers:new Set()},isoCellFromPoint:()=>({x:10,y:11}),state:{},render(){},guideCollapseTray(){},previewPlacement:p=>preview=p,cameraScene:{setPointerCapture(){}},navigator:{},notify(){}};
vm.createContext(gestures);vm.runInContext(line('  function bindObjectGesture('),gestures);
gestures.bindObjectGesture(node,{id:'plot',x:1,y:2});listeners.pointerdown({pointerType:'mouse',button:0,pointerId:1,clientX:5,clientY:6});held();
assert.deepEqual(plain(preview),{x:7,y:8});assert.equal(gestures.objectGesture.offsetX,3);assert.equal(gestures.objectGesture.offsetY,3);
console.log('Retained long-hold gestures use the current object and its exact tile anchor.');

let visible=true,titles=0,snapshots=0;
const motion={window:{},document:{hidden:false},performance:{now:()=>200},requestAnimationFrame(){}};
const workerSource=fs.readFileSync('meadow-and-market/workers.js','utf8');
vm.runInNewContext(workerSource.replace('window.meadowWorkers={','window.probe={actors,frame,install(a){api=a;gridWidth=gridHeight=100;}};window.meadowWorkers={'),motion);
const probe=motion.window.probe,world={paused:{},server:{people:{},leases:{},targets:{}}};
probe.install({visible:()=>visible,verified:()=>{snapshots++;return world},clock:()=>2000});
for(let i=0;i<12;i++){let title='';const actor={id:'actor-'+i,name:'Worker',skin:'jade',node:{style:{},dataset:{},hidden:false,get title(){return title},set title(v){title=v;titles++}},sprite:{style:{}},x:0,y:0,dir:0,mode:'idle',frame:0,phase:0};probe.actors.set(actor.id,actor);}
for(let i=1;i<=100;i++)probe.frame(i*200);
assert.equal(titles,12,'Stable worker statuses mutate once, not once per actor/frame');
visible=false;const calls=snapshots;for(let i=101;i<201;i++)probe.frame(i*200);assert.equal(snapshots,calls,'Covered farm does not project or repaint workers');
visible=true;probe.frame(41000);assert.equal(snapshots,calls+1,'Returning to the farm immediately resumes its current server pose');
console.log('Worker paint: 1,200 repeated title writes reduced to 12; covered farm pauses/resumes.');
