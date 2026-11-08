/* Small jobs with a beginning, hands-on work and a visible happy outcome. */
(() => {
  'use strict';
  const engine=window.meadowFarmAdventures,{rub,stage,laterPhase}=window.meadowFarmJourneys;
  const base='assets/generated/',piece=id=>base+'play-pieces/'+id+'.webp';
  const pictures={bale:piece('hay-bale'),leaves:piece('soft-leaves'),duck:piece('duck'),basket:piece('harvest-basket'),pond:piece('pond'),pad:piece('lily-pad')};
  const src=id=>pictures[id]||(['sheep','goat','cow'].includes(id)?base+id+'.webp':base+'minigames/produce/'+id+'.webp');
  const img=(id,cls='',alt='')=>'<img draggable="false" src="'+src(id)+'" class="'+cls+'" alt="'+alt+'">';
  const speak=(a,key)=>window.meadowJourneyAudio.instruction(a,key);
  const tray=(a,ids)=>ids.map(id=>a.piece(id,id[0].toUpperCase()+id.slice(1),src(id))).join('');
  const phase=(a,next)=>{a.journeyPhase=next;a.render();};
  const hay={
    assets:[base+'play-scenes/music-meadow.webp',src('sheep'),src('goat'),src('cow'),src('leaves')],
    render(a){
      a.journeyPhase ||= 'stack';const p=a.journeyPhase,sizes=['big','middle','little'],widths=[74,58,42],friend=['sheep','goat','cow'][a.round];a.wanted=sizes[a.parts.length];
      let body='<div class="fn-hay-tower">'+a.parts.map((id,i)=>'<span class="fn-bale" style="--layer:'+i+';width:'+widths[i]+'%">'+img('bale')+'</span>').join('')+'</div><div class="fn-bed '+(p==='rest'?'ready':'')+'">'+img('leaves')+'</div>';
      if(p==='stack'&&a.parts.length<3)body+=a.target('bale','Place the '+a.wanted+' bale',img('bale'),'left:50%;top:'+(63-a.parts.length*19.8)+'%;width:'+(widths[a.parts.length]*.7)+'%;height:25%','bale-'+a.wanted);
      if(p==='fluff')body+='<button class="fn-fluff fj-rub" data-fluff aria-label="Fluff the soft bedding"><span class="fj-finger" aria-hidden="true"></span></button>';
      if(p==='rest')body+='<div class="fn-resting-friend">'+img(friend,'',friend+' resting on the soft bedding')+'<span aria-hidden="true">z z z</span></div>';
      body+='<div class="fn-job-count" aria-label="Bed '+(a.round+1)+' of 3">'+[0,1,2].map((i)=>'<span class="'+(i<a.round?'done':'')+'">'+img(['sheep','goat','cow'][i])+'</span>').join('')+'</div>';
      a.g.image=base+'play-scenes/music-meadow.webp';stage(a,p==='stack'?'Build a cosy hay tower':p==='fluff'?'Make the bedding soft':'A cosy bed for your friend',body,p==='stack'?sizes.map((id,i)=>a.piece('bale-'+id,id[0].toUpperCase()+id.slice(1)+' bale',src('bale'),'--piece-width:'+widths[i]+'%')).join(''):'<p class="fj-small-prompt">'+(p==='fluff'?'Rub the bedding to make it fluffy':'Watch your friend settle down')+'</p>',a.round*4+a.parts.length+(p==='rest'?1:0),12,p==='stack'?'Big at the bottom, then middle, then little.':p==='fluff'?'Rub the loose bedding. Make a soft place to rest.':'Your work made a comfy resting place.');
      const speech=speak(a,'hay-'+p);
      if(p==='rest')Promise.resolve(speech).then(seconds=>laterPhase(a,()=>{a.round++;a.parts=[];if(a.round===3)a.win('Three cosy hay beds and three happy farm friends!');else phase(a,'stack');},Math.max(3300,seconds*1000+300)));
      if(p==='fluff')rub(a,a.root.querySelector('[data-fluff]'),220,()=>phase(a,'rest'),'Bedding fluffed');
    },
    accept(a,target,id){if(a.busy||a.journeyPhase!=='stack'||a.parts.length>=3||id!=='bale-'+a.wanted)return;a.parts.push(a.wanted);a.render();if(a.parts.length===3)laterPhase(a,()=>phase(a,'fluff'),900);}
  };
  engine.register('haystack',hay);
  const pond={
    assets:[src('duck'),src('pond'),src('pad'),src('carrot')],
    render(a){
      a.journeyPhase ||= 'pads';a.fed ||= [];const p=a.journeyPhase,count=a.round+1,x=i=>count===1?50:26+i*48/(count-1);
      let body='<div class="fa-pond-water">'+img('pond','', 'Little farm pond')+'</div>';
      if(p==='swim')body+='<button class="fn-swim-water fj-rub" data-swim aria-label="Guide the duck family across the pond"><span class="fn-swim-family">'+Array.from({length:count},(_,i)=>img('duck','fn-swimmer','Duckling '+(i+1))).join('')+'</span><span class="fn-swim-ripples" aria-hidden="true"></span><span class="fj-finger" aria-hidden="true"></span></button>';
      else body+=Array.from({length:count},(_,i)=>'<div class="fn-pad" style="left:'+x(i)+'%">'+img('pad')+'</div>'+(a.parts.includes(i)?'<div class="fn-pond-duck '+(a.fed.includes(i)?'fed':'')+'" style="left:'+x(i)+'%">'+img('duck')+(a.fed.includes(i)?'<span class="fn-happy-heart" aria-hidden="true">♥</span>':'')+'</div>':'')+(p==='pads'?a.target('pad-'+i,'Duckling place '+(i+1),'','left:'+x(i)+'%;top:51%;width:27%;height:40%','duck'):a.target('feed-'+i,'Give duckling '+(i+1)+' a carrot snack',a.fed.includes(i)?img('carrot'):'','left:'+x(i)+'%;top:67%;width:24%;height:23%','carrot'))).join('');
      stage(a,p==='pads'?'A lily pad for every duck':p==='feed'?'A little snack for every duck':'Guide your duck family home',body,p==='swim'?'<p class="fj-small-prompt">Swipe through the water</p>':tray(a,[p==='pads'?'duck':'carrot']),a.round*3+['pads','feed','swim'].indexOf(p),9,p==='pads'?'Bring one duckling to each lily pad.':p==='feed'?'Give every duckling one little carrot snack.':'Move your finger across the pond. Your ducklings swim with you!');
      speak(a,'pond-'+p);
      if(p==='swim')rub(a,a.root.querySelector('[data-swim]'),280,()=>laterPhase(a,()=>{a.round++;a.parts=[];a.fed=[];if(a.round===3)a.win('You found a place, shared snacks and guided every duck family home!');else phase(a,'pads');},1800),'Duck family home');
      else a.root.querySelectorAll('[data-fa-target]').forEach(n=>n.disabled=(p==='pads'?a.parts:a.fed).includes(+n.dataset.faTarget.split('-')[1]));
    },
    accept(a,target,id){const p=a.journeyPhase,i=+target.split('-')[1],list=p==='pads'?a.parts:a.fed;if(a.busy||!['pads','feed'].includes(p)||!Number.isInteger(i)||i<0||i>a.round||list.includes(i))return;list.push(i);a.render();a.sound(p==='pads'?'water':'care');if(list.length===a.round+1)laterPhase(a,()=>phase(a,p==='pads'?'feed':'swim'),1000);}
  };
  engine.register('balance',pond);
  const market={
    assets:['apple','carrot','tomato','corn','pumpkin','strawberry'].map(src).concat(src('basket')),
    render(a){
      a.journeyPhase ||= 'pack';const p=a.journeyPhase;
      if(p==='pack'){a.renderBase();a.root.classList.add('fj-screen','fn-market');speak(a,'market-pack');return;}
      const food=a.parts.map((id,i)=>img(id,'fn-basket-food fn-food-'+i)).join(''),basket='<span class="fn-packed-basket">'+img('basket')+food+'</span>';
      let body='<div class="fa-customer fn-customer"><img draggable="false" src="'+base+'guides/'+['jay','jade','rhys'][a.round]+'.webp" alt="Your farm neighbour"></div>';
      if(p==='weigh')body+='<div class="fn-scale"><div class="fn-scale-pan"></div><div class="fn-scale-dial"><i></i></div></div><button class="fn-weigh fj-rub" data-weigh aria-label="Gently press the scale to weigh your basket">'+basket+'<span class="fj-finger" aria-hidden="true"></span></button>';
      else body+='<button class="fn-delivery-basket" data-fa-piece="basket" aria-label="Your packed basket">'+basket+'</button>'+a.target('neighbour','Bring your basket to the neighbour','','left:75%;top:43%;width:35%;height:65%','basket');
      stage(a,p==='weigh'?'Weigh your harvest basket':'Bring your neighbour their basket',body,'<p class="fj-small-prompt">'+(p==='weigh'?'Rub gently to settle the scale':'Carry your basket to your neighbour')+'</p>',a.round*3+(p==='weigh'?1:2),9,p==='weigh'?'Move your finger gently over the basket. Watch the scale settle.':'Your basket is ready! Carry it to your neighbour.');a.root.classList.add('fn-market');speak(a,'market-'+p);
      if(p==='weigh'){const node=a.root.querySelector('[data-weigh]');node.append(a.root.querySelector('.fn-scale'));rub(a,node,200,()=>laterPhase(a,()=>phase(a,'deliver'),800),'Basket weighed');}
    },
    accept(a,target,id){if(a.journeyPhase==='pack'){if(a.parts.includes(id)||!a.required.includes(id))return;a.parts.push(id);a.render();a.sound('harvest');if(a.required.every(item=>a.parts.includes(item)))laterPhase(a,()=>phase(a,'weigh'),900);return;}
      if(a.journeyPhase!=='deliver')return;a.root.classList.add('fn-delivered');a.say('Your neighbour has their basket. Thank you for helping!');a.sound('care');laterPhase(a,()=>{a.round++;a.parts=[];if(a.round===3)a.win('You packed, weighed and delivered three lovely harvest baskets!');else phase(a,'pack');},2200);}
  };
  engine.register('market',market);
})();
