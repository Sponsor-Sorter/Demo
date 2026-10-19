(() => {
  'use strict';
  const plain=o=>o&&typeof o==='object'&&!Array.isArray(o),finite=n=>typeof n==='number'&&Number.isFinite(n),safeId=s=>typeof s==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(s);
  function validate(raw,{maps,types,crops,vendors}){
    if(!plain(raw)||raw.version!==1||!plain(raw.farms)||!plain(raw.farms.willow))throw Error('Unsupported farm backup');
    function inspect(value,depth=0){if(depth>24)throw Error('Backup is too deeply nested');if(value&&typeof value==='object')for(const [key,item] of Object.entries(value)){if(['__proto__','prototype','constructor'].includes(key))throw Error('Unsafe backup key');inspect(item,depth+1)}}inspect(raw);
    const next=JSON.parse(JSON.stringify(raw));
    for(const key of ['coins','level','xp','rep'])if(!finite(next[key])||next[key]<(key==='level'?1:0)||next[key]>1e10)throw Error('Invalid farm progress');
    function inventory(bag){if(!plain(bag))throw Error('Invalid inventory');for(const [key,count] of Object.entries(bag))if(!/^[a-z0-9_-]{1,60}$/.test(key)||!finite(count)||count<0||count>1e10)throw Error('Invalid inventory amount')}
    if(next.inventory)inventory(next.inventory);
    let total=0;for(const [id,farm] of Object.entries(next.farms)){
      if(!maps.includes(id)||!plain(farm)||!Array.isArray(farm.objects)||farm.objects.length>2000)throw Error('Invalid farm area');total+=farm.objects.length;if(total>6000)throw Error('Farm backup is too large');
      const ids=new Set();for(const object of farm.objects){if(!plain(object)||!safeId(object.id)||ids.has(object.id)||!types.includes(object.type)||!finite(object.x)||!finite(object.y)||Math.abs(object.x)>50||Math.abs(object.y)>50)throw Error('Invalid farm object');ids.add(object.id);if(object.crop&&!crops.includes(object.crop))throw Error('Unknown crop');if(object.tier!==undefined&&(!finite(object.tier)||object.tier<0||object.tier>3||!Number.isInteger(object.tier)))throw Error('Invalid upgrade stage')}
      if(farm.inventory)inventory(farm.inventory);if(farm.shop?.stock)inventory(farm.shop.stock);
      if(farm.orders!==undefined&&!Array.isArray(farm.orders))throw Error('Invalid order board');
      farm.orders=(farm.orders||[]).slice(0,3).map((order,i)=>{const vendor=vendors.find(v=>v.name===order?.name);return vendor?{...JSON.parse(JSON.stringify(vendor)),id:safeId(order.id)?order.id:'restored-order-'+i}:null}).filter(Boolean);
    }
    if(!next.farms[next.active])next.active='willow';return next;
  }
  function prepare(next,current,now=Date.now()){
    const copy=JSON.parse(JSON.stringify(next));copy.friendCode=current.friendCode;copy.farmerName=current.farmerName;copy.seen=now;copy.view='farm';copy.mode='tend';delete copy.previous;delete copy.lastMove;delete copy.selected;delete copy.moving;delete copy.placing;return copy;
  }
  window.meadowBackups={validate,prepare};
})();
