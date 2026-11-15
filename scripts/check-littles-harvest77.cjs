const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../meadow-market-littles'),scope={window:{}};
for(const file of ['game-previews.js','harvest58-core.js','approved-voices.js'])vm.runInNewContext(fs.readFileSync(root+'/'+file,'utf8'),scope);
const C=scope.window.meadowHarvest58Core;
assert.deepEqual(Array.from(C.milestones),[1,4,9,16]);
for(const [level,step]of [[0,0],[1,0],[3,0],[4,1],[8,1],[9,2],[15,2],[16,3],[999,3]])assert.equal(C.profile(level).step,step);
function correct(r){const s=r.state;if(r.kind==='fuller'){const side=s.slots.indexOf(null);return side<0?r.act('choose',{item:s.amounts.indexOf(Math.max(...s.amounts))}):r.act('place',{item:[0,1].find(i=>!s.slots.includes(i)),target:side});}if(r.kind==='count'&&s.moved.length===s.count)return r.act('answer',{number:s.count});const item=s.items.findIndex((id,i)=>!s.moved.includes(i)&&(r.kind!=='pick'||id===s.wanted)&&(r.kind!=='order'||id===s.order[s.moved.length]));return r.act('place',{item,target:r.kind==='home'?C.home(s.items[item]):r.kind==='sort'?C.family(s.items[item]):'basket'});}
function wrong(r){const s=r.state;if(r.kind==='fuller'){if(s.slots.some(v=>v===null))return r.miss();return r.act('choose',{item:s.amounts.indexOf(Math.min(...s.amounts))});}if(r.kind==='count'&&s.moved.length===s.count)return r.act('answer',{number:s.choices.find(n=>n!==s.count)});let item=s.items.findIndex((_,i)=>!s.moved.includes(i)),target='label';if(r.kind==='pick')item=s.items.findIndex(id=>id!==s.wanted),target='basket';if(r.kind==='order')item=s.items.findIndex((id,i)=>!s.moved.includes(i)&&id!==s.order[s.moved.length]),target='basket';if(r.kind==='home')target=C.home(s.items[item])==='coop'?'barn':'coop';if(r.kind==='sort')target=C.family(s.items[item])==='fruit'?'vegetable':'fruit';return r.act('place',{item,target});}
let tasks=0,steps=0;const six=new Set();
for(let seed=1;seed<=60;seed++)for(const level of C.milestones)for(const g of C.catalog)for(let index=0;index<3;index++){
 const r=new C.Round(g.kind,{seed,level,index,progressive:true}),s=r.state,p=C.profile(level),before=JSON.stringify(s);
 assert(r.act('place',{item:999,target:'basket'}).ignored);assert(r.act('unknown').ignored);assert.equal(r.misses,0);assert.equal(JSON.stringify(s),before);assert.equal(r.requestHint(),null);
 if(g.kind==='pick'){assert.equal(s.items.length,p.pickChoices);assert.equal(s.items.filter(id=>id===s.wanted).length,p.pickNeeded);}
 if(g.kind==='order'){assert.equal(s.order.length,p.orderLength);assert.equal(s.items.length,p.orderChoices);assert.equal(new Set(s.order).size,s.order.length);}
 if(g.kind==='home')assert.equal(s.items.length,p.friends);
 if(g.kind==='sort'){assert.equal(s.items.length,p.sortChoices);assert(s.items.some(id=>C.family(id)==='fruit')&&s.items.some(id=>C.family(id)==='vegetable'));}
 if(g.kind==='count'){assert(s.count>=p.countMin&&s.count<=p.countMax);assert.equal(s.choices.length,p.numberChoices);assert.equal(new Set(s.choices).size,s.choices.length);assert(s.choices.every(n=>n>=1&&n<=8));assert(s.choices.includes(s.count));assert(r.act('answer',{number:s.count}).ignored);six.add(s.count);}
 if(g.kind==='fuller'){assert.equal(Math.abs(s.amounts[0]-s.amounts[1]),p.basketGap);assert(s.amounts.every(n=>n>=1&&n<=6));assert(r.act('choose',{item:0}).ignored);}
 let guard=0;
 while(!r.done){assert(guard++<14);const saved=JSON.stringify(s),progress=r.kind==='fuller'?s.slots.filter(v=>v!==null).length:s.moved.length;
  assert(wrong(r).mistake);assert.equal(r.misses,1);assert.equal(r.requestHint(),null);assert.equal(r.hint,null,'No automatic answer highlight');assert(wrong(r).helpReady);assert.equal(JSON.stringify(s),saved,'Wrong choices preserve pieces and progress');
  const hint=r.requestHint();assert(hint&&hint.caption);assert.equal(JSON.stringify(s),saved,'Optional help cannot award progress');assert.equal(r.done,false);assert.equal(r.misses,2);
  for(const key of hint.sources){if(key.startsWith('number-'))assert(s.choices.includes(Number(key.slice(7)))&&Number(key.slice(7))===s.count);else assert(Number(key)>=0&&(r.kind==='fuller'?!s.slots.includes(Number(key)):!s.moved.includes(Number(key))));}
  const answer=correct(r);assert(answer.ok);assert.equal(r.misses,0);assert.equal(r.hint,null);assert.equal(r.requestHint(),null);assert((r.kind==='fuller'?s.slots.filter(v=>v!==null).length:s.moved.length)>=progress);steps++;
 }
 const end=JSON.stringify(s);assert(r.act('place',{item:0,target:'basket'}).duplicate);assert(r.miss().ignored);assert.equal(JSON.stringify(s),end);tasks++;
}
assert(six.has(6));assert.equal(C.profile(16).basketGap,1,'Advanced comparisons are closer, rather than farther apart');
for(let seed=1;seed<=60;seed++)for(const level of C.milestones){const counts=[0,1,2].map(index=>new C.Round('count',{seed,level,index,progressive:true}).state.count);assert(counts.includes(C.profile(level).countMax),'Each counting round includes the selected challenge maximum');assert.equal(new Set(counts).size,3,'Three counting adventures use different quantities');}
const manifest=JSON.parse(fs.readFileSync(root+'/assets/audio/harvest77-generation.json')),f=manifest.files[0],registry=scope.window.meadowApprovedVoices;
assert.equal(manifest.files.length,1);assert.equal(f.id,'harvest77-rhys-number-6');assert.equal(f.text,'Six.');assert.equal(f.farmer,'rhys');assert.equal(f.voice,registry.cast.rhys);assert(f.sourceFile&&f.sourceSha256);assert.equal(crypto.createHash('sha256').update(fs.readFileSync(root+'/assets/audio/'+f.id+'.mp3')).digest('hex'),f.sha256);assert.equal(registry.clips[f.id].farmer,'rhys');
const player=fs.readFileSync(root+'/harvest58-play.js','utf8'),views=fs.readFileSync(root+'/harvest58-views.js','utf8'),css=fs.readFileSync(root+'/harvest58.css','utf8'),cache=fs.readFileSync(root+'/sw.js','utf8');
for(const id of ['classic72-jade-hint','classic72-jay-hint','discovery70-rhys-hint'])assert(registry.clips[id]&&cache.includes('./assets/audio/'+id+'.mp3'));
assert(cache.includes('./assets/audio/'+f.id+'.mp3?v=56'));assert(views.includes("a.progressive&&a.state.moved.length===6?'harvest77-rhys-number-6'"));assert(player.includes('progressive:quality()>=77'));assert(player.includes('if(s.drag?.id===e.pointerId)stopDrag(s)'));assert(player.includes('else if(s.progressive)miss(s)'));assert(css.includes('.hp-growing-intro')&&css.includes('background:transparent'));
console.log('Littles growing harvest77: '+tasks+' full three-part tasks / '+steps+' correct steps; four bounded challenges, opt-in hints after two real mistakes, reset on progress, no hint awards, invalid/duplicate guards, closer comparisons and approved Rhys six passed.');
