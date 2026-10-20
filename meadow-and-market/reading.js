(() => {
 'use strict';
 const expanded=new Map();
 function eligible(p){const text=p.textContent.trim();return text.length>150&&!p.id&&!p.closest('details,.club-confirm,.account-screen,#update-dialog,#minigames-dialog,#care-sheet,.fm-dialog')&&!p.querySelector('button,a,input,select,progress,[role="status"]')&&!/\b(backup|reset|delete|replace|warning|cannot|can’t|can't|no money|no card|free test|gems|gold|cost|price|reward)\b/i.test(text)}
 function compact(root){if(!root)return;for(const p of root.querySelectorAll('p.sheet-copy,.task-card>p,.club-paper>p')){if(!eligible(p))continue;const text=p.textContent.trim(),first=text.match(/^(.{20,100}?[.!?])(?:\s|$)/)?.[1],key=text.slice(0,240),details=document.createElement('details'),summary=document.createElement('summary');details.className='reading-details';summary.textContent=first||'More details';details.append(summary);p.before(details);details.append(p);details.open=expanded.get(key)===true;details.addEventListener('toggle',()=>{expanded.set(key,details.open);if(expanded.size>200)expanded.delete(expanded.keys().next().value)})}}
 window.meadowReading={compact,eligible};
})();
