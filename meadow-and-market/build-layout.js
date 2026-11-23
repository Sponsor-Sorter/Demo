(() => {
 'use strict';
 let api,button,scene,enabled=false;
 function refresh(){
  if(!api)return;
  const building=api.inBuild();
  if(!building)enabled=false;
  const on=building&&enabled;
  const hidden=!building||!!document.querySelector('.build-turn-controls>button:not(:disabled)');
  if(button.hidden!==hidden)button.hidden=hidden;
  if(scene.classList.contains('layout-view')!==on)scene.classList.toggle('layout-view',on);
  if(button.getAttribute('aria-pressed')!==String(on))button.setAttribute('aria-pressed',String(on));
 }
 function attach(options){
  api=options;scene=document.getElementById('farm-land');button=document.getElementById('build-layout-toggle');
  if(!scene||!button){api=null;return}
  button.addEventListener('click',()=>{
   if(!api.inBuild()||button.hidden)return;
   enabled=!enabled;refresh();window.meadowAudio?.play('tap');
  });
  refresh();
 }
 window.meadowBuildLayout={attach,refresh};
})();
