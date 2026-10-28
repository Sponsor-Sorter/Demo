/* Reuse the actual Littles games and MLLAN1 protocol, without loading its account/save app. */
(()=>{'use strict';
 const origin=location.origin,embedded=parent!==window;
 const inform=type=>{if(embedded)parent.postMessage({type,version:1},origin)};
 const explanation='Open Play together in Meadow Markets or Meadow Market Littles. Use the same home Wi-Fi, choose the same game and shape, then exchange the two QR codes or paste the pairing codes. Devices stay linked while both games remain open. Guest Wi-Fi or VPNs may block the local connection.';
 function decorate(){const d=document.getElementById('together-dialog'),details=d?.querySelector('.together-lobby details p');if(details&&details.textContent!==explanation)details.textContent=explanation}
 new MutationObserver(decorate).observe(document.body,{childList:true,subtree:true});
 function open(){if(!window.meadowTogether){document.getElementById('family-start-status').textContent='Family games could not load. Reconnect and try again.';return}window.meadowTogether.open();const d=document.getElementById('together-dialog');if(!d.dataset.familyBound){d.dataset.familyBound='yes';d.addEventListener('close',()=>inform('meadow-family-close'))}const status=document.getElementById('family-start-status');status.hidden=true;const details=d.querySelector('.together-lobby details p');if(details)details.textContent='Open Play together in Meadow Markets or Meadow Market Littles. Use the same home Wi-Fi, choose the same game and shape, then exchange the two QR codes or paste the pairing codes. Devices stay linked while both games remain open. Guest Wi-Fi or VPNs may block the local connection.';inform('meadow-family-ready')}
 window.addEventListener('message',e=>{if(e.origin!==origin||e.source!==parent||e.data?.version!==1)return;if(e.data.type==='meadow-family-open')open();if(e.data.type==='meadow-family-hide')window.meadowTogether?.close()});
 // This entry intentionally has no farm account, database, reward or persistent room adapter.
 open();
})();
