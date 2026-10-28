/* Recorded Littles instructions; farm sound preferences, no second music/ambience loop. */
(()=>{'use strict';let voice,token=0;
 const prefs=()=>{try{return {...{muted:false,voice:.8,effects:.65},...JSON.parse(localStorage.getItem('meadow-market-audio-v1')||'{}')}}catch{return {muted:false,voice:.8,effects:.65}}};
 const farm=()=>{try{return parent!==window?parent.meadowAudio:null}catch{return null}};
 function stopVoice(){token++;if(voice){voice.pause();voice.removeAttribute('src');voice.load();voice=null}window.speechSynthesis?.cancel()}
 function speak(id){stopVoice();const p=prefs();if(!/^[a-z0-9-]+$/.test(id||'')||p.muted||!p.voice||document.hidden)return;farm()?.stopVoice?.();const current=token,a=new Audio(new URL('assets/audio/'+id+'.mp3?v=56',document.baseURI));voice=a;a.volume=Math.max(0,Math.min(1,Number(p.voice)||0));a.play().catch(()=>{if(current===token&&voice===a)voice=null})}
 function play(id='tap'){const p=prefs();if(p.muted)return;const host=farm();if(host){host.play(id);return}if(!/^[a-z0-9-]+$/.test(id))return;const a=new Audio(new URL('assets/audio/'+id+'.mp3?v=56',document.baseURI));a.volume=Math.max(0,Math.min(1,Number(p.effects)||0));a.play().catch(()=>{})}
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stopVoice()});window.addEventListener('pagehide',stopVoice);window.meadowAudio={speak,play,stopVoice};
})();
