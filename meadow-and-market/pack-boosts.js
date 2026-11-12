(() => {
 'use strict';
 const duration=15*60*1000;
 let api,source,owners=new WeakMap();
 const packs=()=>window.meadowPackCatalog||[];
 const data=()=>api?.state()?.packBenefits;
 function bind(a){api=a;source=null;owners=new WeakMap();}
 function mapOf(value){
  const s=api?.state();if(!s||!value)return null;
  if(source!==s){source=s;owners=new WeakMap();}
  if(owners.has(value))return owners.get(value);
  for(const [id,f] of Object.entries(s.farms||{})){owners.set(f,id);owners.set(f.objects,id);for(const o of f.objects)owners.set(o,id);}
  return owners.get(value)||null;
 }
 function windows(kind,map){return (data()?.windows||[]).filter(w=>w.kind===kind&&w.map===map);}
 const end=w=>w.until==null?Infinity:w.until;
 function extra(kind,value,from,to=Date.now()){
  const map=typeof value==='string'?value:mapOf(value);if(!map||to<=from)return 0;
  return windows(kind,map).reduce((n,w)=>n+Math.max(0,Math.min(to,end(w))-Math.max(from,w.from))*w.rate,0);
 }
 function rate(kind,value,now=Date.now()){const map=typeof value==='string'?value:mapOf(value);return windows(kind,map).reduce((n,w)=>n+(w.from<=now&&now<end(w)?w.rate:0),0);}
 // Integrate to every known expiry. A displayed countdown must not assume a
 // fifteen-minute booster lasts for the whole remaining growth cycle.
 function remaining(kind,value,work,now=Date.now(),base=1,baseChanges=[]){
  const map=typeof value==='string'?value:mapOf(value),ws=windows(kind,map),points=[...new Set([...ws.flatMap(w=>[w.from,end(w)]),...baseChanges.map(c=>c.at)].filter(t=>Number.isFinite(t)&&t>now))].sort((a,b)=>a-b);
  let at=now,left=Math.max(0,work),speed=base;
  for(const t of [...points,Infinity]){const r=speed+rate(kind,map,at),span=t-at;if(left<=span*r)return at-now+left/r;left-=span*r;at=t;for(const c of baseChanges)if(c.at===t)speed=c.rate;}
  return 0;
 }
 // Called by the verified reducer only. Client views never create paid state.
 function sync(s,grants,now){
  const items=api?.items;bind({state:()=>s,items});const b=s.packBenefits||={version:1,grants:[],used:{},windows:[]};
  b.grants=grants.map(g=>({...g}));b.used||={};b.windows||=[];
  const owned=new Set(s.collectionState?.owned||[]);
  for(const p of packs()){
   const g=b.grants.find(g=>g.sku===p.sku&&!g.revokedAt),maps=g&&owned.has(p.id)?Object.keys(s.farms).filter(id=>s.farms[id].objects.some(o=>o.type===p.id)):[];
   for(const w of b.windows.filter(w=>w.sku===p.sku&&w.permanent&&w.until==null))if(!maps.includes(w.map)||w.grant!==g?.id)w.until=now;
   for(const map of maps)if(!b.windows.some(w=>w.sku===p.sku&&w.map===map&&w.permanent&&w.until==null))b.windows.push({sku:p.sku,kind:p.boostKind,map,grant:g.id,from:now,until:null,rate:.05,permanent:true});
  }
  for(const w of b.windows){const g=b.grants.find(g=>g.id===w.grant);if(!g||g.revokedAt){const at=g?.revokedAt||now;w.until=Math.min(end(w),at);}}
  // Completed cycles already have enough unboosted time; their old windows
  // can be discarded. Keep every window needed by a still-running cycle.
  let oldest=now;
  for(const f of Object.values(s.farms)){
   for(const o of f.objects){const cycle=o.type==='plot'?o.plantedAt:o.type==='chicken'?o.lastProductAt:0;
    const max=o.type==='chicken'?30000:(api?.items?.[o.crop]?.time||86400000)*3;
    if(cycle>0&&now-cycle<max)oldest=Math.min(oldest,cycle);
   }
   if(Object.values(f.shop?.stock||{}).some(n=>n>0)&&f.shop.lastSaleAt>0)oldest=Math.min(oldest,f.shop.lastSaleAt);
  }
  b.windows=b.windows.filter(w=>end(w)>oldest);
  return b;
 }
 function activate(s,sku,map,now){
  const b=s.packBenefits,p=packs().find(p=>p.sku===sku);if(!p||!b||!s.farms[map])throw Error('Choose an owned pack and farm.');
  if(b.windows.some(w=>!w.permanent&&w.kind===p.boostKind&&w.map===map&&w.from<=now&&end(w)>now))throw Error('This booster is already running on this farm.');
  const g=b.grants.find(g=>g.sku===sku&&!g.revokedAt&&(b.used[g.id]||0)<g.charges);if(!g)throw Error('No boosters remain in this pack.');
  b.used[g.id]=(b.used[g.id]||0)+1;b.windows.push({sku,kind:p.boostKind,map,grant:g.id,from:now,until:now+duration,rate:.25,permanent:false});
  return {sku,map,until:now+duration,remaining:b.grants.filter(g=>g.sku===sku&&!g.revokedAt).reduce((n,g)=>n+Math.max(0,g.charges-(b.used[g.id]||0)),0)};
 }
 function status(sku,map,now=Date.now(),grants=data()?.grants||[]){const b=data(),p=packs().find(p=>p.sku===sku);return {remaining:grants.filter(g=>g.sku===sku&&!g.revokedAt).reduce((n,g)=>n+Math.max(0,g.charges-(b?.used?.[g.id]||0)),0),active:(b?.windows||[]).find(w=>w.sku===sku&&!w.permanent&&w.map===map&&w.from<=now&&end(w)>now),placed:!!p&&!!api?.state()?.farms?.[map]?.objects.some(o=>o.type===p.id)};}
 window.meadowPackBoosts={bind,sync,activate,status,extra,rate,remaining,mapOf,duration};
})();
