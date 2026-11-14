/* Hands-on farm play. Coordinates are fractions of the unobstructed playfield. */
(function(root){
 'use strict';
 const ids=['eggs','milk','flowers','memory','sorting'];
 const crops=['apple','strawberry','pear','carrot','corn','potato'];
 const flowerSpots=[{x:.2,y:.3},{x:.75,y:.28},{x:.27,y:.64},{x:.73,y:.65}];
 const plots=[{x:.23,y:.54},{x:.5,y:.54},{x:.77,y:.54}];
 const mudSpots=[{x:.4,y:.39},{x:.49,y:.45},{x:.56,y:.35}];
 const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
 const near=(p,q,r=.16)=>p&&Math.hypot(p.x-q.x,p.y-q.y)<r;
 function shuffled(a,r){a=a.slice();for(let i=a.length-1;i;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a;}
 function create(id,level=1,random=Math.random){
  if(!ids.includes(id))throw Error('Unknown farm activity');
  level=clamp(Math.floor(level)||1,1,99);
  const pairs=Math.min(6,3+Math.floor((level-1)/4)),types=shuffled(crops,random).slice(0,level<4?2:3);
  const s={id,level,phase:({eggs:'catch',milk:'wash',flowers:'nectar',memory:'match',sorting:'sort'})[id],
   time:0,score:0,goal:0,gesture:null,events:[],random,phaseVersion:0,done:false,doneAt:0,
   basket:{x:.5,y:.84},eggs:[],eggClock:.5,eggSerial:0,caught:0,catchGoal:Math.min(10,6+Math.floor((level-1)/3)),movedBasket:false,
   mud:[0,0,0],pumps:0,pumpGoal:3,stream:0,bee:{x:.5,y:.17},flight:null,visited:[],picked:[],
   pairs,deck:[],open:[],matched:[],resetAt:0,matchedAt:0,water:[0,0,0],harvested:[],
   types,queue:[],sorted:0,loaded:[],push:0,pushX:.25};
  s.deck=shuffled(shuffled(crops,random).slice(0,pairs).flatMap(id=>[id,id]),random);
  s.queue=shuffled(Array.from({length:6},(_,i)=>types[i%types.length]),random);
  s.goal=({eggs:s.catchGoal+2,milk:7,flowers:8,memory:pairs+6,sorting:6+types.length+1})[id];
  return s;
 }
 function event(s,type,data={}){s.events.push({type,...data});}
 function phase(s,next){s.phase=next;s.phaseVersion++;s.gesture=null;s.flight=null;event(s,'phase',{phase:next});}
 function finish(s){if(s.done)return;s.score=s.goal;s.done=true;s.doneAt=s.time;phase(s,'done');}
 function card(s,i){
  if(s.phase!=='match'||!Number.isInteger(i)||i<0||i>=s.deck.length||s.open.length===2||s.open.includes(i)||s.matched.includes(i))return false;
  s.open.push(i);event(s,'word',{id:s.deck[i]});
  if(s.open.length===2){if(s.deck[s.open[0]]===s.deck[i]){s.matched.push(...s.open);s.open=[];s.score++;event(s,'success');if(s.matched.length===s.deck.length)s.matchedAt=s.time+1.6;}else s.resetAt=s.time+.85;}
  return true;
 }
 function start(s,p,target=''){
  if(s.done||s.gesture)return false;
  s.gesture={start:{...p},last:{...p},target,version:s.phaseVersion,distance:0,pumpReady:s.phase==='pump'&&near(p,{x:.56,y:.46},.22)};
  if(s.phase==='catch'){s.basket.x=clamp(p.x,.11,.89);s.movedBasket=true;}
  if(s.phase==='nectar')s.flight={...p};
  return true;
 }
 function move(s,p){
  const g=s.gesture;if(!g||g.version!==s.phaseVersion)return;
  const d=Math.min(.12,Math.hypot(p.x-g.last.x,p.y-g.last.y));g.distance+=d;
  if(s.phase==='catch'){s.basket.x=clamp(p.x,.11,.89);s.movedBasket=true;}
  if(s.phase==='tuck'&&near(p,{x:.5,y:.4},.3)){s.tucked=(s.tucked||0)+d;if(s.tucked>=.65){s.score++;finish(s);}}
  if(s.phase==='wash'){
   mudSpots.forEach((q,i)=>{if(near(p,q,.15))s.mud[i]=clamp(s.mud[i]+d*4);});
   s.score=s.mud.filter(x=>x>=1).length;
   if(s.score===3)phase(s,'pump');
  }
  if(s.phase==='nectar')s.flight={...p};
  if(s.phase==='water'){
   plots.forEach((q,i)=>{if(near(p,q,.18))s.water[i]=clamp(s.water[i]+d*3);});
   s.score=s.pairs+s.water.filter(x=>x>=1).length;
   if(s.water.every(x=>x>=1))phase(s,'harvest');
  }
  if(s.phase==='push'&&near(p,{x:s.pushX,y:.65},.33)){
   s.push+=Math.max(0,p.x-g.last.x);s.pushX=.25+clamp(s.push/.38)*.5;
   if(s.push>=.38){s.score++;finish(s);}
  }
  if(s.gesture)g.last={...p};
 }
 function end(s,p){
  const g=s.gesture;if(!g)return;move(s,p);if(s.gesture!==g||g.version!==s.phaseVersion)return;
  s.gesture=null;
  if(s.phase==='carry'&&g.target==='basket'&&near(p,{x:.5,y:.28},.23)){s.score++;phase(s,'tuck');}
  else if(s.phase==='pump'&&g.pumpReady&&p.y-g.start.y>=.16&&Math.abs(p.x-g.start.x)<.3){s.pumps++;s.score=3+s.pumps;s.stream=.7;event(s,'success');if(s.pumps===s.pumpGoal)phase(s,'deliverMilk');}
  else if(s.phase==='deliverMilk'&&g.target==='pail'&&near(p,{x:.82,y:.45},.24)){s.score++;finish(s);}
  else if(s.phase==='pick'&&/^flower[0-3]$/.test(g.target)&&near(p,{x:.5,y:.82},.23)){
   const i=+g.target.slice(6);if(!s.picked.includes(i)){s.picked.push(i);s.score++;event(s,'success');if(s.picked.length===3)phase(s,'giveFlowers');}
  }
  else if(s.phase==='giveFlowers'&&g.target==='bouquet'&&near(p,{x:.82,y:.3},.25)){s.score++;finish(s);}
  else if(s.phase==='harvest'&&/^crop[0-2]$/.test(g.target)&&near(p,{x:.5,y:.85},.24)){
   const i=+g.target.slice(4);if(!s.harvested.includes(i)){s.harvested.push(i);s.score++;event(s,'success');if(s.harvested.length===3)finish(s);}
  }
  else if(s.phase==='sort'&&g.target==='produce'){
   const i=s.types.findIndex((_,i)=>near(p,basketSpot(s,i),.2));
   if(i>=0&&s.types[i]===s.queue[s.sorted]){s.sorted++;s.score++;event(s,'success');if(s.sorted===6)phase(s,'load');else event(s,'word',{id:s.queue[s.sorted]});}
   else event(s,'retry');
  }
  else if(s.phase==='load'&&/^load[0-2]$/.test(g.target)&&near(p,{x:.78,y:.3},.25)){
   const i=+g.target.slice(4);if(i<s.types.length&&!s.loaded.includes(i)){s.loaded.push(i);s.score++;event(s,'success');if(s.loaded.length===s.types.length)phase(s,'push');}
  }
 }
 function basketSpot(s,i){return {x:(i+1)/(s.types.length+1),y:.78};}
 function cancel(s){s.gesture=null;s.flight=null;}
 function tick(s,dt){
  dt=clamp(dt,0,.05);s.time+=dt;s.stream=Math.max(0,s.stream-dt);
  if(s.phase==='catch'){
   s.eggClock-=dt;
   if(s.eggClock<=0&&s.eggs.length<2){s.eggClock=1.8;const sources=s.eggSources||[{x:.2,y:.08},{x:.5,y:.08},{x:.8,y:.08}],q=sources[Math.floor(s.random()*sources.length)];s.eggs.push({id:++s.eggSerial,...q,v:.19});}
   for(const e of s.eggs){e.y+=e.v*dt;e.v+=.035*dt;
    if(s.movedBasket&&e.y>=.81&&e.y<.93&&Math.abs(e.x-s.basket.x)<.17&&!e.dead){e.dead=true;s.caught++;s.score++;event(s,'success',{x:e.x,y:.81});if(s.caught===s.catchGoal){s.eggs=[];phase(s,'carry');break;}}
    if(e.y>=1.03)e.dead=true;
   }s.eggs=s.eggs.filter(e=>!e.dead);
  }
  if(s.phase==='nectar'&&s.flight){
   const distance=Math.hypot(s.flight.x-s.bee.x,s.flight.y-s.bee.y),step=Math.min(1,dt*1.2/Math.max(.001,distance));
   s.bee.x+=(s.flight.x-s.bee.x)*step;s.bee.y+=(s.flight.y-s.bee.y)*step;
   flowerSpots.forEach((q,i)=>{if(!s.visited.includes(i)&&near(s.bee,q,.12)&&near(s.flight,q,.18)){s.visited.push(i);s.score++;event(s,'success');}});
   if(s.visited.length===4)phase(s,'pick');
  }
  if(s.phase==='match'){
   if(s.resetAt&&s.time>=s.resetAt){s.open=[];s.resetAt=0;event(s,'cards');}
   if(s.matchedAt&&s.time>=s.matchedAt)phase(s,'water');
  }
 }
 const api={ids,crops,flowerSpots,mudSpots,plots,create,start,move,end,cancel,tick,card,basketSpot,near};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.meadowClassicCore=api;
})(typeof window==='undefined'?globalThis:window);
