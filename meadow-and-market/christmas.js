(() => {
 'use strict';
 const start=Date.parse('2026-12-01T00:00:00Z'),end=Date.parse('2027-01-01T00:00:00Z'),base='assets/generated/christmas267/';
 const catalog=[
  {id:'collection_xmas_tree',name:'Meadow Christmas tree',file:'christmas-tree',w:1,h:1,chapter:0,description:'A fir tree dressed in warm lights and red and gold ornaments. Earned with your first Christmas delivery.'},
  {id:'collection_xmas_presents',name:'Village gift stack',file:'christmas-presents',w:1,h:1,chapter:1,description:'Holly-wrapped gifts from the village. Complete six Christmas deliveries to earn this keepsake.'},
  {id:'collection_xmas_lantern',name:'Holly lantern',file:'christmas-lantern',w:1,h:1,seals:20,description:'A warm candle lantern nestled in holly, berries and pinecones.'},
  {id:'collection_xmas_wreath',name:'Candlelight wreath',file:'christmas-wreath',w:1,h:1,seals:35,description:'A glowing Christmas centrepiece with evergreen boughs and golden bows.'},
  {id:'collection_xmas_globe',name:'Starlight snow globe',file:'christmas-snowglobe',w:1,h:1,gems:35,gold:400,items:{wheat:8,apple:4},description:'A tiny Christmas tree under sparkling glass. Includes 400 gold, 8 wheat and 4 apples.'},
  {id:'collection_xmas_pavilion',name:'Golden bell pavilion',file:'christmas-pavilion',w:2,h:2,gems:65,gold:900,items:{wheat:12,egg:8},description:'A festive timber pavilion with a tree, garlands and golden bells. Includes 900 gold, 12 wheat and 8 eggs.'}
 ].map(i=>({...i,art:base+i.file+'.webp',thumb:base+i.file+'-thumb.webp',kind:'collection',set:'A Meadow Christmas · 2026',theme:'christmas',rarity:'seasonal',effect:'none',price:0,walkable:false,purchaseOnly:true}));
 const chapters=[
  {id:'welcome',goal:1,farmer:'Jade',title:'A light in the meadow',text:'Farmer Jade is collecting fresh farm goods for the village Christmas table. Fill one basket and bring home your own Christmas tree.',item:'collection_xmas_tree',gold:100},
  {id:'gifts',goal:6,farmer:'Rhys',title:'Handmade Christmas',text:'Farmer Rhys has finished the gift boxes. Help fill six village baskets and he will save a gift display for your farm.',item:'collection_xmas_presents',gold:200},
  {id:'neighbours',goal:12,farmer:'Jay',title:'A basket for every neighbour',text:'Farmer Jay is making sure nobody is missed. Twelve deliveries earn extra seals for the Christmas stall.',seals:25,gold:350},
  {id:'celebration',goal:24,farmer:'Jade',title:'Christmas, grown together',text:'The village table is ready. Complete twenty-four deliveries to finish our Christmas story and collect the celebration gift.',seals:30,gold:1000}
 ];
 const day=now=>new Date(now).toISOString().slice(0,10),phase=now=>now<start?'preview':now<end?'active':'ended';
 const book=s=>s.christmas2026||{seals:0,gifts:[],deliveries:[],chapters:[],owned:[]};
 const owned=s=>(book(s).owned||[]).filter(id=>catalog.some(i=>i.id===id&&!i.gems));
 function orders(now){const key=day(now),n=Number(key.slice(-2)),pools=[
  [{carrot:6},{wheat:6},{carrot:3,wheat:3},{wheat:4,apple:2}],
  [{apple:4},{egg:4},{apple:2,egg:2},{carrot:4,apple:2}],
  [{wheat:4,egg:2},{carrot:4,egg:2},{wheat:3,apple:3},{carrot:3,wheat:3,apple:1}]
 ];return pools.map((pool,slot)=>({id:key+':'+slot,slot,farmer:['Jade','Rhys','Jay'][slot],title:['Christmas table','Handmade hampers','Neighbours’ baskets'][slot],items:pool[(n+slot)%pool.length],seals:3}));}
 function gift(now){const n=Number(day(now).slice(-2));return {day:day(now),gold:n===25?500:60+(n%3)*20,seals:n===25?15:5,items:n===25?{wheat:12,egg:6}:n%3===0?{apple:3}:n%3===1?{carrot:4}:{wheat:4}};}
 function act(s,type,target,now,serverOwned=[]){
  if(phase(now)!=='active')return {error:now<start?'Christmas opens on 1 December (UTC).':'Christmas 2026 has ended. Your decorations stay yours.'};
  const b=s.christmas2026||={seals:0,gifts:[],deliveries:[],chapters:[],owned:[]},bag=s.farms.willow.inventory;
  const add=items=>{for(const [k,n]of Object.entries(items||{}))bag[k]=(Number(bag[k])||0)+n;};
  if(type==='christmas.gift'){
   const g=gift(now);if(target!==g.day)return {error:'Open today’s present again.'};if(b.gifts.includes(g.day))return {error:'Today’s present is already open.'};
   b.gifts.push(g.day);b.seals+=g.seals;add(g.items);return {ok:true,gold:g.gold,message:'Present opened · '+g.seals+' Christmas seals + farm supplies'};
  }
  if(type==='christmas.deliver'){
   const o=orders(now).find(o=>o.id===target);if(!o)return {error:'These baskets have changed. Open today’s deliveries.'};if(b.deliveries.includes(target))return {error:'This Christmas basket was already delivered.'};
   if(Object.entries(o.items).some(([k,n])=>(Number(bag[k])||0)<n))return {error:'Grow or collect the missing goods first.'};
   for(const [k,n]of Object.entries(o.items))bag[k]-=n;b.deliveries.push(target);b.seals+=o.seals;
   return {ok:true,gold:100,xp:8,message:'Basket delivered · 100 gold + 3 Christmas seals'};
  }
  if(type==='christmas.chapter'){
   const c=chapters.find(c=>c.id===target);if(!c||b.chapters.includes(target)||b.deliveries.length<c.goal||chapters.slice(0,chapters.indexOf(c)).some(c=>!b.chapters.includes(c.id)))return {error:'Finish and collect the previous Christmas chapter first.'};
   b.chapters.push(c.id);b.seals+=c.seals||0;if(c.item&&!b.owned.includes(c.item))b.owned.push(c.item);
   return {ok:true,gold:c.gold,message:c.item?'Christmas keepsake unlocked · place it from Decorations':'Christmas chapter complete · gold and seals collected'};
  }
  if(type==='christmas.redeem'){
   const i=catalog.find(i=>i.id===target&&i.seals);if(!i)return {error:'Choose a Christmas seal decoration.'};if(b.owned.includes(target)||serverOwned.includes(target))return {error:'You already own this decoration.'};if(b.seals<i.seals)return {error:'Earn more Christmas seals through presents and deliveries.'};
   b.seals-=i.seals;b.owned.push(i.id);return {ok:true,message:i.name+' is yours to keep'};
  }
  return {error:'Choose a current Christmas activity.'};
 }
 window.meadowChristmas={start,end,base,catalog,chapters,day,phase,book,owned,orders,gift,act};
})();
