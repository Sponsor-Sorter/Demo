// Cache only a public offline notice. Never store dashboards, messages, API responses or payments.
const CACHE='sponsorsorter-offline-v1';
const OFFLINE='/app-assets/offline.html';
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.add(OFFLINE)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('sponsorsorter-offline-') && key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET' || event.request.mode!=='navigate' || new URL(event.request.url).origin!==self.location.origin)return;
 event.respondWith(fetch(event.request).catch(async()=>await caches.match(OFFLINE) || new Response('You are offline. Reconnect to use Sponsor Sorter.',{status:503,headers:{'Content-Type':'text/plain'}})));
});
