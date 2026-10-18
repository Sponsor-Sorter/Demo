const CACHE='meadow-market-v7';
const FILES=['./','./index.html','./style.css?v=10','./game.js?v=10','./manifest.webmanifest','./assets/icon-1024.png','./assets/apple-touch-icon.png','./assets/generated/willowbrook-meadow-map.png','./assets/generated/crop-patches-atlas-768.png','./assets/generated/meadow-tile.png','./assets/generated/garden-bed.png','./assets/generated/chicken-coop.png','./assets/generated/hen.png','./assets/generated/apple-tree.png','./assets/generated/market-stall.png','./assets/generated/hay-bale.png','./assets/generated/watering-can.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(c=>c.put(event.request,copy))}return response}).catch(()=>caches.match(event.request).then(hit=>hit||caches.match('./index.html'))))});
self.addEventListener('message',event=>{if(event.data==='SKIP_WAITING')self.skipWaiting()});

