const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
module.exports=(async()=>{
 let now=1000000,ready=true,yields=0,saves=0,completed=0;
 class Clock extends Date{static now(){return now}}
 const document={hidden:false,addEventListener(){}},scope={window:{addEventListener(){}},Date:Clock,document,setInterval(){},console};
 for(const file of ['crop-growth.js','farm-work.js','worker-return.js'])vm.runInNewContext(fs.readFileSync('meadow-and-market/'+file,'utf8'),scope);
 const s={active:'home',coins:100,farms:{home:{objects:[],inventory:{}},east:{objects:[],inventory:{}},west:{objects:[],inventory:{}}},workforce:{rowan:{map:'east',jobs:0},ellis:{map:'west',jobs:0}}};
 const crops={carrot:{name:'Carrots',time:10000}},well={type:'well',autoWater:true};
 const field=id=>({id,type:'plot',x:2,y:3,crop:'carrot',stage:1,plantedAt:now-100000,wateredUntil:0});
 s.farms.east.objects=[field('east-field')];s.farms.west.objects=[field('west-field')];
 const work=scope.window.meadowFarmWork,ret=scope.window.meadowWorkerReturn;
 work.attach({state:()=>s,crops,well:()=>well,area:()=>1,yield:()=>3,fruitProgress:()=>0,isAnimal:()=>false,home:()=>null,seed:o=>o.crop,seedCost:()=>3,canPlant:()=>true,xp(){},event(){},save(){},render(){}});
 const a={state:()=>s,workers:()=>Object.entries(s.workforce).map(([key,w])=>({key,map:w.map})),ready:()=>ready,benefit:()=>({jobs:6,drink:5}),task:work.task,perform:work.perform,reachable:()=>true,save:()=>saves++,yieldFrame:async()=>{yields++},complete:()=>completed++};
 assert.equal(await ret.catchUp(a,now-59000,now),null);ready=false;assert.equal(await ret.catchUp(a,now-120000,now),null);ready=true;assert.equal(s.coins,100);
 const report=await ret.catchUp(a,now-120000,now);assert.equal(report.jobs,6);assert.equal(report.workers,2);assert.equal(report.maps.length,2);assert.equal(yields,6);assert.equal(completed,1);assert.equal(s.active,'home');assert.equal(s.coins,96,'Two harvest bonuses, two seed charges and two water charges');
 for(const f of [s.farms.east,s.farms.west]){const p=f.objects[0];assert.equal(f.inventory.carrot,3);assert.equal(p.plantedAt,now,'Replant starts now, without fictitious offline cycles');assert.equal(p.crop,'carrot');assert(p.wateredUntil>now)}
 assert.equal(await ret.catchUp(a,now-120000,now),null,'Same return cursor cannot be replayed');assert.equal(completed,1);
 now+=120000;well.autoWater=false;for(const d of Object.values(s.workforce)){d.jobs=0;d.drinkUntil=0}
 const noWater=await ret.catchUp(a,now-120000,now);assert.equal(noWater.jobs,4,'No watering without a farm licence');assert.equal(s.farms.east.objects[0].wateredUntil,0);
 now+=120000;s.coins=0;for(const f of [s.farms.east,s.farms.west]){f.objects[0].plantedAt=0;f.objects[0].stage=1}for(const d of Object.values(s.workforce))d.jobs=0;
 assert.equal((await ret.catchUp(a,now-120000,now)).jobs,0);assert.equal(s.coins,0,'No negative seed balance');
 now+=120000;s.coins=100;let checked=0;a.reachable=()=>{checked++;return false};a.task=(role,skip)=>({id:'blocked-'+skip.size,helperAction:'plant'});assert.equal((await ret.catchUp(a,now-120000,now)).jobs,0);assert.equal(checked,64,'Path search capped at 32 candidates per worker');
 now+=120000;a.task=work.task;a.reachable=()=>true;a.yieldFrame=async()=>{document.hidden=true};const interrupted=await ret.catchUp(a,now-120000,now);assert.equal(interrupted.jobs,1,'Backgrounding halts the return pass');document.hidden=false;
 now+=120000;a.save=()=>{throw Error('Disk unavailable')};await assert.rejects(()=>ret.catchUp(a,now-120000,now),/Disk unavailable/);assert.equal(ret.running(),false,'Save failure releases the worker lock');
 const none={...a,save(){},workers:()=>[]};now+=120000;assert.equal(await ret.catchUp(none,now-120000,now),null);
 // Heavy-farm selection passes only flowers to growth calculations, avoiding a full object scan per plot.
 let calls=0,scanned=0;scope.window.meadowCropGrowth.calculate=(p,c,objects)=>{calls++;scanned+=objects.length;return {stage:1}};
 const heavy=s.farms.east;heavy.objects=Array.from({length:600},(_,i)=>({...field('p'+i),plantedAt:now})).concat(Array.from({length:400},(_,i)=>({id:'d'+i,type:'decoration'})),[{id:'flower',type:'flowers'}]);
 work.task('all',new Set(),'east');assert.equal(calls,600);assert.equal(scanned,600,'600 plots inspect 600 flower candidates rather than 600,600 map objects');
 console.log('Worker returns: multi-map harvest/replant/water, exact costs, licence and cash guards, capped work/path search, no replay, interruption, save failure and heavy-farm flower scan passed.');
})().catch(error=>{console.error(error);process.exitCode=1});
