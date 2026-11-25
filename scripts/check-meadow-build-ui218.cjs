const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),game=fs.readFileSync('meadow-and-market/game.js','utf8');
const start=game.indexOf('  function showCollectionItem('),end=game.indexOf('  function showItemDetails(',start),source=game.slice(start,end);
function harness(online){const item={id:'treasure',type:'collection_001'},farm={objects:[item]},state={selected:item.id,moving:item.id,lastMove:{id:item.id}},button={},calls=[];
 const c={window:{meadowCollections:{item:()=>({name:'Rose arch',rarity:'common',set:'Garden',art:'arch.webp'})}},state,current:()=>farm,escapeHtml:x=>x,footprint:()=>({w:2,h:1}),openModal:()=>{},$:s=>s==='#collection-put-away'?button:{close:()=>calls.push('closed')},command:(type,id,data,after)=>{calls.push({type,id,data,after});return online;},save:()=>calls.push('save'),render:()=>calls.push('render'),notify:()=>calls.push('notice')};vm.runInNewContext(source,c);c.showCollectionItem(item);return{c,state,farm,button,calls};}
const online=harness(true);online.button.onclick();assert.equal(online.farm.objects.length,1);assert.equal(online.state.selected,'treasure');assert.equal(online.calls.length,1);assert.equal(online.calls[0].type,'build.put_away');assert.equal(online.calls[0].id,'treasure');online.farm.objects=[];online.state.lastMove=null;online.calls[0].after();assert.equal(online.state.selected,null);assert(online.calls.includes('closed'));assert(!online.calls.includes('save'),'Acknowledged canonical removal must not upload a local snapshot');
const offline=harness(false);offline.button.onclick();assert.equal(offline.farm.objects.length,0);assert.equal(offline.state.lastMove,null);assert(offline.calls.includes('save'));
console.log('Decoration detail button waits for verified removal and preserves legacy storage; move/rotation/sale command routes remain present.');
for(const type of ['build.move','build.rotate','build.sell'])assert(game.includes(type));

// Exercise the actual action-button flow: placement must not retain an
// interactive toolbar over a nearby destination tile.
function actionElement(tag){return {tag,children:[],dataset:{},style:{},attributes:{},hidden:false,offsetWidth:400,offsetHeight:100,append(...nodes){this.children.push(...nodes)},setAttribute(k,v){this.attributes[k]=String(v)},removeAttribute(k){delete this.attributes[k];if(k==='data-object-id')delete this.dataset.objectId},getAttribute(k){return this.attributes[k]},addEventListener(){},querySelector(selector){if(selector==='span')return this.label||(this.label={textContent:''});const action=selector.match(/data-object-action="([^"]+)"/);return action?this.children.find(n=>n.dataset.objectAction===action[1]):null},getBoundingClientRect(){return {left:0,top:0,right:1000,bottom:700,width:1000,height:700}}};}
const actionScene=actionElement('scene'),actionCalls=[];let actionItem={id:'well',type:'well'},actionMoving=false,actionVisible=true;
const actionWindow={addEventListener(){},meadowRotations:{entry:()=>({})},meadowAudio:{play:()=>actionCalls.push('tap')}};
vm.runInNewContext(fs.readFileSync('meadow-and-market/build-actions.js','utf8'),{window:actionWindow,document:{createElement:actionElement,querySelector:()=>null},requestAnimationFrame:()=>1,cancelAnimationFrame(){}});
actionWindow.meadowBuildActions.attach({scene:actionScene,item:()=>actionItem,name:()=> 'Family well · 1×1',visible:()=>actionVisible,moving:()=>actionMoving,element:()=>({getBoundingClientRect:()=>({left:400,right:500,top:200,bottom:300})}),sale:()=>({gold:10}),details:()=>actionCalls.push('details'),move:()=>{actionCalls.push('move');actionMoving=true},rotate:()=>actionCalls.push('rotate'),sell:()=>actionCalls.push('sell')});
const actionBar=actionScene.children[0];assert.equal(actionBar.hidden,false);assert.equal(actionBar.dataset.objectId,'well');
actionBar.querySelector('[data-object-action="move"]').onclick({stopPropagation(){}});
assert.equal(actionMoving,true);assert.equal(actionBar.hidden,true,'Move must clear the toolbar from destination tiles');assert.equal(actionBar.dataset.objectId,undefined);assert.deepEqual(actionCalls,['tap','move']);
actionMoving=false;actionWindow.meadowBuildActions.refresh();assert.equal(actionBar.hidden,false,'Finishing or cancelling a move restores selected-item controls');assert.equal(actionBar.dataset.objectId,'well');
actionVisible=false;actionWindow.meadowBuildActions.refresh();assert.equal(actionBar.hidden,true,'Leaving Build keeps the toolbar hidden');
actionVisible=true;actionItem=null;actionWindow.meadowBuildActions.refresh();assert.equal(actionBar.hidden,true,'A removed item cannot retain controls');
console.log('Actual selected-item Move hides the toolbar until placement/cancellation; inspect, exit and missing-item states passed.');

const trayStart=game.indexOf('  function renderBuildTray('),trayEnd=game.indexOf('const contentKey=',trayStart),rotateStart=game.indexOf('  function rotatePlacement(');
assert(trayStart>=0&&trayEnd>trayStart&&rotateStart>=0);
const turnButtons={'build-turn-left':{},'build-turn-right':{}},trayNodes={'#build-tray':{},'#build-mode-pill':{}},previewCalls=[];
const preview={state:{mode:'build',selected:'barn',moving:'barn',placing:null},pendingTransfer:null,moveRotation:null,placingRotation:0,document:{getElementById:id=>turnButtons[id]},$:id=>trayNodes[id],window:{meadowRotations:{entry:()=>({}),angle:o=>(o.rotation+4)%4}},clearPlacementPreview:()=>previewCalls.push('clear'),notify:()=>previewCalls.push('notice')};
preview.placementItem=()=>({id:'barn',type:'barn',rotation:preview.moveRotation??0});
vm.runInNewContext(game.slice(rotateStart,trayStart)+game.slice(trayStart,trayEnd)+'}',preview);
preview.renderBuildTray();for(const b of Object.values(turnButtons))assert.equal(b.disabled,false,'Moving footprints keep mobile rotation available');
preview.rotatePlacement(1);assert.equal(preview.moveRotation,1,'Turn right changes only the placement preview');assert.equal(preview.state.moving,'barn');
preview.rotatePlacement(-1);assert.equal(preview.moveRotation,0);assert.equal(previewCalls.filter(v=>v==='clear').length,2);
preview.state.moving=null;preview.renderBuildTray();for(const b of Object.values(turnButtons))assert.equal(b.disabled,true,'Inspection does not enable preview rotation');
preview.state.selected=null;preview.state.placing='barn';preview.renderBuildTray();for(const b of Object.values(turnButtons))assert.equal(b.disabled,false,'New-build preview rotation stays available');
console.log('Actual tray/rotation functions preserve moving and new-build preview turns without changing canonical item placement.');
