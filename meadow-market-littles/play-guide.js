/* Optional picture-led invitations: a helping task, a thinking task and a creation. */
(() => {
  'use strict';
  const groups=[[
    ['lambcare','Help Pip have a lovely day'],['care_feed','Give a friend food and water'],['little_bridge_builders','Build Clover a way across'],['nest_builder','Make a cosy nest'],['seed_to_snack','Grow something for a snack'],['farm_post_office','Deliver a little postcard']
  ],[
    ['memory','Find the matching pictures'],['first_sounds','Listen for the first letter'],['shapes','Fit the farm windows'],['shape_shadows','Fit the farm windows'],['word_search','Find three little words'],['harvestcount','Count the harvest'],['farmerpattern','Remember the farmer’s pattern']
  ],[
    ['meadow_kitchen','Make your own farm treat'],['farm_band','Make a tune with your friends'],['meadow_story','Make your own farm story'],['little_farm_builder','Build your own little farm'],['drawing','Draw something you love'],['meadow_keepsakes','Make a picture to keep']
  ]];
  let api,dialog,choices=[],recent=[];
  try{const list=JSON.parse(localStorage.getItem('meadow-littles-job-choices')||'[]');if(Array.isArray(list))recent=list.filter(x=>typeof x==='string').slice(-12);}catch{}
  const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function choose(){return groups.map(group=>{let pool=group.filter(([id])=>api.games.some(g=>g.id===id));const fresh=pool.filter(([id])=>!recent.slice(-6).includes(id));if(fresh.length)pool=fresh;return pool[Math.floor(Math.random()*pool.length)];});}
  function close(){window.meadowAudio?.stopVoice();dialog?.close();}
  function render(){dialog.innerHTML='<main class="job-screen"><header><img src="assets/generated/guides/jade.webp" alt="Farmer Jade"><h2>Who shall we help?</h2><button data-job-close aria-label="Back to all games">×</button></header><p>Choose a little job you like.</p><section class="job-choices">'+choices.map(([id,title])=>{const g=api.games.find(x=>x.id===id);return '<button data-job="'+id+'"><img src="'+g.image+'" alt=""><span>'+esc(title)+'</span></button>';}).join('')+'</section><footer><button data-job-more>Other little jobs</button><button data-job-done>All games</button></footer></main>';dialog.querySelector('[data-job-close]').onclick=close;dialog.querySelector('[data-job-done]').onclick=close;dialog.querySelector('[data-job-more]').onclick=()=>{choices=choose();render();};dialog.querySelectorAll('[data-job]').forEach(b=>b.onclick=()=>{const id=b.dataset.job;recent.push(id);recent=recent.slice(-12);try{localStorage.setItem('meadow-littles-job-choices',JSON.stringify(recent));}catch{}close();api.games.find(g=>g.id===id).open();});}
  window.meadowPlayGuide={attach(options){api=options;dialog=document.createElement('dialog');dialog.className='job-dialog';dialog.setAttribute('aria-label','Little farm jobs');document.body.append(dialog);dialog.addEventListener('cancel',e=>{e.preventDefault();close();});},open(){choices=choose();render();dialog.showModal();}};
})();
