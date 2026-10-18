(() => {
  'use strict';
  let api;
  const livestock=type=>['cow','sheep','goat'].includes(type),tier=h=>Math.max(0,Math.min(3,Math.floor(Number(h.tier)||0)));
  function capacity(h){return h.type==='coop'?[1,3,5,7][tier(h)]:['barn','paddock'].includes(h.type)?[2,4,6,8][tier(h)]:0}
  function supports(type,h){return !!h&&(type==='chicken'?h.type==='coop':livestock(type)&&['barn','paddock'].includes(h.type))}
  function members(f,h){return f.objects.filter(a=>supports(a.type,h)&&(h.type==='coop'?a.coopId===h.id:h.type==='barn'?a.barnId===h.id:a.paddockId===h.id))}
  function canHouse(f,type,h,animal=null){return !!h&&f.objects.some(o=>o.id===h.id)&&supports(type,h)&&(members(f,h).length<capacity(h)||members(f,h).some(a=>a.id===animal?.id))}
  function assign(f,a,h,findSpace){
    let point;
    if(h){if(!canHouse(f,a.type,h,a))return false;point=h}
    else{point=findSpace?.(a);if(!point)return false}
    delete a.coopId;delete a.barnId;delete a.paddockId;
    a.x=point.x;a.y=point.y;
    if(h)a[h.type==='coop'?'coopId':h.type==='barn'?'barnId':'paddockId']=h.id;
    return true;
  }
  function choices(a){const f=api.current();return f.objects.filter(h=>canHouse(f,a.type,h,a)).map(h=>({id:h.id,label:api.name(h)+' · '+members(f,h).length+'/'+capacity(h)}))}
  function mount(h){const f=api.current(),space=capacity(h)-members(f,h).length,card=document.createElement('div');card.className='task-card animal-adoption';card.innerHTML='<h3>'+space+' free home spaces</h3><p>Add a friend straight to this home, or hold a roaming animal and drop it onto the home.</p><div class="home-adoption-actions">'+(h.type==='coop'?['chicken']:['cow','sheep','goat']).map(type=>{const item=api.item(type),locked=api.level()<(item.unlock||1);return '<button class="small-button" data-adopt="'+type+'" '+(!space||locked||api.coins()<item.price?'disabled':'')+'><img src="assets/generated/'+(type==='chicken'?'hen':type)+'.webp" alt="">'+item.name+'<small>'+(locked?'Level '+item.unlock:item.price?item.price+' gold':'Free')+'</small></button>'}).join('')+'</div>';document.querySelector('#modal-content .sheet-head').after(card);card.querySelectorAll('[data-adopt]').forEach(b=>b.onclick=()=>{if(api.adopt(b.dataset.adopt,h))api.showHome(h)})}
  window.meadowHousing={capacity,supports,members,canHouse,assign,choices,mount,attach(adapter){api=adapter}};
})();
