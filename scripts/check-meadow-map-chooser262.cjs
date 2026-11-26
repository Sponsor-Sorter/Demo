'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..'),game=fs.readFileSync(path.join(root,'meadow-and-market/game.js'),'utf8'),css=fs.readFileSync(path.join(root,'meadow-and-market/style.css'),'utf8');
const fit=game.match(/^  function fitPlacePreview\([^\n]+/m)?.[0],render=game.match(/^  function renderPlacePreviews\([^\n]+/m)?.[0];
assert(fit&&render,'Use the actual saved-farm preview layout and observer functions');
const callbacks={},painted=[],closed=[],boxes=[];
function box(id,width,height){const grid={id},stage={style:{},querySelector:()=>grid,insertAdjacentHTML:(_,html)=>painted.push([id,html])};return{dataset:{previewMap:id},clientWidth:width,clientHeight:height,firstElementChild:stage};}
const dialog={addEventListener:(event,fn)=>{assert.equal(event,'close');closed.push(fn)}},list={closest:()=>dialog,querySelectorAll:()=>boxes};
const scope={state:{farms:{willow:{},coast:{}}},gridRender:(grid,id)=>painted.push([id,grid.id]),window:{meadowJourney:{previewArt:()=>'<span>town</span>'}},ResizeObserver:class{constructor(fn){callbacks.resize=fn;this.targets=[];callbacks.resizeObserver=this}observe(b){this.targets.push(b)}disconnect(){this.disconnected=true}},IntersectionObserver:class{constructor(fn,options){callbacks.visible=fn;assert.equal(options.root,dialog);callbacks.visibilityObserver=this}observe(){}unobserve(){}disconnect(){this.disconnected=true}}};
vm.createContext(scope);vm.runInContext(fit+'\n'+game.match(/^  let placePreviewObserver,placePreviewVisibility;/m)[0]+'\n'+render,scope);
let checks=0;
function contained(b,width=b.clientWidth,height=b.clientHeight){const text=b.firstElementChild.style.transform,m=text.match(/^translate\(([-\d.e]+)px,([-\d.e]+)px\) scale\(([-\d.e]+)\)$/);assert(m,text);const[x,y,s]=m.slice(1).map(Number);assert(s>0&&Number.isFinite(s));assert(x>=-1e-8&&y>=-1e-8);assert(x+1536*s<=width+1e-8&&y+1024*s<=height+1e-8,'The complete map and placed items remain inside the preview');assert(Math.abs(2*x+1536*s-width)<1e-7&&Math.abs(2*y+1024*s-height)<1e-7,'Letterboxing is centered');checks++;}
for(const[w,h]of [[128,85],[142,94],[165,110],[360,156],[480,192],[494,280],[620,104],[230,96],[640,256],[128,256]]){const b=box('willow',w,h);scope.fitPlacePreview(b);contained(b);}
boxes.push(box('willow',480,192),box('coast',142,94),box('town',360,156));scope.renderPlacePreviews(list);boxes.forEach(b=>contained(b));assert.equal(callbacks.resizeObserver.targets.length,3);
callbacks.visible(boxes.map(target=>({target,isIntersecting:true})));callbacks.visible(boxes.map(target=>({target,isIntersecting:true})));assert.deepEqual(painted,[['willow','willow'],['coast','coast'],['town','<span>town</span>']],'Keep each actual farm/town renderer and lazy-paint once');
callbacks.resize([{target:boxes[0],contentRect:{width:620,height:104}}]);contained(boxes[0],620,104);const prior=boxes[0].firstElementChild.style.transform;callbacks.resize([{target:boxes[0],contentRect:{width:0,height:0}}]);assert.equal(boxes[0].firstElementChild.style.transform,prior,'Hidden resize must not generate an invalid transform');closed[0]();assert(callbacks.resizeObserver.disconnected&&callbacks.visibilityObserver.disconnected);
assert.match(css,/#maps-dialog \.map-list\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)[^}]*overflow-y:auto[^}]*touch-action:pan-y/);
assert.match(css,/#maps-dialog \.map-option\{[^}]*touch-action:pan-y/);
assert.match(css,/#maps-dialog \.map-option-preview,#maps-dialog \.map-place-preview\{[^}]*grid-row:2[^}]*max-height:clamp\(88px,40dvh,280px\)[^}]*aspect-ratio:3\/2/);
assert.match(css,/#maps-dialog \.map-place-preview,#maps-dialog \.map-place-preview \*\{pointer-events:none!important;touch-action:pan-y!important\}/,'Preview artwork must not consume vertical scrolling or map-card taps');
console.log(`Map chooser: ${checks} complete-map bounds; actual resize/lazy-paint/close lifecycle and source scroll contracts passed. Browser and native viewport/touch acceptance remain separate.`);
