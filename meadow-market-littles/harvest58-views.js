/* Illustrated actors and real journeys, driven only by the harvest rules. */
(() => {
  'use strict';
  const base='assets/generated/',own=base+'harvest58/',core=window.meadowHarvest58Core;
  const plural={apple:'apples',strawberry:'strawberries',pear:'pears',carrot:'carrots',corn:'corn',potato:'potatoes'};
  function picture(id){if(['hen','cow','sheep','goat'].includes(id))return base+id+'.webp';if(id==='basket')return base+'play-pieces/harvest-basket.webp';if(id==='canopy'||id==='trunk')return base+'play-pieces/tree-'+(id==='canopy'?'canopy':'trunk')+'.webp';if(['coop','barn','paddock','pedestal'].includes(id))return own+id+'.webp';return base+'minigames/produce/'+id+'.webp';}
  const img=(a,id,cls='',alt='')=>'<img draggable="false" src="'+picture(id)+'" class="'+cls+'" alt="'+a.esc(alt)+'">';
  const placed=(a,items)=>'<span class="hp-basket-food">'+items.map((id,i)=>img(a,id,'hp-stowed hp-position-'+i)).join('')+'</span>';
  const basket=(a,items,label='')=>img(a,'basket','hp-basket-art',label)+placed(a,items);
  const source=(a,id,index,style='',cls='')=>a.source(String(index),id+' '+(index+1),img(a,id,'',id),style,'hp-harvest-piece '+cls);
  function pieces(a,cls=''){const s=a.state;return s.items.map((id,i)=>s.moved.includes(i)?'':source(a,id,i,'left:'+(20+i%3*30)+'%;top:var(--hp-row-'+Math.floor(i/3)+','+((cls.includes('hp-sort-piece')?20:27)+Math.floor(i/3)*(cls.includes('hp-sort-piece')?23:27))+'%)',cls)).join('');}
  const title=(a,content)=>'<div class="hp-goal">'+content+'</div>';
  const dockNote=text=>'<span class="hp-dock-note">'+text+'</span>';
  const helper=(a,id='sheep')=>'<div class="hp-helper">'+img(a,id,'','Your farm friend')+'</div>';
  function fromSource(a,key){const button=a.root.querySelector('[data-source="'+CSS.escape(String(key))+'"]'),n=button?.querySelector('img');return n?{rect:n.getBoundingClientRect(),url:n.src,content:button.classList.contains('hp-full-basket')?button.innerHTML:null}:null;}
  async function flight(a,start,end,walking=false){if(!start||!end)return;const box=a.root.getBoundingClientRect(),to=end.getBoundingClientRect(),node=document.createElement(start.content?'div':'img');if(start.content)node.innerHTML=start.content;else{node.src=start.url;node.alt='';}node.className='hp-flight';node.setAttribute('aria-hidden','true');node.style.cssText='left:'+(start.rect.left-box.left)+'px;top:'+(start.rect.top-box.top)+'px;width:'+start.rect.width+'px;height:'+start.rect.height+'px';a.root.append(node);const dx=to.left+to.width/2-start.rect.left-start.rect.width/2,dy=to.top+to.height/2-start.rect.top-start.rect.height/2,scale=Math.min(1,to.width/start.rect.width*.72);const frames=walking?[0,.2,.4,.6,.8,1].map((t,i)=>({transform:'translate('+dx*t+'px,'+(dy*t-(i%2?10:0))+'px) scale('+(1-(1-scale)*t)+') rotate('+(i%2?3:-3)+'deg)',offset:t})):[{transform:'translate(0,0) scale(1)'},{transform:'translate('+dx*.5+'px,'+(dy*.5-35)+'px) scale(1.1)',offset:.5},{transform:'translate('+dx+'px,'+dy+'px) scale('+scale+')'}];await a.animate(node,frames,walking?1150:620);node.remove();}
  async function deliver(a){const b=a.board.querySelector('.hp-main-basket'),friend=a.board.querySelector('.hp-helper');if(b&&friend){const x=friend.getBoundingClientRect(),y=b.getBoundingClientRect();await a.animate(b,[{transform:'translate(-50%,-50%)'},{transform:'translate(calc(-50% + '+(x.left-y.left)+'px),calc(-50% + '+(x.top-y.top)+'px)) scale(.55)',opacity:0}],900);await a.animate(friend,[{transform:'translate(-50%,-50%)'},{transform:'translate(-50%,calc(-50% - 18px))',offset:.5},{transform:'translate(-50%,-50%)'}],450);}}
  async function move(a,key,target){const start=fromSource(a,key),item=Number(key);await a.run('place',{item,target},async r=>{if(!r.ok)return;const targetNode=a.board.querySelector('[data-target="'+CSS.escape(String(target))+'"], [data-home="'+CSS.escape(String(target))+'"]'),arrived=a.model.kind==='home'?targetNode?.closest('.hp-animal-home')?.querySelector('.hp-resident:last-child'):targetNode?.querySelector('.hp-stowed:last-child');if(arrived)arrived.style.visibility='hidden';await flight(a,start,arrived||targetNode,a.model.kind==='home');if(arrived){arrived.style.visibility='visible';await a.animate(arrived,[{scale:'.7'},{scale:'1.12',offset:.6},{scale:'1'}],250);}if(a.model.kind==='count'){const seconds=await a.speak('harvest58-rhys-number-'+a.state.moved.length);if(r.phaseChanged){if(seconds)await a.wait((seconds+.12)*1000);a.speak('harvest58-rhys-count-answer');}}if(a.model.kind==='order'&&!r.done)a.speak('harvest58-jay-word-'+a.state.order[a.state.moved.length]);if(r.done&&['pick','order'].includes(a.model.kind))await deliver(a);if(r.done&&a.model.kind==='home')await a.animate(a.board,[{filter:'brightness(1)'},{filter:'brightness(1.13)',offset:.5},{filter:'brightness(1)'}],650);});}
  const sharedAssets=['basket',...['apple','strawberry','pear','carrot','corn','potato']].map(picture);
  const views={picture};
  views.pick={
    assets:[...sharedAssets,picture('sheep')],
    board(a){const s=a.state;return title(a,img(a,s.wanted)+'<strong>Pick '+plural[s.wanted]+'</strong><span>'+s.moved.length+' / '+s.needed+'</span>')+pieces(a)+a.target('basket','Harvest basket',basket(a,s.moved.map(i=>s.items[i])),'','hp-main-basket')+helper(a);},
    dock(){return dockNote('Pick the matching harvest. Carry it to the basket.');},
    note(a){return 'Bring '+plural[a.state.wanted]+' to your basket.';},
    cue(a){return 'harvest58-jade-pick-'+a.state.wanted;},
    instructions(a,opening){return [...(opening?['harvest58-jade-pick-intro']:[]),this.cue(a)];},
    drop:move,retry(a){return 'We are picking '+plural[a.state.wanted]+'. Try another piece.';}
  };
  views.order={
    assets:[...sharedAssets,...['sheep','goat','cow'].map(picture)],
    board(a){const s=a.state;return title(a,'<span class="hp-order-list">'+s.order.map((id,i)=>'<span class="'+(i<s.moved.length?'packed':i===s.moved.length?'next':'')+'">'+img(a,id,'',id)+'<b>'+(i<s.moved.length?'✓':i+1)+'</b></span>').join('')+'</span>')+pieces(a)+a.target('basket','Order basket',basket(a,s.moved.map(i=>s.items[i])),'','hp-main-basket')+helper(a,s.friend);},
    dock(){return dockNote('Listen, pack in order, then deliver together.');},
    note(a){return 'Next in the order: '+(a.state.order[a.state.moved.length]||'Ready to deliver!');},
    instructions(a,opening){return [...(opening?['harvest58-jay-order-intro']:[]),...a.state.order.map(id=>'harvest58-jay-word-'+id)];},
    drop:move,retry(){return 'Listen to the order again. The next picture has a golden glow.';}
  };
  views.home={
    assets:[...['coop','barn','paddock','hen','cow','sheep','goat'].map(picture)],
    board(a){const s=a.state;return ['coop','barn','paddock'].map((id,i)=>'<div class="hp-animal-home hp-home-'+id+'" data-home="'+id+'" style="left:'+[27,74,28][i]+'%;top:'+[21,48,77][i]+'%">'+img(a,id,'hp-home-art')+'<span class="hp-residents">'+s.moved.filter(n=>core.home(s.items[n])===id).map(n=>img(a,s.items[n],'hp-resident','Home safe')).join('')+'</span>'+a.target(id,({coop:'Cosy chicken coop',barn:'Red cow barn',paddock:'Grassy sheep and goat paddock'})[id],'','','hp-home-door')+'</div>').join('');},
    dock(a){return '<div class="hp-animal-tray">'+a.state.items.map((id,i)=>a.state.moved.includes(i)?'':source(a,id,i,'','hp-animal-piece')).join('')+'</div>';},
    note(a){return 'Guide each friend home. '+a.state.moved.length+' / 3 friends home.';},
    drop:move,retry(){return 'Hens: coop. Cows: barn. Sheep and goats: grassy paddock.';}
  };
  views.sort={
    assets:sharedAssets,
    board(a){const s=a.state;return pieces(a,'hp-sort-piece')+['fruit','vegetable'].map((bin,i)=>a.target(bin,bin==='fruit'?'Fruit basket':'Vegetable basket',basket(a,s.bins[bin])+'<span class="hp-bin-label">'+img(a,bin==='fruit'?'apple':'carrot')+'<b>'+(bin==='fruit'?'Fruit':'Vegetables')+'</b></span>','left:'+(i?75:25)+'%;','hp-sort-basket')).join('');},
    dock(a){return dockNote(a.state.moved.length+' / '+a.state.items.length+' sorted');},
    note(){return 'Carry the fruit and vegetables to their matching baskets.';},
    drop:move,retry(){return 'Look at the little picture on each basket. Have another try.';}
  };
  views.count={
    assets:[...sharedAssets,picture('canopy'),picture('trunk')],
    board(a){const s=a.state,coords=[[25,30],[75,30],[50,15],[23,60],[77,60]];return '<div class="hp-count-tree">'+img(a,'trunk','hp-tree-trunk')+img(a,'canopy','hp-tree-canopy')+s.items.map((id,i)=>s.moved.includes(i)?'':source(a,id,i,'left:'+coords[i][0]+'%;top:'+coords[i][1]+'%;','hp-tree-apple')).join('')+'</div>'+a.target('basket','Apple counting basket',basket(a,s.moved.map(()=> 'apple')),'','hp-main-basket hp-count-basket')+a.target('label','Number label on the basket',s.answer===null?'?':s.answer,'','hp-number-label')+'<span class="hp-count-total" aria-live="polite">'+s.moved.length+' picked</span>';},
    dock(a){return '<div class="hp-number-tray">'+a.state.choices.map(n=>a.source('number-'+n,'Number '+n,'<strong>'+n+'</strong>','','hp-number-piece'+(a.state.moved.length<a.state.count?' hp-waiting-number':''))).join('')+'</div>';},
    afterRender(a){if(a.state.moved.length<a.state.count){a.root.querySelector('[data-target="label"]').disabled=true;a.root.querySelectorAll('[data-source^="number-"]').forEach(n=>n.disabled=true);}},
    note(a){return a.state.moved.length===a.state.count?'How many apples? Move the matching number to the label.':'Pick every apple from our little tree. Count together!';},
    cue(a){return 'harvest58-rhys-count-'+(a.state.moved.length===a.state.count?'answer':'intro');},
    drop(a,key,target){if(key.startsWith('number-')&&target!=='label')return a.change('answer',{number:NaN});if(key.startsWith('number-'))return a.run('answer',{number:Number(key.slice(7))},async r=>{if(r.ok)await a.animate(a.board.querySelector('.hp-number-label'),[{transform:'translate(-50%,-50%) scale(.5)'},{transform:'translate(-50%,-50%) scale(1.25)',offset:.6},{transform:'translate(-50%,-50%) scale(1)'}],650);});return move(a,key,target);},
    retry(){return 'Count the apples in the basket. You can try another number.';}
  };
  const basketSource=(a,i)=>a.source(String(i),'Basket '+(i+1)+' with '+a.state.amounts[i]+' apple'+(a.state.amounts[i]===1?'':'s'),basket(a,Array(a.state.amounts[i]).fill('apple'),'Basket '+(i+1)+' with '+a.state.amounts[i]+' apples'),'','hp-full-basket');
  views.fuller={
    assets:[...sharedAssets,picture('pedestal')],
    board(a){const s=a.state,ready=s.slots.every(v=>v!==null),angle=ready?(s.amounts[s.slots[0]]>s.amounts[s.slots[1]]?-11:11):0;return title(a,'<strong>'+(ready?'Which basket has more apples?':'Put both baskets on the scales')+'</strong>')+'<div class="hp-scale">'+img(a,'pedestal','hp-scale-base')+'<div class="hp-scale-arm" style="--hp-angle:'+angle+'deg"><div class="hp-scale-beam"></div>'+s.slots.map((item,side)=>'<div class="hp-scale-pan hp-pan-'+side+'">'+(item===null?a.target(String(side),(side?'Right':'Left')+' side of the scales','<span class="hp-pan-ring"></span>','','hp-empty-pan'):a.button('Choose basket '+(item+1)+' with '+s.amounts[item]+' apple'+(s.amounts[item]===1?'':'s'),'choose:'+item,basket(a,Array(s.amounts[item]).fill('apple')),'hp-loaded-basket'))+'</div>').join('')+'</div></div>';},
    dock(a){if(a.state.slots.every(v=>v!==null))return dockNote('Touch the basket with more apples.');return '<div class="hp-basket-tray">'+[0,1].filter(i=>!a.state.slots.includes(i)).map(i=>basketSource(a,i)).join('')+'</div>';},
    note(a){return a.state.slots.every(v=>v!==null)?'Touch the fuller basket. More apples make a heavier basket.':'Move one apple basket onto each side of the scales.';},
    cue(a){return 'harvest58-rhys-fuller-'+(a.state.slots.every(v=>v!==null)?'compare':'intro');},
    async drop(a,key,target){const start=fromSource(a,key);return a.run('place',{item:Number(key),target:Number(target)},async r=>{if(!r.ok)return;const arm=a.board.querySelector('.hp-scale-arm'),pans=[...a.board.querySelectorAll('.hp-scale-pan')];if(r.phaseChanged){arm.style.transform='rotate(0deg)';for(const pan of pans)pan.style.transform='translate(-50%,-50%) rotate(0deg)';}const dest=a.board.querySelector('.hp-pan-'+target),loaded=dest?.querySelector('.hp-loaded-basket');if(loaded)loaded.style.visibility='hidden';await flight(a,start,dest);if(loaded)loaded.style.visibility='visible';if(r.phaseChanged){const angle=a.state.amounts[a.state.slots[0]]>a.state.amounts[a.state.slots[1]]?-11:11;await Promise.all([a.animate(arm,[{transform:'rotate(0deg)'},{transform:'rotate('+(angle*1.12)+'deg)',offset:.7},{transform:'rotate('+angle+'deg)'}],800),...pans.map(pan=>a.animate(pan,[{transform:'translate(-50%,-50%) rotate(0deg)'},{transform:'translate(-50%,-50%) rotate('+(-angle*1.12)+'deg)',offset:.7},{transform:'translate(-50%,-50%) rotate('+(-angle)+'deg)'}],800))]);a.speak('harvest58-rhys-fuller-compare');}});},
    action(a,key){if(!key.startsWith('choose:'))return;a.run('choose',{item:Number(key.split(':')[1])},async r=>{if(r.ok)await a.animate(a.board.querySelector('[data-action="'+key+'"]'),[{filter:'brightness(1)'},{filter:'brightness(1.2)',transform:'translateY(-16px)',offset:.5},{filter:'brightness(1)',transform:'translateY(0)'}],700);});},
    retry(a){return a.state.slots.every(v=>v!==null)?'The basket with more apples goes lower. Try that basket.':'Put both baskets on the scales first.';}
  };
  for(const [kind,v] of Object.entries(views)){if(kind==='picture')continue;if(!v.instructions)v.instructions=(a)=>[v.cue?.(a)||'harvest58-'+core.catalog.find(g=>g.kind===kind).farmer+'-'+kind+'-intro'];}
  window.meadowHarvest58Views=views;
})();
