/* A failed attempt never spends a round. This ledger contains no paid entitlements. */
(() => {
  'use strict';
  const key='meadow-littles-rounds-v1',tickets=new Map();
  let enabled=false,plus=false,blocked=()=>{},storage=globalThis.localStorage;
  const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
  function ledger(){try{const x=JSON.parse(storage.getItem(key)||'null');if(x&&/^\d{4}-\d{2}-\d{2}$/.test(x.day)&&x.counts&&typeof x.counts==='object'&&!Array.isArray(x.counts))return {day:x.day,counts:Object.fromEntries(Object.entries(x.counts).filter(([id,n])=>/^[a-z0-9_-]{1,80}$/.test(id)&&Number.isInteger(n)&&n>=0&&n<1000000))};}catch{}return {day:today(),counts:{}};}
  function read(){let x=ledger();const day=today();if(x.day<day)x={day,counts:{}};return x;}
  function remaining(id){return !enabled||plus?Infinity:Math.max(0,5-(read().counts[id]||0));}
  function begin(id,onBlocked){if(typeof id!=='string'||!/^[a-z0-9_-]{1,80}$/.test(id))return false;if(remaining(id)===0){tickets.delete(id);onBlocked?.();blocked(id);return false;}tickets.set(id,{done:false});return true;}
  function complete(id){const ticket=tickets.get(id);if(!ticket||ticket.done)return false;ticket.done=true;if(!enabled)return true;const x=read();x.counts[id]=(x.counts[id]||0)+1;try{storage.setItem(key,JSON.stringify(x));}catch{/* Play remains available if device storage fails. */}return true;}
  function configure(options={}){if(typeof options.enabled==='boolean')enabled=options.enabled;if(typeof options.plus==='boolean')plus=options.plus;if(typeof options.onBlocked==='function')blocked=options.onBlocked;if(options.storage)storage=options.storage;}
  globalThis.meadowLittlesAccess={begin,complete,remaining,configure,getStatus:()=>({enabled,plus,freeDailyRounds:5})};
})();
