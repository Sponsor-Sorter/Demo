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
// Dispatch the actual camera capture listener before the actual object listener.
// The roof's projected grass cell intentionally lies outside the destination home.
const bindStart=source.indexOf('  function bindObjectGesture('),bind=source.slice(bindStart,source.indexOf("  window.addEventListener('pointermove'",bindStart));
const helperStart=source.indexOf('  function placementCellForEvent('),helper=source.slice(helperStart,source.indexOf('  function clearPlacementPreview(',helperStart));
const captureStart=source.indexOf("cameraScene.addEventListener('click'"),capture=source.slice(captureStart,source.indexOf(";window.addEventListener('resize'",captureStart)+1);
const placeStart=source.indexOf('  function placeAt('),place=source.slice(placeStart,source.indexOf('  function plant(',placeStart));
function dispatch(type='chicken',target='coop',{pending=true,suppressed=false,bubbleOnly=false,skip=false}={}){
 const f=fixture(type),listeners={},el={dataset:{id:'home',...(skip?{skipClick:'true'}:{})},querySelectorAll:()=>[],addEventListener:(name,fn)=>listeners[name]=fn};f.home.type=target;
 Object.assign(f.scope,{state:{...f.scope.state,mode:'build',moving:pending?'transfer:traveller':null},pendingTransfer:pending?f.scope.pendingTransfer:null,camera:{suppressClick:suppressed},cameraScene:{addEventListener:(name,fn)=>listeners['capture:'+name]=fn},placementItem:()=>pending?f.animal:null,obj:id=>f.farms.destination.objects.find(o=>o.id===id),objectClick:id=>f.calls.push(['details',id]),isoCellFromPoint:(x,y)=>{assert.equal(x,210);assert.equal(y,120);return {x:8,y:7}}});f.scope.window.addEventListener=()=>{};
 vm.runInContext(helper+place+bind+capture,f.scope);f.scope.bindObjectGesture(el,f.home);
 let stopped=false;const event={clientX:210,clientY:120,target:{closest:selector=>selector==='.farm-object'?el:null},preventDefault(){},stopPropagation(){},stopImmediatePropagation(){stopped=true}};
 if(!bubbleOnly)listeners['capture:click'](event);if(!stopped)listeners.click(event);return {...f,stopped,el};
}
for(const [animal,home]of [['chicken','coop'],['cow','barn']]){for(const bubbleOnly of [false,true]){const f=dispatch(animal,home,{bubbleOnly});assert.equal(f.calls[0][0],'build.move');assert.equal(f.calls[0][2].home,'home');assert.equal(f.calls[0][2].x,4);assert.equal(f.calls[0][2].y,3);assert.equal(f.calls[0][4],'source');assert.equal(f.calls.length,1);assert(f.farms.source.objects.includes(f.animal));}}
const obstacle=dispatch('chicken','barn');assert(!('home' in obstacle.calls[0][2]));assert.equal(obstacle.calls[0][2].x,8);assert.equal(obstacle.calls[0][2].y,7);
assert.deepEqual(dispatch('chicken','coop',{pending:false}).calls,[['details','home']]);
assert.equal(dispatch('chicken','coop',{suppressed:true}).calls.length,0);
const skipped=dispatch('chicken','coop',{bubbleOnly:true,skip:true});assert.equal(skipped.calls.length,0);assert.equal(skipped.el.dataset.skipClick,undefined);
console.log('Cross-farm source safety, home capacity, assignment and progress preservation passed.');
console.log('Actual capture→placement→transfer and bubble paths: coop/barn roof anchors, incompatible obstacles, ordinary selection and drag suppression passed.');
