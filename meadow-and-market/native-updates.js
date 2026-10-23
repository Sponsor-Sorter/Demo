(() => {
  'use strict';
  const enabled=window.Capacitor?.isNativePlatform?.()&&window.Capacitor?.isPluginAvailable?.('MeadowUpdates');
  const plugin=enabled?(window.Capacitor.Plugins?.MeadowUpdates||window.Capacitor.registerPlugin?.('MeadowUpdates')):null;
  let api,status=null,checking=false,busy=false,snooze=0;
  const dialog=()=>document.querySelector('#native-update-dialog');
  function draw(message=''){
    const root=dialog();if(!root)return;const available=!!status?.available;
    root.innerHTML='<div class="sheet-head"><div><small class="eyebrow">ANDROID APP</small><h2>'+ (available?'App update '+status.availableVersion:'Your Android app')+'</h2></div><button class="close-button" aria-label="Close app update">×</button></div><p class="sheet-copy">'+(available?'Download the verified app update. Android will ask you to confirm installation. Your farm stays saved.':status?'Version '+status.installedVersion+' is current. Farm content updates separately inside the game.':'Checking for an app update…')+'</p><p role="status" class="sheet-copy"></p>'+(available?'<button id="native-update-install" class="primary-button full-button">'+(status.canInstall?'Download & install · '+Math.ceil(status.bytes/1048576)+' MB':'Allow app updates')+'</button>':'')+'<button id="native-update-later" class="small-button full-button" style="margin-top:8px">'+(available?'Later':'Done')+'</button>';
    root.querySelector('[role="status"]').textContent=message;
    const close=()=>{if(busy)return;snooze=Date.now()+1800000;root.close()};root.querySelector('.close-button').onclick=close;root.querySelector('#native-update-later').onclick=close;
    root.querySelector('#native-update-install')?.addEventListener('click',async()=>{
      if(busy)return;if(!status.canInstall){try{await plugin.allowInstalls()}catch(error){draw(error.message)}return;}
      busy=true;root.querySelectorAll('button').forEach(b=>b.disabled=true);root.querySelector('[role="status"]').textContent='Downloading and verifying the signed app…';
      try{api.save();const result=await plugin.install();if(result.permissionRequired){status.canInstall=false;draw('Android needs your permission to install this app update.');}else draw('The verified installer is open. Confirm the update in Android, then return to your farm.');}
      catch(error){draw(error.message||'Could not install this app update. Your current game is unchanged.');}
      finally{busy=false;root.querySelectorAll('button').forEach(b=>b.disabled=false);}
    });
  }
  async function check(explicit=false){
    if(!plugin||checking||busy)return;checking=true;
    try{status=await plugin.check();if(explicit||(status.available&&Date.now()>snooze&&api.canPrompt())){draw();if(!dialog().open)dialog().showModal();}else if(dialog().open)draw();}
    catch(error){if(explicit){draw(error.message||'Connect to check for an app update.');if(!dialog().open)dialog().showModal();}}
    finally{checking=false;}
  }
  window.meadowNativeUpdates={available:!!plugin,open:()=>check(true),attach(adapter){api=adapter;if(!plugin)return;const root=document.createElement('dialog');root.id='native-update-dialog';root.className='sheet';root.setAttribute('aria-label','Android app update');root.addEventListener('cancel',e=>{if(busy)e.preventDefault();else snooze=Date.now()+1800000});document.body.append(root);setTimeout(()=>check(),12000);setInterval(()=>check(),600000);window.addEventListener('focus',()=>check());document.addEventListener('visibilitychange',()=>{if(!document.hidden)check()});}};
})();
