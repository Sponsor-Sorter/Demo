/* Local camera frames stay on this device. No frames are uploaded. */
window.frontlinersScanResult='';
window.frontlinersStartScan=async function(){
 if(document.querySelector('#frontliners-scanner'))return;
 window.frontlinersScanResult='';
 let stream=null,frame=0,closed=false;
 const modal=document.createElement('dialog');modal.id='frontliners-scanner';
 modal.style.cssText='box-sizing:border-box;max-width:40rem;width:94%;padding:20px;border:20px solid transparent;border-image:url(ui-panel.png) 76 fill stretch;background:#081b2b;color:#fff0cf;font:18px system-ui';
 const title=document.createElement('h2');title.textContent='Scan local pairing QR';modal.append(title);
 const explanation=document.createElement('p');explanation.textContent='Scan the host offer or guest reply. Camera frames stay on this device.';modal.append(explanation);
 const video=document.createElement('video');video.muted=true;video.playsInline=true;video.autoplay=true;video.style.cssText='width:100%;max-height:60vh;object-fit:contain;background:#000';modal.append(video);
 const message=document.createElement('p');message.setAttribute('role','status');message.textContent='Allow camera access to scan.';modal.append(message);
 const cancel=document.createElement('button');cancel.textContent='Cancel';cancel.style.cssText='box-sizing:border-box;min-height:56px;padding:8px 16px;border:10px solid transparent;border-left-width:28px;border-right-width:28px;border-image:url(ui-button.png) 76 216 fill stretch;background:transparent;color:#fff0cf;font:inherit;cursor:pointer';modal.append(cancel);
 const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});
 function finish(result){if(closed)return;closed=true;window.frontlinersScanResult=result;cancelAnimationFrame(frame);stream?.getTracks().forEach(t=>t.stop());video.srcObject=null;modal.close();modal.remove()}
 cancel.onclick=()=>finish('CANCELLED');modal.addEventListener('cancel',e=>{e.preventDefault();finish('CANCELLED')});
 document.body.append(modal);modal.showModal();
 try{
  stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280}},audio:false});
  if(closed){stream.getTracks().forEach(t=>t.stop());return}
  video.srcObject=stream;await video.play();message.textContent='Hold the QR steady inside the camera view.';
  let last=0;
  function scan(now){
   if(closed)return;
   if(video.videoWidth&&now-last>100){
    last=now;const scale=Math.min(1,960/video.videoWidth);canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);
    ctx.drawImage(video,0,0,canvas.width,canvas.height);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
    const result=window.meadowLocalQR.read(pixels.data,canvas.width,canvas.height);
    if(result&&(result.startsWith('FLAN1.')||result.startsWith('https://sponsorsorter.com/frontlines/#lan='))){finish(result);return}
   }
   frame=requestAnimationFrame(scan);
  }
  frame=requestAnimationFrame(scan);
 }catch{message.textContent='Camera unavailable. Check camera permission, or paste a scanned pairing code. HTTPS or localhost is required.'}
};
