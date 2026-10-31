// Literal endpoint inventory only; this complements behavioural tests and UI
// acceptance. It does not claim that every possible local mutation is proven.
const fs=require('node:fs'),assert=require('node:assert/strict');
const server=['meadow-farm-actions204.ts','meadow-progression205.ts','meadow-workers205.ts','meadow-trips208.ts'].map(f=>fs.readFileSync('supabase/functions/_shared/'+f,'utf8')).join('\n');
const supported=new Set([...server.matchAll(/case '([a-z]+\.[a-z_]+)'/g)].map(m=>m[1])),routes=new Map();
for(const file of fs.readdirSync('meadow-and-market').filter(f=>f.endsWith('.js')&&f!=='sw.js')){
 const text=fs.readFileSync('meadow-and-market/'+file,'utf8');
 const patterns=[/(?:command\(|\.route\(|verified\(s,)\s*['"]([a-z]+\.[a-z_]+)['"]/g,/\btype:\s*['"]((?:workers|shop|social|market|farm|build|trip)\.[a-z_]+)['"]/g];
 for(const pattern of patterns)for(const m of text.matchAll(pattern)){const owners=routes.get(m[1])||new Set();owners.add(file);routes.set(m[1],owners);}
}
for(const [type,files]of routes)assert(supported.has(type),'Client endpoint has no strict server handler: '+type+' in '+[...files].join(', '));
for(const type of ['farm.initialize','build.put_away','social.visit','workers.return','workers.tick'])assert(routes.has(type),'Critical endpoint disappeared: '+type);
console.log(routes.size+' literal command endpoints resolve to strict server handlers. Dynamic routes and mutation semantics retain separate tests.');
