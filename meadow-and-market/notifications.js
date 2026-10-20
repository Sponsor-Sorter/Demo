(() => {
 'use strict';
 let api;
 function badge(el,count,description='needs attention'){
  if(!el)return;count=Math.max(0,Math.floor(Number(count)||0));let dot=el.querySelector(':scope > .notification-badge');
  if(!count){if(!dot&&!el.dataset.notificationCount)return;dot?.remove();delete el.dataset.notificationCount;el.removeAttribute('aria-description');return}
  if(!dot){dot=document.createElement('span');dot.className='notification-badge';dot.setAttribute('aria-hidden','true');el.append(dot)}
  if(el.dataset.notificationCount===String(count)&&dot.textContent===(count>99?'99+':String(count))&&el.getAttribute('aria-description')===count+' '+description)return;
  dot.textContent=count>99?'99+':String(count);el.classList.add('has-notification');el.dataset.notificationCount=String(count);el.setAttribute('aria-description',count+' '+description);
 }
 function counts(s,f,rules={}){
  const animals=(s.farms?Object.values(s.farms).flatMap(farm=>farm.objects||[]):f.objects||[]).filter(o=>['chicken','cow','sheep','goat','alpaca'].includes(o.type)),stations=(f.objects||[]).filter(o=>['kitchen','workshop'].includes(o.type));
  return {animals:animals.filter(a=>rules.animalNeeds?.(a)||rules.animalReady?.(a)).length,requests:(f.orders||[]).filter(o=>rules.canDeliver?.(o,f.inventory||{})).length,shop:stations.reduce((n,o)=>n+(rules.stationReady?.(o)||0),0)+((f.shop?.unlocked||(f.objects||[]).some(o=>o.type==='stall'))&&Object.values(f.shop.stock||{}).every(n=>n<=0)&&Object.values(f.inventory||{}).some(n=>n>0)?1:0),journal:rules.journalReady?.(s)||0};
 }
 function refresh(){if(!api||document.hidden)return;const c=counts(api.state(),api.current(),api.rules);badge(document.querySelector('[data-view="animals"].hud-action'),c.animals,'animals need care or have produce ready');badge(document.querySelector('[data-view="requests"]'),c.requests,'market requests ready to deliver');badge(document.querySelector('[data-view="shop"].hud-action'),c.shop,'finished batches or empty shops need attention');badge(document.getElementById('journal-button'),c.journal,'rewards ready to claim');badge(document.getElementById('homestead-story'),api.rules.storyReady?.()||0,'homestead rewards ready to claim');for(const [type,id] of [['kitchen','open-kitchen'],['workshop','open-workshop']])badge(document.getElementById(id),api.current().objects.filter(o=>o.type===type).reduce((n,o)=>n+(api.rules.stationReady?.(o)||0),0),'batches ready to collect');const social=api.social?.()||{};badge(document.getElementById('friends-button'),(social.requests||0)+(social.visits||0),'friend requests or unseen visitor entries');badge(document.getElementById('visitor-log-button'),social.visits||0,'unseen visitor entries');badge(document.getElementById('friends-requests-heading'),social.requests||0,'incoming friend requests');}
 window.meadowNotifications={badge,counts,refresh,attach(a){api=a;refresh();setInterval(refresh,2000)}};
})();
