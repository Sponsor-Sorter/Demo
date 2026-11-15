/* Hands-on farm play. Coordinates are fractions of the unobstructed playfield. */
(function(root){
 'use strict';
 const ids=['eggs','milk','flowers','memory','sorting'];
 const crops=['apple','strawberry','pear','carrot','corn','potato'];
 const flowerSpots=[{x:.2,y:.3},{x:.75,y:.28},{x:.27,y:.64},{x:.73,y:.65}];
 const plots=[{x:.23,y:.54},{x:.5,y:.54},{x:.77,y:.54}];
 const mudSpots=[{x:.4,y:.39},{x:.49,y:.45},{x:.56,y:.35}];
 const careMud=[...mudSpots,{x:.44,y:.29},{x:.55,y:.53}];
 const flowerKinds=['sunflower','tulip','daisy','lavender','bluebell','pink'];
 const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
 const near=(p,q,r=.16)=>p&&Math.hypot(p.x-q.x,p.y-q.y)<r;
 function shuffled(a,r){a=a.slice();for(let i=a.length-1;i;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a;}
 const stages=[1,4,9,16];
 function profile(id,value=1){const n=Number(value),level=Number.isFinite(n)?clamp(Math.floor(n)||1,1,999):1,stage=stages.findLastIndex(x=>x<=level);return {level,stage,pairs:3+stage,types:[2,3,3,4][stage],items:[6,6,8,10][stage],catchGoal:[4,5,6,8][stage],eggMax:[1,1,2,2][stage],eggInterval:[2.4,2.2,2,1.85][stage],eggSpeed:[.15,.17,.18,.2][stage],washGoal:2+stage,pumpGoal:2+stage,pullDistance:[.13,.15,.17,.19][stage],flowerCount:3+stage};}
 function challenge(id,level,direction){const d=profile(id,level);return direction<0?stages[Math.max(0,d.stage-1)]:d.stage===stages.length-1?d.level:stages[d.stage+1];}
 function resetHelp(s){s.misses=0;s.hintReady=false;s.hints=[];s.hintShown=false;s.helpSerial++;}
 function miss(s){if(!s.progressive||s.done)return false;s.misses++;s.hints=[];s.hintShown=false;s.helpSerial++;event(s,'retry');if(s.misses>=2&&!s.hintReady){s.hintReady=true;event(s,'hintReady');}return false;}
 function hint(s){if(!s.progressive||!s.hintReady||s.done)return false;let targets=[];
  if(s.phase==='match'){if(s.open.length===2||s.matchedAt)return false;const first=s.open[0]??s.deck.findIndex((_,i)=>!s.matched.includes(i)),mate=s.deck.findIndex((id,i)=>i!==first&&!s.matched.includes(i)&&id===s.deck[first]);if(first<0||mate<0)return false;targets=s.open.length?['card'+mate]:['card'+first,'card'+mate];}
  if(s.phase==='sort')targets=['produce','basket'+s.types.indexOf(s.queue[s.sorted])];
  if(s.phase==='load')targets=['load'+s.types.findIndex((_,i)=>!s.loaded.includes(i)),'cart'];
  if(s.phase==='water')targets=['can','plant'+s.water.findIndex(x=>x<1)];
  if(s.phase==='harvest')targets=['crop'+[0,1,2].find(i=>!s.harvested.includes(i)),'harvest-basket'];
  if(s.phase==='push')targets=['cart','market'];
  if(s.phase==='catch')targets=['basket','catch-zone'];
  if(s.phase==='carry')targets=['basket','nest'];
  if(s.phase==='tuck')targets=['straw','nest'];
  if(s.phase==='wash')targets=['cloth','mud'+s.mud.findIndex(x=>x<1)];
  if(s.phase==='pump')targets=['handle','pull-path'];
  if(s.phase==='deliverMilk')targets=['pail','milk-cart'];
  if(s.phase==='nectar')targets=['bee','flower'+s.nectarOrder[s.visited.length],'flower-request'];
  if(s.phase==='pick')targets=['flower'+s.flowerIds.findIndex((_,i)=>!s.picked.includes(i)),'bouquet-basket'];
  if(s.phase==='giveFlowers')targets=['bouquet','jade'];
  if(!targets.length)return false;s.hints=targets;s.hintShown=true;s.helpSerial++;event(s,'hint');return true;
 }
 function create(id,level=1,random=Math.random,options={}){
  if(!ids.includes(id))throw Error('Unknown farm activity');
  const requested=options.level??level;level=clamp(Math.floor(level)||1,1,99);
  const progressive=options.progressive===true,difficulty=profile(id,requested),pairs=progressive?difficulty.pairs:Math.min(6,3+Math.floor((level-1)/4)),types=shuffled(crops,random).slice(0,progressive?difficulty.types:level<4?2:3),sortGoal=progressive?difficulty.items:6;
  const s={id,level,phase:({eggs:'catch',milk:'wash',flowers:'nectar',memory:'match',sorting:'sort'})[id],
   time:0,score:0,goal:0,gesture:null,events:[],random,phaseVersion:0,done:false,doneAt:0,
   basket:{x:.5,y:.84},eggs:[],eggClock:.5,eggSerial:0,caught:0,catchGoal:progressive?difficulty.catchGoal:Math.min(10,6+Math.floor((level-1)/3)),movedBasket:false,
   mud:[0,0,0],pumps:0,pumpGoal:3,stream:0,bee:{x:.5,y:.17},flight:null,visited:[],picked:[],
   pairs,deck:[],open:[],matched:[],resetAt:0,matchedAt:0,water:[0,0,0],harvested:[],
   types,queue:[],sorted:0,loaded:[],push:0,pushX:.25,progressive,difficulty,sortGoal,misses:0,hintReady:false,hints:[],hintShown:false,helpSerial:0};
  if(progressive)s.level=difficulty.level;
  if(progressive&&id==='milk'){s.washSpots=shuffled(careMud,random).slice(0,difficulty.washGoal);s.mud=s.washSpots.map(()=>0);s.pumpGoal=difficulty.pumpGoal;}
  if(progressive&&id==='flowers'){s.flowerIds=shuffled(flowerKinds,random).slice(0,difficulty.flowerCount);s.flowerPoints=s.flowerIds.length===3?[{x:.2,y:.44},{x:.8,y:.44},{x:.5,y:.76}]:s.flowerIds.map((_,i)=>({x:[.18,.5,.82][i%3],y:i<3?.4:.74}));s.nectarOrder=shuffled(s.flowerIds.map((_,i)=>i),random);s.bee={x:.12,y:.14};}
  s.deck=shuffled(shuffled(crops,random).slice(0,pairs).flatMap(id=>[id,id]),random);if(progressive)s.plantIds=[...new Set(s.deck)].slice(0,3);
  s.queue=shuffled(Array.from({length:sortGoal},(_,i)=>types[i%types.length]),random);
  s.goal=({eggs:s.catchGoal+2,milk:7,flowers:8,memory:pairs+6,sorting:sortGoal+types.length+1})[id];
  if(progressive&&id==='milk')s.goal=s.mud.length+s.pumpGoal+1;
  if(progressive&&id==='flowers')s.goal=s.flowerIds.length+4;
  return s;
 }
 function event(s,type,data={}){s.events.push({type,...data});}
 function phase(s,next){s.phase=next;s.phaseVersion++;s.gesture=null;s.flight=null;resetHelp(s);event(s,'phase',{phase:next});}
 function finish(s){if(s.done)return;s.score=s.goal;s.done=true;s.doneAt=s.time;phase(s,'done');}
 function card(s,i){
  if(s.phase!=='match'||!Number.isInteger(i)||i<0||i>=s.deck.length||s.open.length===2||s.open.includes(i)||s.matched.includes(i))return false;
  s.open.push(i);event(s,'word',{id:s.deck[i]});
  if(s.open.length===2){if(s.deck[s.open[0]]===s.deck[i]){s.matched.push(...s.open);s.open=[];s.score++;resetHelp(s);event(s,'success');if(s.matched.length===s.deck.length)s.matchedAt=s.time+1.6;}else{s.resetAt=s.time+.85;if(s.progressive)miss(s);}}
  else if(s.hintShown)hint(s);
  return true;
 }
 function start(s,p,target=''){
  if(s.done||s.gesture)return false;
  s.gesture={start:{...p},last:{...p},target,version:s.phaseVersion,distance:0,basketX:s.basket.x,basketMoved:s.movedBasket,pumpReady:s.phase==='pump'&&near(p,{x:.56,y:.46},.22)};
  if(s.phase==='catch'){s.basket.x=clamp(p.x,.11,.89);s.movedBasket=true;}
  if(s.phase==='nectar')s.flight={...p};
  return true;
 }
 function move(s,p){
  const g=s.gesture;if(!g||g.version!==s.phaseVersion)return;
  const d=Math.min(.12,Math.hypot(p.x-g.last.x,p.y-g.last.y));g.distance+=d;
  if(s.phase==='catch'){s.basket.x=clamp(p.x,.11,.89);s.movedBasket=true;}
  if(s.phase==='tuck'&&near(p,{x:.5,y:.4},.3)){s.tucked=(s.tucked||0)+d;if(d>0)g.progress=true;if(s.tucked>=.65){s.score++;resetHelp(s);finish(s);}}
  if(s.phase==='wash'){
   washSpots(s).forEach((q,i)=>{if(near(p,q,.15)){const before=s.mud[i];s.mud[i]=clamp(before+d*4);if(s.mud[i]>before)g.progress=true;if(before<1&&s.mud[i]>=1)resetHelp(s);}});
   s.score=s.mud.filter(x=>x>=1).length;
   if(s.score===s.mud.length)phase(s,'pump');
  }
  if(s.phase==='nectar')s.flight={...p};
  if(s.phase==='water'){
   plots.forEach((q,i)=>{if(near(p,q,.18)){const before=s.water[i];s.water[i]=clamp(before+d*3);if(s.water[i]>before)g.progress=true;if(before<1&&s.water[i]>=1)resetHelp(s);}});
   s.score=s.pairs+s.water.filter(x=>x>=1).length;
   if(s.water.every(x=>x>=1))phase(s,'harvest');
  }
  if(s.phase==='push'&&near(p,{x:s.pushX,y:.65},.33)){
   const step=Math.max(0,p.x-g.last.x);s.push+=step;if(step>0)g.progress=true;s.pushX=.25+clamp(s.push/.38)*.5;
   if(s.push>=.38){s.score++;finish(s);}
  }
  if(s.gesture)g.last={...p};
 }
 function end(s,p){
  const g=s.gesture;if(!g)return;move(s,p);if(s.gesture!==g||g.version!==s.phaseVersion)return;
  s.gesture=null;
  if(s.progressive&&s.phase==='catch'){for(const e of s.eggs)e.attempted=true;return;}
  if(s.progressive&&s.phase==='nectar'){const i=flowerPoints(s).findIndex(q=>near(p,q,.18));if(i>=0&&!s.visited.includes(i)&&i!==s.nectarOrder[s.visited.length])miss(s);return;}
  if(s.progressive&&g.distance<.03)return;
  if(s.progressive&&['water','wash','tuck'].includes(s.phase)){if(!g.progress)miss(s);return;}
  if(s.progressive&&s.phase==='push'){if(!g.progress)miss(s);return;}
  if(s.phase==='carry'&&g.target==='basket'&&near(p,{x:.5,y:.28},.23)){s.score++;resetHelp(s);phase(s,'tuck');}
  else if(s.phase==='pump'&&g.pumpReady&&p.y-g.start.y>=(s.progressive?s.difficulty.pullDistance:.16)&&Math.abs(p.x-g.start.x)<.3){s.pumps++;s.score=s.mud.length+s.pumps;s.stream=.7;resetHelp(s);event(s,'success');if(s.pumps===s.pumpGoal)phase(s,'deliverMilk');}
  else if(s.phase==='deliverMilk'&&g.target==='pail'&&near(p,{x:.82,y:.45},.24)){s.score++;resetHelp(s);finish(s);}
  else if(s.phase==='pick'&&/^flower[0-5]$/.test(g.target)&&near(p,{x:.5,y:.82},.23)){
   const i=+g.target.slice(6);if(i<flowerPoints(s).length&&!s.picked.includes(i)){s.picked.push(i);s.score++;resetHelp(s);event(s,'success');if(s.picked.length===3)phase(s,'giveFlowers');}
  }
  else if(s.phase==='giveFlowers'&&g.target==='bouquet'&&near(p,{x:.82,y:.3},.25)){s.score++;resetHelp(s);finish(s);}
  else if(s.phase==='harvest'&&/^crop[0-2]$/.test(g.target)&&near(p,{x:.5,y:.85},.24)){
   const i=+g.target.slice(4);if(!s.harvested.includes(i)){s.harvested.push(i);s.score++;resetHelp(s);event(s,'success');if(s.harvested.length===3)finish(s);}
  }
  else if(s.phase==='sort'&&g.target==='produce'){
   const choices=s.types.map((_,i)=>({i,d:Math.hypot(p.x-basketSpot(s,i).x,p.y-basketSpot(s,i).y)})),i=s.progressive?choices.sort((a,b)=>a.d-b.d).find(q=>q.d<.2)?.i:s.types.findIndex((_,i)=>near(p,basketSpot(s,i),.2));
   if(i!==undefined&&i>=0&&s.types[i]===s.queue[s.sorted]){s.sorted++;s.score++;resetHelp(s);event(s,'success');if(s.sorted===s.sortGoal)phase(s,'load');else event(s,'word',{id:s.queue[s.sorted]});}
   else if(s.progressive)miss(s);else event(s,'retry');
  }
  else if(s.phase==='load'&&/^load[0-3]$/.test(g.target)&&near(p,cartSpot(s),.25)){
   const i=+g.target.slice(4);if(i<s.types.length&&!s.loaded.includes(i)){s.loaded.push(i);s.score++;resetHelp(s);event(s,'success');if(s.loaded.length===s.types.length)phase(s,'push');}
  }
  else if(s.progressive&&((s.phase==='harvest'&&/^crop[0-2]$/.test(g.target)&&!s.harvested.includes(+g.target.slice(4)))||(s.phase==='load'&&/^load[0-3]$/.test(g.target)&&+g.target.slice(4)<s.types.length&&!s.loaded.includes(+g.target.slice(4)))))miss(s);
  else if(s.progressive&&((s.phase==='carry'&&g.target==='basket')||s.phase==='pump'||(s.phase==='deliverMilk'&&g.target==='pail')||(s.phase==='pick'&&/^flower[0-5]$/.test(g.target)&&+g.target.slice(6)<flowerPoints(s).length&&!s.picked.includes(+g.target.slice(6)))||(s.phase==='giveFlowers'&&g.target==='bouquet')))miss(s);
 }
 function cartSpot(s){return s.cartPoint||{x:.78,y:.3};}
 function basketSpot(s,i){return s.basketSpots?.[i]||{x:(i+1)/(s.types.length+1),y:.78};}
 function washSpots(s){return s.washSpots||mudSpots;}
 function flowerPoints(s){if(s.progressive&&s.id==='flowers'&&s.phase==='pick')return s.flowerIds.map((_,i)=>({x:[.18,.5,.82][i%3],y:s.flowerIds.length===3?.38:i<3?.25:.53}));return s.flowerPoints||flowerSpots;}
 function cancel(s){if(s.progressive&&s.phase==='catch'&&s.gesture){s.basket.x=s.gesture.basketX;s.movedBasket=s.gesture.basketMoved;}s.gesture=null;s.flight=null;}
 function tick(s,dt){
  dt=clamp(dt,0,.05);s.time+=dt;s.stream=Math.max(0,s.stream-dt);
  if(s.phase==='catch'){
   s.eggClock-=dt;
   if(s.eggClock<=0&&s.eggs.length<(s.progressive?s.difficulty.eggMax:2)){s.eggClock=s.progressive?s.difficulty.eggInterval:1.8;const sources=s.eggSources||[{x:.2,y:.08},{x:.5,y:.08},{x:.8,y:.08}],q=sources[Math.floor(s.random()*sources.length)];s.eggs.push({id:++s.eggSerial,...q,v:s.progressive?s.difficulty.eggSpeed:.19});}
   for(const e of s.eggs){e.y+=e.v*dt;e.v+=.035*dt;
    if(s.movedBasket&&e.y>=.81&&e.y<.93&&Math.abs(e.x-s.basket.x)<.17&&!e.dead){e.dead=true;s.caught++;s.score++;resetHelp(s);event(s,'success',{x:e.x,y:.81});if(s.caught===s.catchGoal){s.eggs=[];phase(s,'carry');break;}}
    if(e.y>=1.03&&!e.dead){e.dead=true;if(s.progressive&&e.attempted)miss(s);}
   }s.eggs=s.eggs.filter(e=>!e.dead);
  }
  if(s.phase==='nectar'&&s.flight){
   const distance=Math.hypot(s.flight.x-s.bee.x,s.flight.y-s.bee.y),step=Math.min(1,dt*1.2/Math.max(.001,distance));
   s.bee.x+=(s.flight.x-s.bee.x)*step;s.bee.y+=(s.flight.y-s.bee.y)*step;
   flowerPoints(s).forEach((q,i)=>{if(!s.visited.includes(i)&&(!s.progressive||i===s.nectarOrder[s.visited.length])&&near(s.bee,q,.12)&&near(s.flight,q,.18)){s.visited.push(i);s.score++;resetHelp(s);event(s,'success');}});
   if(s.visited.length===flowerPoints(s).length)phase(s,'pick');
  }
  if(s.phase==='match'){
   if(s.resetAt&&s.time>=s.resetAt){s.open=[];s.resetAt=0;event(s,'cards');}
   if(s.matchedAt&&s.time>=s.matchedAt)phase(s,'water');
  }
 }
 const api={ids,crops,flowerSpots,mudSpots,plots,create,start,move,end,cancel,tick,card,basketSpot,near,profile,challenge,stages,hint,cartSpot,washSpots,flowerPoints,flowerKinds};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.meadowClassicCore=api;
})(typeof window==='undefined'?globalThis:window);
