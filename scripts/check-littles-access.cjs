const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const data=new Map(),storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};
const context={localStorage:storage};vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../meadow-market-littles/play-access.js'),'utf8'),context);const a=context.meadowLittlesAccess;let blocked=0;
a.configure({enabled:true,onBlocked:()=>blocked++});
for(let i=0;i<5;i++){assert(a.begin('bee_shelter'));assert(a.complete('bee_shelter'));assert(!a.complete('bee_shelter'),'Duplicate finish cannot spend another round');}
assert.equal(a.remaining('bee_shelter'),0);assert(!a.begin('bee_shelter'));assert.equal(blocked,1);
assert(a.begin('memory'));assert(a.begin('memory'),'A failed attempt/retry does not spend a round');assert.equal(a.remaining('memory'),5);a.complete('memory');assert.equal(a.remaining('memory'),4);
a.configure({plus:true});for(let i=0;i<12;i++){assert(a.begin('bee_shelter'));assert(a.complete('bee_shelter'));}a.configure({plus:false});assert(!a.begin('bee_shelter'),'Expired Plus returns to the free allowance');
const saved=JSON.parse(data.get('meadow-littles-rounds-v1'));saved.day='2026-01-01';storage.setItem('meadow-littles-rounds-v1',JSON.stringify(saved));assert.equal(a.remaining('bee_shelter'),5,'A new local day has a fresh allowance');
a.configure({enabled:false});assert(a.begin('bee_shelter'));assert.equal(a.remaining('bee_shelter'),Infinity,'Staged commerce cannot accidentally lock public practice');
console.log('Littles access: five successful rounds per game/day, failed attempts free, duplicate completion guard, independent games, Plus and expiry passed.');
