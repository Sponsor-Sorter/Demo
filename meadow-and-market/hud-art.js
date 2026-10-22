(() => {
 'use strict';
 const specs=[
 ['[data-mode="tend"]','tend','Tend','Water, plant and harvest your crops.'],
 ['[data-mode="build"]','build','Build','Choose an item, then hold and drag it onto clear grass.'],
 ['#undo-button','undo','Undo move','Return the last moved item to its previous place.'],
 ['.hud-action[data-view="requests"]','requests','Market requests','Grow and deliver the produce villagers need.'],
 ['.hud-action[data-view="market"]','market','Farmers market','Sell your goods for better prices and play market games.'],
 ['.hud-action[data-view="animals"]','animals','Animal family','Check needs, collect produce and play care games.'],
 ['.hud-action[data-view="shop"]','shop','Farm shop','Buy seeds, animals, buildings and supplies.'],
 ['#farm-play-button','play','Farm games','Learn new skills and earn rewards.'],
 ['#roster-button','roster','Worker roster','Hire farm workers, see their current jobs, and place them on your farms.'],
 ['#friends-button','friends','Farm friends','Find farmers, accept requests and visit their farms.'],
 ['#journal-button','journal','Farm desk','See goals, achievements and farming progress.'],
 ['#settings-button','settings','Settings','Manage sound, accounts and app downloads.'],
 ['#map-switch','maps','My farms','Travel between your unlocked farm maps.'],
 ['#leaderboards-button','boards','Leaderboards','Compare game scores with friends and farmers worldwide.'],
 ['#missions-button','missions','Missions','Complete daily and weekly goals, then claim rewards.'],
 ['#emporium-button','emporium','Meadow emporium','Gem packs, VIP rewards and your collection cabinet.'],
 ['#expand-button','expand','Expand farm','Unlock more grass tiles as your farm grows.'],
 ['#guide-launcher','helpers','Farm helpers','Ask Farmer Jade, Farmer Rhys and Farmer Jay for guidance.']
 ];
 const items=new Map();
 for(const [selector,id,title,copy] of specs){const el=document.querySelector(selector);if(!el)continue;items.set(el,{id,title,copy});el.dataset.hudHelp=id;el.setAttribute('aria-label',title+'. '+copy);el.removeAttribute('title');
  if(!['boards','missions','emporium','expand','helpers','roster'].includes(id)){el.innerHTML='<img class="hud-painted-art" src="assets/generated/hud/'+id+'.webp" alt="" draggable="false"><span class="hud-screenreader">'+title+'</span>';el.classList.add('hud-painted')}
 }
 document.querySelectorAll('.brand-resources .resource:not(.vip-resource)').forEach((el,i)=>{const icon=el.querySelector('span');if(icon)icon.innerHTML='<img src="assets/generated/hud/'+(i?'level':'coin')+'.webp" alt="'+(i?'Level':'Gold')+'">'});
 const brand=document.querySelector('.brand-mark');if(brand)brand.innerHTML='<img src="assets/generated/flower-patch.webp" alt="" style="width:100%;height:100%;object-fit:contain">';
 const tip=document.createElement('div');tip.id='hud-explanation';tip.hidden=true;tip.setAttribute('role','status');tip.innerHTML='<strong></strong><span></span>';document.body.append(tip);
 const HOLD_MS=250;
 let gesture=null,hold=0,voice=0,active=null,suppress=null;
 const target=e=>e?.closest?.('[data-hud-help]');
 function show(el){if(!gesture?.browse||!items.has(el))return;if(active===el&&!tip.hidden)return;const first=!active;active?.classList.remove('hud-exploring');active=el;el.classList.add('hud-exploring');const info=items.get(el);tip.firstElementChild.textContent=info.title+(el.disabled?' · Unavailable':'');tip.lastElementChild.textContent=el.disabled&&info.id==='undo'?'Move an item first to enable Undo.':info.copy;tip.hidden=false;const r=el.getBoundingClientRect(),w=Math.min(270,innerWidth-24);tip.style.width=w+'px';tip.style.left=Math.max(12,Math.min(innerWidth-w-12,r.left+r.width/2-w/2))+'px';const h=tip.getBoundingClientRect().height;tip.style.top=(r.top>h+24?r.top-h-12:Math.min(innerHeight-h-12,r.bottom+12))+'px';clearTimeout(voice);window.meadowAudio?.stopVoice();const speak=()=>{if(gesture?.browse&&active===el&&!document.hidden)window.meadowAudio?.speak(info.id==='roster'?'rhys-roster154':'hud-'+info.id)};if(first)speak();else voice=setTimeout(speak,120)}
 function dismiss(){clearTimeout(voice);tip.hidden=true;if(active)window.meadowAudio?.stopVoice();active?.classList.remove('hud-exploring');active=null}
 function cancel(){clearTimeout(hold);gesture=null;dismiss()}
 document.addEventListener('pointerdown',e=>{cancel();suppress=null;const el=target(e.target);if(!el||e.button>0)return;gesture={id:e.pointerId,x:e.clientX,y:e.clientY,hover:el,browse:false,moved:false};hold=setTimeout(()=>{if(!gesture)return;gesture.browse=true;if(gesture.hover)show(gesture.hover)},HOLD_MS)},{capture:true});
 document.addEventListener('pointermove',e=>{if(!gesture||e.pointerId!==gesture.id)return;gesture.hover=target(document.elementFromPoint(e.clientX,e.clientY));if(Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)>8)gesture.moved=true;if(gesture.moved||gesture.browse){e.preventDefault();e.stopPropagation()}if(gesture.browse){if(gesture.hover)show(gesture.hover);else dismiss()}},{capture:true,passive:false});
 function end(e){if(!gesture||gesture.id!==e.pointerId)return;if(gesture.browse||gesture.moved){suppress={until:performance.now()+700};e.preventDefault();e.stopPropagation()}cancel()}
 document.addEventListener('pointerup',end,true);document.addEventListener('pointercancel',end,true);
 document.addEventListener('click',e=>{dismiss();if(suppress&&performance.now()<suppress.until&&target(e.target)){e.preventDefault();e.stopImmediatePropagation();suppress=null}},true);
 window.addEventListener('resize',cancel);window.addEventListener('blur',cancel);document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel()});
 window.meadowHudArt={specs:specs.map(([,id,title,copy])=>({id,title,copy}))};
})();
