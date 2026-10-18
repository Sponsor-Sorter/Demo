(() => {
  'use strict';
  const people = {
    jade: {name:'Farmer Jade',role:'Growing & harvesting',image:'jade'},
    rhys: {name:'Farmer Rhys',role:'Building & making room',image:'rhys'},
    jay: {name:'Farmer Jay',role:'Animal care & village life',image:'jay'}
  };
  const lessons = [
    {id:'till',person:'jade',title:'Start with healthy soil',text:'Tap an empty dirt bed once to till it. The soil stays the same size through every crop stage. If all your beds are busy, we can place a free new one.',action:'Show me a garden bed',focus:'till'},
    {id:'plant',person:'jade',title:'Choose what to grow',text:'Tap a tilled bed, then choose a crop. The listed seed price pays for every tile in the field. Different farms offer different crops.',action:'Find a bed to plant',focus:'plant'},
    {id:'water',person:'jade',title:'Give your crop a drink',text:'Tap a growing crop to see its stages and remaining time. Water the field once for one gold per tile to earn a bonus at harvest. Only the plant grows; its soil and tile stay put.',action:'Show a growing crop',focus:'water'},
    {id:'harvest',person:'jade',title:'Pick your first harvest',text:'A sparkle marks a fully grown crop. Tap it to collect your produce, then plant the tilled bed again. Crops also grow while you are away. We can learn another lesson while we wait.',action:'Find a crop to harvest',focus:'harvest'},
    {id:'place',person:'rhys',title:'Make the farm your own',text:'I’m Farmer Rhys, Jade’s brother. Open Build, swipe across the item row, then tap an item and a clear diamond to place it. Minimize the tray when you need more room. Let’s try a free garden bed.',action:'Choose a free garden bed',focus:'place'},
    {id:'move',person:'rhys',title:'Move it into place',text:'In Build mode, tap an existing item and then a clear tile to move it. Hold an item still for 1.2 seconds to pick it up, then drag or tap a clear tile. A quick swipe pans the camera. Its highlighted ground area shows the space it needs. Undo reverses the last move.',action:'Pick up an item',focus:'move'},
    {id:'upgrade',person:'rhys',title:'Give your animals more room',text:'Tap a coop, barn, paddock, orchard, field, or well in Tend mode to see its upgrades. Each stage needs enough gold and clear space. Bigger homes hold more animals and improve their yield.',action:'Show a building’s upgrades',focus:'upgrade'},
    {id:'expand',person:'rhys',title:'Open another part of the meadow',text:'The expand button on the right opens more land on this farm. Check the price first, and keep your existing farm growing as you unlock the new space.',action:'See the next expansion',focus:'expand'},
    {id:'care',person:'jay',title:'Meet your animal friends',text:'I’m Farmer Jay—Farmer Rhys is my twin! Open Animals and visit a friend to feed, brush and play. Food, cleanliness, and happiness help them produce eggs or milk. Basic care is free.',action:'Visit animal care',focus:'care'},
    {id:'sell',person:'jay',title:'Bring a basket to the village',text:'The Market buys individual goods and offers requests with better rewards. Read what a vendor needs and compare it with your basket. Completing requests also earns village reputation.',action:'Open the village market',focus:'sell'}
  ];
  let api, root, panel, launcher, currentLesson=null, lastContext='', lastTipAt=0, silenceUntil=0, lastInteraction=Date.now(), pendingHint=null;
  window.addEventListener('pointerdown',()=>{lastInteraction=Date.now()},{passive:true});
  const get = () => {
    const s=api.state();
    if(!s.tutorial||s.tutorial.version!==1)s.tutorial={version:1,completed:[],rewarded:[],seenContexts:[],started:false,paused:false};
    const t=s.tutorial;
    t.completed ||= []; t.rewarded ||= []; t.seenContexts ||= [];
    return t;
  };
  const image = id => 'assets/generated/guides/'+people[id].image+'.webp';
  const next = person => lessons.find(l=>(!person||l.person===person)&&!get().completed.includes(l.id));
  function save(){api.save();updateLauncher()}
  function updateLauncher(){if(!launcher)return;const t=get();launcher.querySelector('small').textContent=pendingHint?'New farm tip':t.completed.length+'/'+lessons.length+' lessons';launcher.classList.toggle('guide-inviting',!t.started||!!pendingHint)}
  function hide(){window.meadowAudio?.stopVoice();panel.hidden=true;document.querySelectorAll('.guide-target').forEach(el=>el.classList.remove('guide-target'))}
  function card(person,title,text,action,label,extra='',voice=''){
    const p=people[person]; panel.hidden=false;panel.dataset.person=person;
    panel.innerHTML=`<button class="guide-close" aria-label="Minimize guide">−</button><img class="guide-portrait" src="${image(person)}" alt="${p.name}"><div class="guide-copy"><small>${p.name} · ${p.role}</small><h2>${title}</h2><p>${text}</p><div class="guide-actions">${action?`<button class="primary-button guide-main">${label}</button>`:''}${voice?'<button class="guide-replay" aria-label="Replay spoken tip">🔊 Listen</button>':''}<button class="guide-lessons">All lessons</button></div>${extra}</div>`;
    panel.querySelector('.guide-close').onclick=hide;
    panel.querySelector('.guide-lessons').onclick=menu;
    if(action)panel.querySelector('.guide-main').onclick=action;
    if(voice){window.meadowAudio?.speak(voice);panel.querySelector('.guide-replay').onclick=()=>window.meadowAudio?.speak(voice)}else window.meadowAudio?.stopVoice();
    lastTipAt=Date.now();
  }
  function showLesson(lesson){
    if(!lesson){card('jade','You know your way around!','You’ve tried every farm lesson. Farmer Rhys, Farmer Jay and I are still here whenever you want a reminder or a helping hand.',menu,'Meet your farm helpers');return}
    currentLesson=lesson;const done=get().completed.includes(lesson.id);
    card(lesson.person,lesson.title,lesson.text,()=>{silenceUntil=Date.now()+1200;hide();api.focus(lesson.focus)},lesson.action,`<small class="guide-reward">${done?'✓ You’ve completed this lesson':'Complete this task to earn 10 gold · once per lesson'}</small>`,lesson.person+'-'+lesson.id);
  }
  function welcome(){card('jade','Welcome to our little corner!','I’m Jade, and my twin brothers Farmer Rhys and Farmer Jay help around the farm. I’ll show you growing, Farmer Rhys knows building, and Farmer Jay loves animals. Try a lesson whenever you like—we’ll help you find the right place to tap.',()=>{get().started=true;save();showLesson(next())},'Let’s learn together','','jade-welcome')}
  function menu(){
    hide();const dialog=document.getElementById('guide-dialog'),t=get();
    dialog.innerHTML=`<div class="sheet-head"><div><small class="eyebrow">YOUR FARM HELPERS</small><h2>Jade, Farmer Rhys & Farmer Jay</h2></div><button class="close-button guide-menu-close" aria-label="Close farm helpers">×</button></div><p class="sheet-copy">Little lessons, real farm tasks. Completed lessons stay saved with your farm.</p><div class="guide-team">${Object.entries(people).map(([id,p])=>`<button class="guide-person" data-person="${id}"><img src="${image(id)}" alt="${p.name}"><strong>${p.name}</strong><small>${p.role}</small></button>`).join('')}</div><div class="guide-lesson-list">${lessons.map(l=>`<button data-lesson="${l.id}"><span>${t.completed.includes(l.id)?'✓':'○'}</span><div><strong>${l.title}</strong><small>${people[l.person].name}</small></div></button>`).join('')}</div><div class="section-label">LEND ME A HAND</div><div class="guide-assists"><button data-assist="harvest">Jade: harvest ready crops</button><button data-assist="care">Farmer Jay: care for my animals</button><button data-assist="space">Farmer Rhys: find building space</button></div><label class="guide-pause"><input type="checkbox" id="guide-pause" ${t.paused?'checked':''}> Pause automatic tips (help stays available)</label>`;
    dialog.querySelector('.guide-menu-close').onclick=()=>dialog.close();
    dialog.querySelectorAll('[data-person]').forEach(b=>b.onclick=()=>{dialog.close();get().started=true;const t=get(),id=b.dataset.person;t.metPeople ||= [];const lesson=next(id)||lessons.find(l=>l.person===id);if(!t.metPeople.includes(id)){t.metPeople.push(id);save();const intro={jade:'I’m Jade! I’ll help you grow and harvest your crops.',rhys:'I’m Farmer Rhys! I’ll help you build and make room. Improve the family well and I can sow more fields between drinks.',jay:'I’m Farmer Jay, Farmer Rhys’s twin! I love caring for our animals. Improve the family well and I can help for longer between drinks.'};card(id,'Hello, I’m '+people[id].name,intro[id],()=>showLesson(lesson),'Show my lessons','',id+'-welcome')}else{save();showLesson(lesson)}});
    dialog.querySelectorAll('[data-lesson]').forEach(b=>b.onclick=()=>{dialog.close();get().started=true;save();showLesson(lessons.find(l=>l.id===b.dataset.lesson))});
    dialog.querySelector('#guide-pause').onchange=e=>{get().paused=e.target.checked;save()};
    dialog.querySelectorAll('[data-assist]').forEach(b=>b.onclick=()=>{dialog.close();hide();const result=api.assist(b.dataset.assist);if(b.dataset.assist!=='space')card(b.dataset.assist==='care'?'jay':'jade','A little helping hand',result,hide,'Thanks!')});
    if(!dialog.open)dialog.showModal();
  }
  function event(id){
    if(!api)return;const lesson=lessons.find(l=>l.id===id);if(!lesson)return;const t=get();if(t.completed.includes(id))return;
    t.completed.push(id);if(!t.rewarded.includes(id)){t.rewarded.push(id);api.reward(10)}save();
    if(!t.paused&&t.started){currentLesson=lesson;card(lesson.person,'Lovely work!','You completed “'+lesson.title+'” and earned 10 gold. Keep trying things at your own pace.',()=>showLesson(next()),'Choose the next lesson')}
  }
  function context(view){
    if(!api||view===lastContext)return;lastContext=view;const t=get();if(Date.now()<silenceUntil||t.paused||!panel.hidden||document.querySelector('dialog[open]')||t.seenContexts.includes(view))return;
    const tips={build:['rhys','Swipe, choose, place','Swipe the Build row to see everything. Tap an item, then a clear diamond. Tap Minimize to uncover the map.'],animals:['jay','A little care goes a long way','Care restores your animals’ needs. Hold a roaming hen or cow to move it into a home with a free space.'],market:['jay','Read the whole request','Swipe up inside this panel to see the vendor’s basket and your sellable goods. Requests reward both gold and reputation.'],shop:['jay','Stock your own shelves','A market stall unlocks your own shop. Add goods from your basket, then check back for sales. Your village reputation can also unlock the shop.']};
    if(!tips[view])return;t.seenContexts.push(view);save();const [p,title,text]=tips[view];card(p,title,text,hide,'Got it');
  }
  function attach(a){
    api=a;root=document.createElement('div');root.id='farm-guides';
    root.innerHTML='<button id="guide-launcher" aria-label="Ask Jade, Farmer Rhys and Farmer Jay for farm help"><img src="'+image('jade')+'" alt=""><span>Farm helpers<small></small></span></button><section id="guide-panel" aria-label="Farm guide" aria-live="polite" hidden></section><dialog id="guide-dialog" class="sheet guide-menu"></dialog>';
    document.body.append(root);panel=root.querySelector('#guide-panel');launcher=root.querySelector('#guide-launcher');launcher.onclick=()=>{if(!pendingHint){menu();return}const hint=pendingHint;pendingHint=null;updateLauncher();card(hint.person,hint.title,hint.text,()=>{hide();api.focus(hint.focus)},'Show me')};updateLauncher();
    if(!get().introduced)setTimeout(()=>{if(!document.querySelector('dialog[open]')){get().introduced=true;save();welcome()}},1200);
    setInterval(()=>{if(Date.now()-lastInteraction<30000||document.hidden||!panel.hidden||get().paused||document.querySelector('dialog[open]')||Date.now()-lastTipAt<180000)return;const hint=api.hint();if(hint){pendingHint=hint;lastTipAt=Date.now();updateLauncher()}},30000);
  }
  window.meadowGuides={attach,event,context,menu,lesson:showLesson};
})();
