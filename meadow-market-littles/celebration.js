/* One brief celebration per result. No repeated sounds, timers or input-blocking overlays. */
(() => {
  'use strict';
  const selector='.fa-win-card,.next-result,.mini-result-card,.ws-win,.writing-congrats,.writing-name-result,.care-sheet,.fm-result>div,.together-end-overlay>section';
  const seen=new WeakSet();
  function decorate(root){
    if(seen.has(root)||!root.isConnected)return;
    const heading=root.querySelector('h2,h3')?.textContent||'';
    if(root.matches('.care-sheet')&&!/lovely caring/i.test(heading))return;
    if(/try again|another try|retry|try this delivery/i.test(heading))return;
    seen.add(root);if(getComputedStyle(root).position==='static')root.style.position='relative';root.classList.add('meadow-celebration');
    let stars=root.querySelector('.fa-win-stars,.mini-result-stars,.pip-result-stars,.find-result-stars,.coop-result-stars,.ws-win-stars,.writing-stars');
    if(!stars){stars=document.createElement('div');stars.className='meadow-win-stars';stars.setAttribute('aria-hidden','true');stars.textContent='★ ★ ★';root.querySelector('h2,h3')?.after(stars);}
    if(!stars.children.length&&/^[★✦✧\s]+$/.test(stars.textContent)){const symbols=[...stars.textContent].filter(s=>/★|✦|✧/.test(s));stars.textContent='';symbols.forEach((symbol,i)=>{const star=document.createElement('span');star.className='meadow-earned-star';star.style.setProperty('--star-order',i);star.textContent=symbol;stars.append(star);});}
    stars.classList.add('meadow-stars-arrive');
    const layer=document.createElement('div');layer.className='meadow-win-burst';layer.setAttribute('aria-hidden','true');
    layer.innerHTML=Array.from({length:16},(_,i)=>'<span style="--a:'+i*22.5+'deg;--d:'+(100+i%4*35)+'px;--delay:'+i%4*.08+'s;--shade:'+(['#ffd74c','#fff1b4','#f6b644','#e9d877'][i%4])+'">★</span>').join('');
    root.append(layer);setTimeout(()=>layer.remove(),2500);
    const buttons=[...root.querySelectorAll('button')].filter(b=>!b.disabled&&!b.hidden&&!/listen|hear|sound/i.test(b.textContent||''));
    const next=buttons.find(b=>/next letter|next adventure/i.test(b.textContent||''))||buttons.find(b=>/play again|another day|find more|build another|trace again|write my name|make another|another little job|play together again|back to market/i.test(b.textContent||''))||buttons[0];
    if(next){next.classList.add('meadow-next-button');if(!root.contains(document.activeElement))next.focus({preventScroll:true});}
  }
  function scan(node){if(node.nodeType!==1)return;if(node.matches(selector))decorate(node);node.querySelectorAll(selector).forEach(decorate);}
  const observer=new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)scan(node);});
  observer.observe(document.body,{childList:true,subtree:true});scan(document.body);
  window.meadowCelebration={decorate};
})();
