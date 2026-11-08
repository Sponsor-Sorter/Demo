const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../meadow-market-littles'),read=f=>fs.readFileSync(path.join(root,f),'utf8'),registered={};
const scope={window:{meadowFarmAdventures:{register:(kind,impl)=>registered[kind]=impl}},console};
vm.runInNewContext(read('farm-journeys.js'),scope);
assert.equal(Object.keys(registered).length,12);
const {travel}=scope.window.meadowFarmJourneys.rules,rect={left:0,top:0,right:100,bottom:100};
assert.equal(travel({x:30,y:30},{x:30,y:30},rect),0,'A stationary touch cannot complete rubbing');
assert.equal(travel({x:30,y:30},{x:300,y:30},rect),0,'Movement away from the activity cannot count');
assert.equal(travel({x:300,y:30},{x:30,y:30},rect),0,'Re-entering the activity cannot count travel outside it');assert.equal(travel({x:NaN,y:30},{x:30,y:30},rect),0);
assert.equal(travel({x:20,y:20},{x:50,y:60},rect),50);assert.equal(travel({x:0,y:0},{x:90,y:90},rect),50,'A single teleport cannot complete a task');
let queued=[],renders=0;const a={parts:[],journeyPhase:'plant',busy:false,finished:false,root:{querySelectorAll:()=>[]},render(){renders++},sound(){},later(fn){queued.push(fn)},win(){throw Error('A partial garden must not win')}};
for(const id of [0,0,1,2])registered.seed.accept(a,'soil-'+id,'carrot');
assert.deepEqual(a.parts,[0,1,2]);assert.equal(queued.length,1,'Repeated seed placement may not queue multiple phase changes');assert.equal(a.journeyPhase,'plant');assert.equal(a.busy,true);queued.shift()();assert.equal(a.journeyPhase,'water');assert.deepEqual(Array.from(a.parts),[]);assert.equal(a.busy,false);
for(const id of [0,1,2])registered.seed.accept(a,'soil-'+id,'water');queued.shift()();assert.equal(a.journeyPhase,'pick');
for(const id of [0,1,2])registered.seed.accept(a,'basket','carrot-'+id);queued.shift()();assert.equal(a.journeyPhase,'wash');
const targets=[0,1].map(i=>({dataset:{faTarget:'friend-'+i,accept:'apple'}}));registered.kindness.select({needs:['apple','carrot'],root:{querySelectorAll:()=>targets}});assert.deepEqual(targets.map(t=>t.dataset.accept),['apple','carrot'],'Selecting a snack cannot change another friend’s need');
const cache=JSON.parse(read('sw.js').match(/FILES=(\[[\s\S]*?\]);/)[1]);for(const f of ['farm-journeys.js?v=2','farm-journeys.css?v=1']){assert(read('index.html').includes(f));assert(cache.includes('./'+f));}
for(const impl of Object.values(registered))for(const file of impl.assets||[]){assert(fs.existsSync(path.join(root,file)),'Prepared scene picture exists: '+file);assert(cache.includes('./'+file),'Prepared scene picture works offline: '+file);}
const crypto=require('node:crypto'),manifest=JSON.parse(read('assets/generated/farm-journeys/generation.json'));assert.equal(manifest.files.length,3);for(const file of manifest.files){const name='assets/generated/farm-journeys/'+file.id+'.webp';assert(file.hasAlpha);assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,name))).digest('hex'),file.sha256);assert(cache.includes('./'+name));}
console.log('Littles journeys: twelve activities, movement-only progress, bounded gestures, duplicate placement protection, complete garden phase ordering and friend-specific matching passed.');
