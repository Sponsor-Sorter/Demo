/* Internal native builds only. Official sample ads never award a game round. */
(() => {
 'use strict';
 let requestNumber=0,lastSequence=0;
 const events=['started','shown','impression','earned','dismissed','unavailable','load_cancelled','destroyed'];
 function timingText(value,request){
  if(value?.contract!=='littles-ad-timing-v1'||value.request!==request||!Number.isSafeInteger(value.sequence)||value.sequence<=lastSequence||value.sequence>1000000||!Number.isSafeInteger(value.generation)||value.generation<0||!['none','publisher','demo'].includes(value.kind)||(value.kind==='none')!==(value.generation===0)||typeof value.terminal!=='boolean'||!Number.isSafeInteger(value.sampledMs)||value.sampledMs<0||!Array.isArray(value.events)||value.events.length>8||new Set(value.events.map(e=>e.code)).size!==value.events.length||value.events.some(e=>!events.includes(e.code)||!Number.isSafeInteger(e.ms)||e.ms<0||e.ms>value.sampledMs)||value.kind==='none'&&(value.events.length||value.sampledMs))throw Error('Invalid timing');
  lastSequence=value.sequence;
  return 'request '+request+'; snapshot '+value.sequence+'; generation '+value.generation+'; kind '+value.kind+'; sample '+value.sampledMs+' ms; '+value.events.map(e=>e.code+' '+e.ms+' ms').join('; ');
 }
 function mount(container,rewarded,{active=()=>true,entry=false,canRun=()=>true,stopVoice=()=>{},onBusy=()=>{}}={}){
  let disposed=false,section=null,working=false,sampleRunning=false;
  const live=()=>!disposed&&active();
  const dispose=()=>{disposed=true;if(sampleRunning)rewarded?.cancelDiagnostic?.();section?.remove();};
  dispose.ready=(async()=>{
   await rewarded?.refreshDiagnostics?.();
   if(!live()||!rewarded?.diagnosticsAvailable?.())return;
   section=document.createElement('section');section.className='internal-ad-test';section.setAttribute('data-internal-ad-timing','');
   const controls=document.createElement('div'),note=document.createElement('p'),sample=document.createElement('button'),timing=document.createElement('button'),output=document.createElement('output');
   note.textContent='Internal testing only. Official sample ads add no game rounds. Timing is a diagnostic trace, not approval to serve ads.';
   sample.className=timing.className='small-button';sample.textContent='Internal QA · official sample ad';sample.setAttribute('data-sample-ad','');
   timing.textContent='Internal QA · sample ad timing';timing.setAttribute('data-sample-ad-timing','');output.setAttribute('data-ad-timing','');output.setAttribute('role','status');
   const enabled=()=>live()&&canRun()&&!working&&rewarded.diagnosticsAvailable();
   const busy=value=>{working=value;sample.disabled=value;timing.disabled=value;onBusy(value);};
   timing.onclick=async()=>{if(!enabled()||requestNumber>=1000000)return;const request=++requestNumber;busy(true);output.textContent='Sampling request '+request+'…';try{const value=await rewarded.diagnostics(request);if(live())output.textContent=timingText(value,request);}catch{if(live())output.textContent='Timing unavailable.';}finally{busy(false);}};
   sample.onclick=async()=>{if(!enabled()||!rewarded.diagnosticAdAvailable())return;sampleRunning=true;busy(true);output.textContent='Loading official sample…';stopVoice();try{const result=await rewarded.diagnosticAd();if(live())output.textContent=result.unavailable?'Sample unavailable. No game round was added.':'Sample closed. No game round was added.';}catch{if(live())output.textContent='Sample unavailable. No game round was added.';}finally{sampleRunning=false;busy(false);}};
   controls.append(note);if(rewarded.diagnosticAdAvailable())controls.append(sample);controls.append(timing,output);
   if(entry){const button=document.createElement('button');button.className='small-button';button.textContent='Internal ad testing';button.setAttribute('data-internal-ad-testing-entry','');button.setAttribute('aria-expanded','false');controls.hidden=true;button.onclick=()=>{if(!live()||working)return;controls.hidden=!controls.hidden;button.setAttribute('aria-expanded',String(!controls.hidden));};section.append(button);}
   section.append(controls);container.append(section);
  })();
  return dispose;
 }
 window.meadowLittlesAdTesting={mount};
})();
