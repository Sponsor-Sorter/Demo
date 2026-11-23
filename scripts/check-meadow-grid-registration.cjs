'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const css=fs.readFileSync(path.join(root,'meadow-and-market/style.css'),'utf8');
const html=fs.readFileSync(path.join(root,'meadow-and-market/index.html'),'utf8');
const workers=fs.readFileSync(path.join(root,'supabase/functions/_shared/meadow-workers205.ts'),'utf8');
const scene=html.match(/<div\s+class="([^"]+)"\s+id="farm-land"/);
assert(scene,'Actual main farm markup is required');
const classes=scene[1].split(/\s+/);
const projection=workers.match(/p=map==='willow'\?\{x:([\d.]+),y:([\d.]+),w:([\d.]+),h:([\d.]+)\}:\{x:([\d.]+),y:([\d.]+),w:([\d.]+),h:([\d.]+)\}/);
assert(projection,'Canonical server projection is required');
const bounds=n=>{const [x,y,w,h]=projection.slice(n,n+4).map(Number);return{left:x,right:100-x-w*100,top:y,bottom:100-y-h*100}};
const rules=[...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m=>({selectors:m[1].trim().split(','),body:m[2]}));
function registration(map,main){
 const matches=rules.filter(r=>r.selectors.some(s=>{
  s=s.trim();
  if(s==='.farm-grid')return true;
  const m=s.match(/^(#farm-land|\.farm-land)\[data-map="([^"]+)"\] \.farm-grid$/);
  return m&&m[2]===map&&(m[1]==='#farm-land'?main:!main||classes.includes('farm-land'));
 }));
 const result={};
 for(const r of matches)for(const m of r.body.matchAll(/(?:^|;)\s*(left|right|top|bottom):([\d.]+)%!important/g))result[m[1]]=Number(m[2]);
 return result;
}
let checks=0;
for(const map of ['willow','east','back','coast','pine','orchard']){
 const expected=bounds(map==='willow'?1:5);
 for(const main of [true,false])for(const [key,value]of Object.entries(expected)){
  assert(Math.abs(registration(map,main)[key]-value)<1e-8,`${map} ${main?'actual main':'preview/visitor'} ${key} must match canonical server bounds`);checks++;
 }
}
console.log(`Map registration source contract: ${checks} canonical bounds passed, actual main classes: ${classes.join(' ')}`);
