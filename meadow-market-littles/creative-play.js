/* Creative catalogue bridge; interactive play lives in creative-scenes.js. */
(() => {
'use strict';
let dialog,api;
function close(){window.meadowFarmAdventures?.dispose();window.meadowAudio?.stopVoice();dialog?.close();}
function attach(options){api=options;dialog=document.createElement('dialog');dialog.className='creative-dialog';dialog.setAttribute('aria-label','Creative farm play');document.body.append(dialog);dialog.addEventListener('cancel',e=>{e.preventDefault();close();});}
function open(mode){
  const kind=mode==='kitchen'?'kitchen':mode==='letters'?'firstsounds':'band';
  const game={id:kind==='kitchen'?'meadow_kitchen':kind==='band'?'farm_band':'first_sounds',kind,farmer:'jade',image:'assets/generated/play-scenes/'+(kind==='band'?'music-meadow':'kitchen-room')+'.webp',voice:kind==='kitchen'?'creative-jade-kitchen':kind==='band'?'creative-jade-band':''};
  if(window.meadowLittlesAccess?.begin(game.id,close)===false)return;if(!dialog.open)dialog.showModal();
  window.meadowFarmAdventures.mount({game,dialog,close,restart:()=>open(mode),complete:()=>{window.meadowLittlesAccess?.complete(game.id);const s=api.state();s.minigames ||= {records:{},rewards:{}};s.minigames.records ||= {};const rec=s.minigames.records[game.id]||{wins:0};rec.wins=(rec.wins||0)+1;s.minigames.records[game.id]=rec;api.save();return {earned:false};}});
  if(kind!=='firstsounds')window.meadowAudio?.speak(game.voice);
}
window.meadowCreativePlay={attach,open};
})();
