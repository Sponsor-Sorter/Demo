(() => {
 'use strict';let last=0;
 async function report(category,event){
  try{
   if(localStorage.getItem('meadow-diagnostics-opt-in')!=='1'||Date.now()-last<30000||!window.meadowSupabase)return;
   const url=category==='runtime'?new URL(event.filename||'',location.href):null;
   if(url&&(url.origin!==location.origin||!url.pathname.startsWith('/meadow-and-market/')))return;
   const module=url?.pathname.split('/').at(-1)||'unknown.js';if(!/^[a-z0-9-]{1,60}\.js$/.test(module))return;
   last=Date.now();const build=Number(document.querySelector('script[src^="game.js?v="]')?.getAttribute('src')?.match(/[?&]v=(\d+)/)?.[1])||0;
   await window.meadowSupabase.rpc('meadow_market_diagnostic_event',{p_build:build,p_module:module,p_line:Math.max(0,Math.min(1000000,Number(event.lineno)||0)),p_category:category});
  }catch{/* Error reporting must never cause a second game error. */}
 }
 window.addEventListener('error',e=>report('runtime',e));window.addEventListener('unhandledrejection',e=>report('promise',e));
 document.addEventListener('change',e=>{if(e.target.id==='diagnostics-opt-in')try{localStorage.setItem('meadow-diagnostics-opt-in',e.target.checked?'1':'0')}catch{}});
})();
