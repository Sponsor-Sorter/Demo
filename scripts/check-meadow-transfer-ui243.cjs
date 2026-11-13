const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('meadow-and-market/game.js','utf8');
const code=source.slice(source.indexOf('  function completeTransfer(x,y){'),source.indexOf('  function objectClick('));
function fixture(type='chicken',native=true,full=false){
 const animal={id:'traveller',type,x:1,y:2,lastProductAt:123,packEggMs:2500},home={id:'home',type:type==='chicken'?'coop':'barn',x:4,y:3,w:2,h:2};
 const farms={source:{objects:[animal]},destination:{objects:[home,...(full?[{id:'resident',type,coopId:'home'}]:[])]}},calls=[];
 const scope={pendingTransfer:{source:'source',destination:'destination',id:animal.id,item:{...animal}},state:{active:'destination',farms},current:()=>farms.destination,isAnimal:o=>['chicken','cow'].includes(o.type),footprint:o=>({w:o.w||1,h:o.h||1}),command:(...args)=>{calls.push(args);return native},cancelTransfer(){throw Error('Unexpected cancellation')},render(){},notify:message=>calls.push(message),clearPlacementPreview(){},$:()=>({remove(){}}),fitsFootprint:()=>false,previewPlacement(){},crops:{},uid:()=> 'renamed',save(){},guideEvent(){},def:()=>({name:type}),window:{meadowCropGrowth:{settle(){}},meadowApiary:{settleAll(){}}}};
 vm.createContext(scope);vm.runInContext(fs.readFileSync('meadow-and-market/housing.js','utf8'),scope);vm.runInContext(fs.readFileSync('meadow-and-market/moves.js','utf8'),scope);vm.runInContext(code,scope);
 return {scope,animal,home,farms,calls,move:(x=4,y=3)=>scope.completeTransfer(x,y)};
}
for(const type of ['chicken','cow']){
 const f=fixture(type);f.move(5,4);assert.equal(f.calls[0][0],'build.move');assert.equal(f.calls[0][2].home,'home');assert.equal(f.calls[0][2].destination,'destination');assert.equal(f.calls[0][4],'source');assert(f.farms.source.objects.includes(f.animal),'A pending command must retain the source animal');
}
const grass=fixture();grass.move(8,7);assert(!('home' in grass.calls[0][2]));
const wrong=fixture();wrong.home.type='barn';wrong.move();assert(!('home' in wrong.calls[0][2]));
const offline=fixture('chicken',false);offline.move();assert(!offline.farms.source.objects.includes(offline.animal));assert(offline.farms.destination.objects.includes(offline.animal));assert.equal(offline.animal.coopId,'home');assert.equal(offline.animal.lastProductAt,123);assert.equal(offline.animal.packEggMs,2500);assert.equal(offline.scope.pendingTransfer,null);
const full=fixture('chicken',false,true);full.move();assert(full.farms.source.objects.includes(full.animal));assert.equal(full.farms.destination.objects.length,2);assert(full.scope.pendingTransfer);assert(full.calls.includes('That animal home is full'));
console.log('Cross-farm UI: compatible homes, clear grass, incompatible homes, pending source safety, offline assignment, preserved progress and full-home rejection passed.');
