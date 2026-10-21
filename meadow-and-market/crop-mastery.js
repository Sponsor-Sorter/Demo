(() => {
 'use strict';
 const crops=['carrot','wheat','strawberry','corn','tomato','lavender','pumpkin','mushroom'];
 const ranks=[{tiles:0,name:'Learning the rows',discount:0,bonus:0},{tiles:20,name:'Seed saver',discount:5,bonus:0},{tiles:80,name:'Skilled grower',discount:5,bonus:1},{tiles:200,name:'Meadow expert',discount:10,bonus:1},{tiles:500,name:'Master grower',discount:10,bonus:2}];
 let api;
 const finite=n=>Number.isFinite(Number(n))?Math.max(0,Math.min(1000000000,Math.floor(Number(n)))):0;
 function tiles(state,id){return crops.includes(id)?finite(state.cropMastery?.tiles?.[id]):0}
 function status(state,id){const count=tiles(state,id);let rank=0;for(let i=1;i<ranks.length;i++)if(count>=ranks[i].tiles)rank=i;const next=ranks[rank+1];return {...ranks[rank],rank:rank+1,count,next,progress:next?(count-ranks[rank].tiles)/(next.tiles-ranks[rank].tiles):1}}
 function record(state,id,area){if(!crops.includes(id)||!Number.isInteger(area)||area<1||area>16)return null;const before=status(state,id);state.cropMastery||={tiles:{}};state.cropMastery.tiles||={};state.cropMastery.tiles[id]=Math.min(1000000000,before.count+area);return {before,after:status(state,id)}}
 function bonus(state,id){return status(state,id).bonus}
 function seedCost(state,id,base){if(!Number.isFinite(base)||base<0)return 0;return Math.ceil(base*(100-status(state,id).discount)/100)}
 function benefits(r){return [r.discount?r.discount+'% cheaper seeds':'',r.bonus?'+'+r.bonus+' crop'+(r.bonus>1?'s':'')+' per tile':''].filter(Boolean).join(' · ')||'Harvest to grow your skill'}
 function card(id,state){const r=status(state,id),name=api.items[id].name;return '<button class="mastery-card" data-mastery-crop="'+id+'"><span class="book-plant"><img src="assets/generated/crop-growth/'+id+'.webp" alt=""></span><strong>'+name+'</strong><span class="mastery-rank">Rank '+r.rank+' · '+r.name+'</span><progress value="'+r.progress+'" max="1" aria-label="'+name+' mastery progress"></progress><small>'+r.count.toLocaleString()+' tile'+(r.count===1?'':'s')+' harvested'+(r.next?' · '+(r.next.tiles-r.count).toLocaleString()+' to rank '+(r.rank+1):' · mastered')+'</small><small>'+benefits(r)+'</small></button>'}
 function show(id){
  const state=api.state(),chosen=crops.includes(id)?id:null,r=chosen?status(state,chosen):null;
  api.modal('<div class="sheet-head mastery-head"><div><small class="eyebrow">FARMER JADE’S GROWING NOTES</small><h2>'+(chosen?api.items[chosen].name+' mastery':'Crop mastery')+'</h2></div><button class="small-button mastery-listen" id="mastery-listen" aria-label="Farmer Jade: crop mastery">🔊</button><button class="close-button" data-close="modal-dialog">×</button></div><details class="flow-details"><summary>How mastery works</summary><p class="sheet-copy">Each harvested tile earns one point. Farmer Jade’s harvests count across every farm; bought goods and mini-game prizes do not.</p></details>'+(chosen?'<div class="mastery-focus">'+card(chosen,state)+'</div><div class="mastery-steps">'+ranks.map((step,i)=>'<div class="mastery-step '+(r.rank>i?'mastery-earned':'')+'"><strong>'+(r.rank>i?'✓ ':'')+'Rank '+(i+1)+' · '+step.name+'</strong><small>'+step.tiles+' tiles harvested</small><span>'+benefits(step)+'</span></div>').join('')+'</div><button class="primary-button full-button" id="mastery-grow">Find where to grow '+api.items[chosen].name.toLowerCase()+'</button><button class="soft-link full-button" id="mastery-all">All crops</button>':'<div class="mastery-grid">'+crops.map(id=>card(id,state)).join('')+'</div>')+'<small class="sheet-copy">Progress starts with harvests after this update. Perks apply automatically. Seed savings round up to whole gold; bonus crops are added to the field and watering yield.</small>');
  document.querySelector('#mastery-listen').onclick=()=>window.meadowAudio?.speak('jade-crop-mastery128');
  document.querySelectorAll('[data-mastery-crop]').forEach(b=>b.onclick=()=>show(b.dataset.masteryCrop));
  document.querySelector('#mastery-grow')?.addEventListener('click',()=>api.find(chosen));
  document.querySelector('#mastery-all')?.addEventListener('click',()=>show());
  if(!state.cropMasteryHeard128){state.cropMasteryHeard128=true;api.save();window.meadowAudio?.speak('jade-crop-mastery128')}
 }
 window.meadowMastery={crops,ranks,tiles,status,record,bonus,seedCost,benefits,show,attach(a){api=a}};
})();
