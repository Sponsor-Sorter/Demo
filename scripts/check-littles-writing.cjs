'use strict';
require('../tools/littles-local/qa-network.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),T=require('../meadow-market-littles/tracing-core.js');
let cases=0;
// Exact boundary and a real finger path: five percentage points more forgiving.
const coverageHits=n=>Uint8Array.from({length:100},(_,i)=>i>0&&i<99&&i%7===0&&i/7<=100-n?0:1);
for(const [n,relaxedPass,strictPass]of [[86,false,false],[87,true,false],[91,true,false],[92,true,true]]){const hits=coverageHits(n);assert.equal(hits.reduce((a,b)=>a+b,0),n);assert.equal(T.strokeDone(hits,.87),relaxedPass);assert.equal(T.strokeDone(hits),strictPass);cases++;}
for(const end of [0,99]){const hits=coverageHits(100);hits[end]=0;assert(!T.strokeDone(hits,.87),'Both stroke ends remain required');cases++;}
const missingSection=coverageHits(100);missingSection.fill(0,10,23);assert(!T.strokeDone(missingSection,.87),'A large untouched section still blocks completion');cases++;
const {gappedStroke}=require('../tools/littles-local/tracing104-gestures.cjs');
for(const relaxed of [false,true]){const m=T.create('milk',{relaxed});for(const s of m.strokes)T.mark(m,s.letter==='l'?gappedStroke(s):s.points);const l=m.strokes.findIndex(s=>s.letter==='l');assert.equal(m.hits[l].reduce((a,b)=>a+b,0)/m.hits[l].length,.875);assert.equal(T.complete(m),relaxed);assert.equal(T.completedLetters(m)[2],relaxed);cases++;}
for(const letter of T.alphabet){const m=T.create(letter,{relaxed:true});for(let omit=0;omit<m.strokes.length;omit++){T.reset(m);m.strokes.forEach((s,i)=>{if(i!==omit)T.mark(m,s.points);});assert(!T.complete(m),'Gentler tracing still needs every stroke '+letter+' '+omit);cases++;}T.reset(m);m.strokes.forEach(s=>T.mark(m,s.points));assert(T.complete(m));cases++;}
for(const letter of T.alphabet){
  const m=T.create(letter);assert(m&&m.strokes.length,'Guide for '+letter);assert(!T.complete(m),'Blank guide cannot pass '+letter);
  for(const s of m.strokes)T.mark(m,s.points);
  assert(T.complete(m),'Complete guide passes '+letter);cases++;
  for(let omit=0;omit<m.strokes.length;omit++){
    T.reset(m);m.strokes.forEach((s,i)=>{if(i!==omit)T.mark(m,s.points);});
    assert(!T.complete(m),'Missing stroke '+omit+' must not pass '+letter);cases++;
  }
  T.reset(m);for(const s of m.strokes)T.mark(m,s.points.map(p=>({x:p.x+.025,y:p.y-.02})));
  assert(T.complete(m),'Small preschool tracing wobble is accepted '+letter);cases++;
}
for(const letter of ['A','H','E','F','T','t','f','i','j','X','x']){
  const m=T.create(letter);m.strokes.slice(0,-1).forEach(s=>T.mark(m,s.points));assert(!T.complete(m),'Crossbar/dot regression: '+letter);T.mark(m,m.strokes.at(-1).points);assert(T.complete(m));cases++;
}
for(const text of ['cat','dog','car','boy','girl','pig','apple','Amy','Éva','Zoë']){
  const m=T.create(text);assert(m,'Guide exists '+text);m.strokes.filter(s=>s.letter!==text.at(-1)).forEach(s=>T.mark(m,s.points));assert(!T.complete(m),'Word cannot skip final letter '+text);m.strokes.forEach(s=>T.mark(m,s.points));assert(T.complete(m),'Full word '+text);cases++;
  for(const [w,h]of[[290,240],[360,400],[710,700],[960,480]]){const v=T.layout(m,w,h);assert(v.scale>0);for(const s of m.strokes)for(const p of s.points){assert(p.x*v.scale+v.x>=0&&p.x*v.scale+v.x<=w,'Horizontal guide fits '+text);assert(p.y*v.scale+v.y>=0&&p.y*v.scale+v.y<=h,'Vertical guide fits '+text);}cases++;}
}
const scope={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../meadow-market-littles/sticker-words.js'),'utf8'),scope);const words=scope.window.meadowStickerWords;
assert.equal(words.length,23);assert.equal(new Set(words.map(w=>w.word)).size,words.length);
const more=scope.window.meadowExtraStickerWords;assert.equal(more.length,20);const all=[...words,...more];assert.equal(new Set(all.map(w=>w.word)).size,43);
for(const word of ['car','dog','cat','boy','girl','pig'])assert(words.some(w=>w.word===word),'Requested picture '+word);
for(const item of all){assert(/^[a-z]{3,5}$/.test(item.word));assert(item.image||item.sheet);for(const text of [item.word,item.word.toUpperCase()]){const m=T.create(text);assert(m);for(const stroke of m.strokes)T.mark(m,stroke.points);assert(T.complete(m),'Whole word '+text);T.reset(m);for(const stroke of m.strokes.filter(s=>s.letter!==text.at(-1)))T.mark(m,stroke.points);assert(!T.complete(m),'Final letter must be traced '+text);cases++;}if(item.rows){assert.equal(item.columns,3);assert.equal(item.rows,2);assert(item.frame>=0&&item.frame<6);}}
console.log(JSON.stringify({pass:true,cases,letters:T.alphabet.length,pictureWords:all.length,newPictures:more.length,crossbarsAndDotsRequired:true,preschoolToleranceAccepted:true,realAccounts:false}));
