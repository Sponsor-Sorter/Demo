(() => {
  'use strict';
  let ring,target,resolve,timer=0;
  function clear(){clearInterval(timer);timer=0;target=null;resolve=null;if(ring)ring.hidden=true}
  function update(){
    if(document.hidden){if(ring)ring.hidden=true;return}
    if(!target?.isConnected&&resolve)target=resolve();
    if(!target?.isConnected){clear();return}
    const top=[...document.querySelectorAll('dialog[open]')].at(-1);
    if(top&&!top.contains(target)){ring.hidden=true;return}
    const rect=target.getBoundingClientRect(),style=getComputedStyle(target);
    if(!rect.width||!rect.height||style.visibility==='hidden'||style.display==='none'){ring.hidden=true;return}
    // Put the ring in the same top layer as its target, outside pointer routing.
    const host=top||document.body;if(ring.parentElement!==host)host.append(ring);
    const x=rect.left+rect.width/2,y=rect.top+rect.height/2;
    if(x<0||y<0||x>innerWidth||y>innerHeight){ring.hidden=true;return}
    const diameter=Math.max(38,Math.min(92,Math.min(rect.width,rect.height)*.65));
    ring.hidden=false;ring.style.left=x+'px';ring.style.top=y+'px';ring.style.width=diameter+'px';ring.style.height=diameter+'px';
  }
  function point(el,fallback){clear();if(!el)return;target=el;resolve=fallback;if(!ring){ring=document.createElement('div');ring.id='farm-guide-ring';ring.setAttribute('aria-hidden','true')}update();timer=setInterval(update,180)}
  document.addEventListener('pointerdown',e=>{if(target&&(target===e.target||target.contains(e.target)))clear()},true);
  document.addEventListener('close',e=>{if(!e.target.open&&target&&e.target.contains(target))clear()},true);
  window.addEventListener('pagehide',clear);document.addEventListener('visibilitychange',update);
  window.meadowGuideRing={point,clear};
})();
