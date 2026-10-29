(() => {
  'use strict';
  const key='meadow-market-audio-v1', base='assets/audio/';
  const defaults={music:0.32,effects:0.65,ambience:0.2,voice:0.8,muted:false};
  let prefs={...defaults};
  try{prefs={...defaults,...JSON.parse(localStorage.getItem(key)||'{}')}}catch{}
  for(const channel of ['music','effects','ambience','voice'])prefs[channel]=Math.max(0,Math.min(1,Number(prefs[channel])||0));
  let context,master,musicGain,effectsGain,ambientGain,voiceGain,speaker,voiceOwner=null,voiceToken=0,started=false,loading;
  const buffers=new Map(),pending=new Map(),voices=new Set(),last=new Map();
  const loops=[];
  const pinnedBuffers=new Set(['farm-theme','meadow-ambience']),bufferBudget=32*1024*1024;
  function trimBuffers(){let bytes=0;for(const [id,b] of buffers)if(!pinnedBuffers.has(id))bytes+=b.length*b.numberOfChannels*4;for(const [id,b] of buffers){if(bytes<=bufferBudget)break;if(pinnedBuffers.has(id))continue;buffers.delete(id);bytes-=b.length*b.numberOfChannels*4}}
  function load(id){
    if(buffers.has(id)){const b=buffers.get(id);buffers.delete(id);buffers.set(id,b);return Promise.resolve(b)}
    if(pending.has(id))return pending.get(id);
    const task=fetch(base+id+'.mp3?v=56').then(r=>{if(!r.ok)throw Error('Audio unavailable: '+id);return r.arrayBuffer()}).then(b=>context.decodeAudioData(b)).then(b=>{buffers.set(id,b);trimBuffers();pending.delete(id);return b}).catch(()=>{pending.delete(id);return null});
    pending.set(id,task);return task;
  }
  function volumes(){if(!context)return;const t=context.currentTime;master.gain.setTargetAtTime(prefs.muted?0:1,t,.08);musicGain.gain.setTargetAtTime(prefs.music,t,.15);effectsGain.gain.setTargetAtTime(prefs.effects,t,.04);ambientGain.gain.setTargetAtTime(prefs.ambience,t,.15);voiceGain.gain.setTargetAtTime(prefs.voice,t,.06)}
  async function loop(id,gain){const buffer=await load(id);if(!buffer)return;const crossfade=Math.min(id==='farm-theme'?2.5:.6,buffer.duration/8);let nextAt=context.currentTime+.05;const schedule=()=>{if(document.hidden||context.state!=='running'||nextAt>context.currentTime+1)return;const at=Math.max(nextAt,context.currentTime+.02),source=context.createBufferSource(),fade=context.createGain();source.buffer=buffer;source.connect(fade);fade.connect(gain);fade.gain.setValueAtTime(0,at);fade.gain.linearRampToValueAtTime(1,at+crossfade);fade.gain.setValueAtTime(1,at+buffer.duration-crossfade);fade.gain.linearRampToValueAtTime(0,at+buffer.duration);source.start(at);nextAt=at+buffer.duration-crossfade;loops.push(source);source.onended=()=>{const i=loops.indexOf(source);if(i>=0)loops.splice(i,1);fade.disconnect()}};schedule();setInterval(schedule,300)}
  async function unlock(){
    if(!context){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;context=new Audio();master=context.createGain();master.connect(context.destination);musicGain=context.createGain();effectsGain=context.createGain();ambientGain=context.createGain();voiceGain=context.createGain();for(const g of [musicGain,effectsGain,ambientGain,voiceGain])g.connect(master);volumes()}
    if(document.hidden)return;
    try{await context.resume()}catch{return}
    document.documentElement.dataset.audioState=context.state;if(!started){started=true;loading=Promise.all([loop('farm-theme',musicGain),loop('meadow-ambience',ambientGain)])}
  }
  async function play(id){
    if(prefs.muted||!prefs.effects||document.hidden)return;
    const now=performance.now();if(now-(last.get(id)||-1000)<110)return;last.set(id,now);
    await unlock();if(!context)return;const buffer=await load(id);if(!buffer||document.hidden||prefs.muted)return;
    if(voices.size>=6){const oldest=voices.values().next().value;oldest.stop();voices.delete(oldest)}
    const source=context.createBufferSource();source.buffer=buffer;source.connect(effectsGain);voices.add(source);source.onended=()=>voices.delete(source);source.start();document.documentElement.dataset.lastSound=id;document.documentElement.dataset.lastSoundDuration=String(buffer.duration);
  }
  function stopVoice(){voiceToken++;voiceOwner=null;if(speaker){try{speaker.stop()}catch{}speaker=null}if(context)musicGain.gain.setTargetAtTime(prefs.music,context.currentTime,.2)}
  async function speak(id){stopVoice();if(!id||prefs.muted||!prefs.voice||document.hidden)return;const token=voiceToken;voiceOwner=[...document.querySelectorAll('dialog[open]')].at(-1)||null;await unlock();if(!context)return;const buffer=await load(id);if(!buffer||token!==voiceToken||document.hidden)return;speaker=context.createBufferSource();const source=speaker;source.buffer=buffer;source.connect(voiceGain);musicGain.gain.setTargetAtTime(prefs.music*.3,context.currentTime,.12);source.onended=()=>{if(speaker===source){speaker=null;musicGain.gain.setTargetAtTime(prefs.music,context.currentTime,.3)}};source.start();document.documentElement.dataset.lastVoice=id;document.documentElement.dataset.lastVoiceDuration=String(buffer.duration)}
  function settings(){return `<section class="task-card audio-settings"><h3>Music & sound</h3><label class="audio-mute"><input id="audio-muted" type="checkbox" ${prefs.muted?'checked':''}> Mute all sound</label>${[['music','Music'],['effects','Sound effects'],['ambience','Outdoor ambience'],['voice','Character voices']].map(([id,label])=>`<label class="audio-slider" for="audio-${id}"><span>${label}</span><input id="audio-${id}" type="range" min="0" max="100" value="${Math.round(prefs[id]*100)}"><output id="audio-${id}-value">${Math.round(prefs[id]*100)}%</output></label>`).join('')}<button class="small-button" id="audio-preview">Preview sound</button><p class="sheet-copy">Sound starts after your first tap and pauses when the game is in the background.</p></section>`}
  function bind(){const persist=()=>{try{localStorage.setItem(key,JSON.stringify(prefs))}catch{}volumes()};document.querySelector('#audio-muted')?.addEventListener('change',e=>{prefs.muted=e.target.checked;if(prefs.muted)stopVoice();persist();unlock()});for(const id of ['music','effects','ambience','voice'])document.querySelector('#audio-'+id)?.addEventListener('input',e=>{prefs[id]=Number(e.target.value)/100;if(id==='voice'&&!prefs.voice)stopVoice();document.querySelector('#audio-'+id+'-value').value=e.target.value+'%';persist();unlock()});document.querySelector('#audio-preview')?.addEventListener('click',()=>play('reward'))}
  // Capture before navigation handlers stop propagation or remove the clicked button.
  document.addEventListener('click',e=>{const el=e.target.closest?.('button,[role="tab"],summary');if(!el||el.disabled||el.closest('.farm-grid,.map-hotspots,#minigame-dialog,#animal-care-dialog')||el.dataset.skipClick==='true')return;play('tap')},true);
  document.addEventListener('close',e=>{if(e.target===voiceOwner&&!e.target.open)stopVoice()},true);
  document.addEventListener('pointerdown',unlock,{passive:true});document.addEventListener('keydown',unlock);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){stopVoice();for(const source of voices){try{source.stop()}catch{}}voices.clear();context?.suspend()}else if(started)unlock()});
  window.meadowAudio={play,speak,stopVoice,settings,bind};
})();
