const button=document.getElementById('install-app-button');
const status=document.getElementById('install-app-status');
let pendingPrompt=null;
const standalone=()=>window.matchMedia('(display-mode: standalone)').matches || navigator.standalone===true;
function installed(){if(button){button.disabled=true;button.textContent='App is open';}if(status)status.textContent='You are already using Sponsor Sorter as an app.';}
if(standalone())installed();
window.addEventListener('beforeinstallprompt',event=>{if(!button || standalone())return;event.preventDefault();pendingPrompt=event;button.disabled=false;button.textContent='Install Sponsor Sorter';});
window.addEventListener('appinstalled',()=>{pendingPrompt=null;installed();});
button?.addEventListener('click',async()=>{
 if(!pendingPrompt)return;
 const prompt=pendingPrompt;pendingPrompt=null;button.disabled=true;
 try{await prompt.prompt();const choice=await prompt.userChoice;status.textContent=choice.outcome==='accepted'?'Installation requested. Follow your phone’s confirmation.':'Installation cancelled. You can still use the website or install from your browser menu.';}catch{status.textContent='Use your browser’s install or Add to Home Screen option below.';}
});
// Check the worker on launch, resume and reconnect. Do not reload active forms.
// Pages are served from the network, so the next navigation gets the latest release.
if('serviceWorker' in navigator && (location.protocol==='https:' || location.hostname==='localhost' || location.hostname==='127.0.0.1')){
 navigator.serviceWorker.register('/service-worker.js',{scope:'/',updateViaCache:'none'}).then(registration=>{
  if(!registration)return;
  let lastCheck=0;
  const check=()=>{
   if(document.visibilityState==='hidden' || navigator.onLine===false)return;
   const now=Date.now();
   if(lastCheck && now-lastCheck<60000)return;
   lastCheck=now;
   registration.update().catch(()=>{});
  };
  check();
  document.addEventListener('visibilitychange',check);
  window.addEventListener('online',check);
 }).catch(()=>{if(status)status.textContent='You can use Sponsor Sorter online. If installation is unavailable, try your browser’s Add to Home Screen option.';});
}
