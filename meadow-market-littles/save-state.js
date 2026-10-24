(() => {
  'use strict';
  const isObject=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
  const validNumbers=o=>isObject(o)&&Object.values(o).every(n=>Number.isFinite(n)&&n>=0);
  const defaults=()=>({schema:1,stars:0,gems:0,xp:0,minigames:{records:{},rewards:{},artGallery:{}},care:{},market:{},purchases:{},adFree:false,farms:{littles:{inventory:Object.fromEntries(['apple','carrot','tomato','corn','pumpkin','strawberry'].map(x=>[x,30])),objects:[]}}});
  function valid(s){return s?.schema===1&&['stars','xp'].every(k=>Number.isFinite(s[k])&&s[k]>=0)&&(s.gems===undefined||Number.isFinite(s.gems)&&s.gems>=0)&&isObject(s.minigames)&&['records','rewards'].every(k=>isObject(s.minigames[k]))&&(s.minigames.artGallery===undefined||isObject(s.minigames.artGallery))&&(s.minigames.petGrowth===undefined||Number.isInteger(s.minigames.petGrowth)&&s.minigames.petGrowth>=0&&s.minigames.petGrowth<=12)&&Object.values(s.minigames.records).every(r=>isObject(r)&&['wins','best','bestScore','level'].every(k=>r[k]===undefined||Number.isFinite(r[k])&&r[k]>=0))&&isObject(s.farms)&&isObject(s.farms.littles)&&validNumbers(s.farms.littles.inventory)&&Array.isArray(s.farms.littles.objects)&&(s.farms.littles.objects.every(isObject))&&isObject(s.care)&&isObject(s.market)&&isObject(s.purchases)&&(typeof s.adFree==='boolean');}
  function migrate(s){
    if(!isObject(s)||s.schema!==1||!['stars','xp'].every(k=>Number.isFinite(s[k])&&s[k]>=0))return null;
    if(s.gems!==undefined&&(!Number.isFinite(s.gems)||s.gems<0))return null;
    for(const k of ['minigames','farms','care','market','purchases'])if(s[k]!==undefined&&!isObject(s[k]))return null;
    if(s.adFree!==undefined&&typeof s.adFree!=='boolean')return null;
    const mini=s.minigames||{};if(!isObject(mini.records||{})||!isObject(mini.rewards||{})||!isObject(mini.artGallery||{}))return null;
    if(Object.values(mini.records||{}).some(r=>!isObject(r)||['wins','best','bestScore','level'].some(k=>r[k]!==undefined&&(!Number.isFinite(r[k])||r[k]<0))))return null;
    if(s.inventory!==undefined&&!validNumbers(s.inventory))return null;const farms={...(s.farms||{})};if(farms.littles!==undefined&&!isObject(farms.littles))return null;
    const littles={...defaults().farms.littles,...(farms.littles||{})};
    const oldInventory=littles.inventory??{};
    if(!validNumbers(oldInventory))return null;
    littles.inventory={...defaults().farms.littles.inventory,...(s.inventory||{}),...oldInventory};
    if(littles.objects===undefined)littles.objects=[];if(!Array.isArray(littles.objects)||!littles.objects.every(isObject))return null;
    farms.littles=littles;
    const result={...defaults(),...s,minigames:{records:{},rewards:{},artGallery:{},...mini,records:{...(mini.records||{})},rewards:{...(mini.rewards||{})},artGallery:{...(mini.artGallery||{})}},care:{...(s.care||{})},market:{...(s.market||{})},purchases:{...(s.purchases||{})},farms};
    return valid(result)?result:null;
  }
  function load(storage,key){
    let raw;try{raw=storage.getItem(key)}catch{return {state:defaults(),writable:false,migrated:false,message:'Saved progress is protected because this device cannot read it right now.'}}if(raw===null)return {state:defaults(),writable:true,migrated:false,message:''};
    let saved;try{saved=JSON.parse(raw)}catch{return {state:defaults(),writable:false,migrated:false,message:'Saved progress needs a grown-up’s help. It is protected; this play will not be saved.'}}
    if(valid(saved))return {state:saved,writable:true,migrated:false,message:''};
    const old=migrate(saved);if(old){try{storage.setItem(key,JSON.stringify(old));return {state:old,writable:true,migrated:true,message:''}}catch{return {state:old,writable:false,migrated:true,message:'Saved progress is protected because this device cannot write right now.'}}}
    return {state:defaults(),writable:false,migrated:false,message:'Saved progress is from a newer or damaged version. It is protected; this play will not be saved.'};
  }
  function write(storage,key,state,writable){if(!writable||!valid(state))return false;try{storage.setItem(key,JSON.stringify(state));return true}catch{return false}}
  globalThis.meadowLittlesSaveState={defaults,valid,migrate,load,write};
})();