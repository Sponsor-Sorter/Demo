/* Only the game's own named caches are eligible. Changed bytes must match the release manifest. */
self.meadowPrecache=async function(name,files,revisions){
 const cache=await caches.open(name),metadata='./__asset_revisions__',previous=[];
 const keys=(await caches.keys()).filter(k=>k.startsWith('meadow-market-v')&&k!==name).sort((a,b)=>Number(b.split('-v').at(-1))-Number(a.split('-v').at(-1))).slice(0,2);
 for(const key of keys){const old=await caches.open(key);let hashes={};try{hashes=await(await old.match(metadata))?.json()||{}}catch{}previous.push({cache:old,hashes})}
 const digest=async response=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await response.clone().arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');
 let cursor=0;
 async function ensure(url){const expected=revisions[url];if(expected){for(const old of previous){const hit=await old.cache.match(url);if(!hit?.ok)continue;if(old.hashes[url]===expected||await digest(hit)===expected){await cache.put(url,hit);return}}}
  const response=await fetch(new Request(url,{cache:'no-cache'}));if(!response.ok)throw Error('Update download failed: '+url);
  if(expected&&await digest(response)!==expected)throw Error('Update asset revision mismatch: '+url);
  await cache.put(url,response);
 }
 await Promise.all(Array.from({length:6},async()=>{while(cursor<files.length){const url=files[cursor++];await ensure(url)}}));
 await cache.put(metadata,new Response(JSON.stringify(revisions),{headers:{'content-type':'application/json'}}));
};
