(() => {
  'use strict';
  function snapshot(o){return {x:o.x,y:o.y,home:o.coopId||o.barnId||o.paddockId||null}}
  function remember(state,map,o,from=snapshot(o)){state.lastMove={map,id:o.id,from:{...from}}}
  function syncResidents(farm,home){if(!['coop','barn','paddock'].includes(home.type))return;for(const a of farm.objects)if([a.coopId,a.barnId,a.paddockId].includes(home.id)){a.x=home.x;a.y=home.y}}
  function undo(state,farm,rules){
    const m=state.lastMove;if(!m||m.map!==rules.map)return {ok:false,message:'Return to the farm where you moved that item.'};
    const o=farm.objects.find(o=>o.id===m.id),from=m.from;if(!o||!Number.isFinite(from?.x)||!Number.isFinite(from?.y))return {ok:false,message:'That move is no longer available.'};
    const home=from.home?farm.objects.find(h=>h.id===from.home):null;
    if(from.home&&(!home||!rules.canHouse(o,home)))return {ok:false,message:'The original animal home needs a free space first.'};
    if(!from.home&&!rules.canPlace(o,from.x,from.y))return {ok:false,message:'Clear the original tiles before undoing this move.'};
    rules.settle();
    if(rules.isAnimal(o)){if(!rules.assign(o,home,()=>({x:from.x,y:from.y})))return {ok:false,message:'That animal could not return to its original place.'}}
    else{o.x=from.x;o.y=from.y}
    syncResidents(farm,o);state.lastMove=null;return {ok:true,object:o};
  }
  window.meadowMoves={snapshot,remember,syncResidents,undo};
})();
