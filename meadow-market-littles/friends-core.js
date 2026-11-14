/* Rules for six hands-on farm-friend activities. No clocks or lost attempts. */
(() => {
'use strict';
const ids=['meadowpairs','paddockchange','farmerpattern','barnyardlisten','gentleharvest','farmpicture'],animals=['hen','cow','sheep','goat'],foods=['apple','carrot','corn','strawberry','pear','potato'];
const near=(p,q,r=.18)=>Math.hypot(p.x-q.x,p.y-q.y)<r;
function shuffle(a,r){a=a.slice();for(let i=a.length-1;i;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a;}
const pos=(i,count,y)=>({x:(i+1)/(count+1),y});
function emit(s,type,data={}){s.events.push({type,...data});}
function phase(s,p){s.phase=p;s.phaseSerial++;s.gesture=null;emit(s,'phase',{phase:p});}
function finish(s){if(s.done)return;s.done=true;s.score=s.goal;phase(s,'done');}
function create(id,level=1,random=Math.random,variant=0){
 if(!ids.includes(id))throw Error('Unknown farm friend activity');
 const pairGoal=level<8?3:4,grid=level<5?2:3,s={id,level,random,time:0,phaseSerial:0,events:[],score:0,done:false,gesture:null,round:0,open:[],matched:[],resetAt:0,waitAt:0,homes:[],pairs:pairGoal,
  deck:shuffle(shuffle(animals,random).slice(0,pairGoal).flatMap(a=>[a,a]),random),friends:shuffle(animals,random).slice(0,3),missing:0,watchIndex:0,watchClock:0,pattern:[],loaded:[],pet:0,
  target:'',produce:[],caught:0,pieceGrid:grid,variant:Math.abs(variant|0)%12,pieces:[],placed:[],turns:0};
 s.goal=({meadowpairs:pairGoal*2,paddockchange:3,farmerpattern:3,barnyardlisten:6,gentleharvest:7,farmpicture:grid*2})[id];
 if(id==='meadowpairs')phase(s,'match');
 if(id==='paddockchange'){s.missing=Math.floor(random()*3);phase(s,'look');}
 if(id==='farmerpattern')newPattern(s);
 if(id==='barnyardlisten'){s.target=shuffle(animals,random)[0];phase(s,'listen');}
 if(id==='gentleharvest')newHarvest(s);
 if(id==='farmpicture'){s.pieces=shuffle(Array.from({length:grid*2},(_,i)=>i),random);phase(s,'build');}
 return s;
}
function newPattern(s){const n=s.level>=4&&s.round===2?3:2;s.pattern=Array.from({length:n},()=>foods[Math.floor(s.random()*foods.length)]);s.options=shuffle([...new Set(s.pattern),...shuffle(foods.filter(x=>!s.pattern.includes(x)),s.random).slice(0,Math.max(0,3-new Set(s.pattern).size))],s.random);s.loaded=[];s.watchIndex=0;s.watchClock=Infinity;phase(s,'watch');}
function newHarvest(s){s.target=foods[Math.floor(s.random()*foods.length)];const choices=shuffle([s.target,...shuffle(foods.filter(x=>x!==s.target),s.random).slice(0,2)],s.random);s.produce=choices.map((id,i)=>({id,key:i,x:.15+i*.3,y:.26+i*.18,dir:i%2?-1:1}));phase(s,'pick');emit(s,'findFood',{id:s.target});}
function card(s,i){if(s.phase!=='match'||!Number.isInteger(i)||i<0||i>=s.deck.length||s.open.length===2||s.matched.includes(i)||s.open.includes(i))return false;s.open.push(i);emit(s,'animalName',{id:s.deck[i]});if(s.open.length===2){if(s.deck[i]===s.deck[s.open[0]]){s.matched.push(...s.open);s.open=[];s.score++;emit(s,'success');if(s.matched.length===s.deck.length)s.waitAt=s.time+1.6;}else s.resetAt=s.time+.9;}return true;}
function ready(s){if(s.phase!=='look')return;phase(s,'restore');emit(s,'missingFriend');}
function lookAgain(s){if(s.phase==='restore')phase(s,'look');}
function replay(s){if(s.id==='farmerpattern'&&s.phase==='pack'){s.watchIndex=0;s.watchClock=Infinity;phase(s,'watch');}}
function continueWatch(s,delay){if(s.phase==='watch')s.watchClock=Math.max(.1,Math.min(20,Number(delay)||.1));}
function slotPoint(s,piece){return s.slots?.[piece]||{x:.17+(piece%s.pieceGrid+.5)*.66/s.pieceGrid,y:.12+(Math.floor(piece/s.pieceGrid)+.5)*.52/2};}
function start(s,p,target){if(s.done||s.gesture)return false;s.gesture={start:{...p},last:{...p},target,version:s.phaseSerial,distance:0};return true;}
function move(s,p){const g=s.gesture;if(!g||g.version!==s.phaseSerial)return;const d=Math.min(.12,Math.hypot(p.x-g.last.x,p.y-g.last.y));g.distance+=d;if(s.phase==='pet'&&near(p,{x:.5,y:.46},.28)){s.pet+=d;if(s.pet>=.45){s.score++;s.waitAt=s.time+1;phase(s,'happy');emit(s,'success');}}g.last={...p};}
function nextSound(s){s.round++;if(s.round===3){finish(s);return;}s.pet=0;const next=shuffle(animals.filter(x=>x!==s.target),s.random)[0];s.target=next;phase(s,'listen');}
function end(s,p){const g=s.gesture;if(!g)return;move(s,p);if(s.gesture!==g||g.version!==s.phaseSerial)return;s.gesture=null;
 if(s.phase==='home'){
  const unique=[...new Set(s.deck)],i=unique.indexOf(g.target);if(i>=0&&!s.homes.includes(g.target)&&near(p,pos(i,unique.length,.76),.2)){s.homes.push(g.target);s.score++;emit(s,'success');if(s.homes.length===unique.length)finish(s);}
 }else if(s.phase==='restore'){
  if(g.target===s.friends[s.missing]&&near(p,pos(s.missing,3,.42),.22)){s.round++;s.score++;s.waitAt=s.time+1.2;phase(s,'restored');emit(s,'success');}
  else emit(s,'retry');
 }else if(s.phase==='pack'){
  if(g.target===s.pattern[s.loaded.length]&&near(p,pos(s.loaded.length,s.pattern.length,.4),.2)){s.loaded.push(g.target);emit(s,'success');if(s.loaded.length===s.pattern.length){s.score++;s.waitAt=s.time+1.7;phase(s,'train');}}
  else emit(s,'retry');
 }else if(s.phase==='listen'){
  if(g.target===s.target&&Math.abs(p.x-g.start.x)>=.16){s.score++;phase(s,'pet');emit(s,'animal',{id:s.target});}else emit(s,'retry');
 }else if(s.phase==='pick'){
  const item=s.produce.find(x=>String(x.key)===String(g.target));if(item&&item.id===s.target&&near(p,{x:.5,y:.87},.23)){s.caught++;s.score++;emit(s,'success');if(s.caught===6)phase(s,'deliver');else newHarvest(s);}else emit(s,'retry');
 }else if(s.phase==='deliver'){
  if(g.target==='basket'&&near(p,{x:.8,y:.38},.23))finish(s);
 }else if(s.phase==='build'){
  if(typeof g.target!=='string'||!/^\d+$/.test(g.target)){emit(s,'retry');return;}
  const piece=+g.target,nearest=s.pieces.slice().sort((a,b)=>Math.hypot(p.x-slotPoint(s,a).x,p.y-slotPoint(s,a).y)-Math.hypot(p.x-slotPoint(s,b).x,p.y-slotPoint(s,b).y))[0];if(Number.isInteger(piece)&&piece>=0&&piece<s.pieceGrid*2&&!s.placed.includes(piece)&&nearest===piece&&near(p,slotPoint(s,piece),.16)){s.placed.push(piece);s.score++;emit(s,'success');if(s.placed.length===s.pieceGrid*2)finish(s);}else emit(s,'retry');
 }
}
function cancel(s){s.gesture=null;}
function tick(s,dt){dt=Math.max(0,Math.min(.05,dt));s.time+=dt;if(s.phase==='match'){if(s.resetAt&&s.time>=s.resetAt){s.open=[];s.resetAt=0;}if(s.waitAt&&s.time>=s.waitAt){s.waitAt=0;phase(s,'home');}}
 if(s.phase==='watch'){s.watchClock-=dt;if(s.watchClock<=0){if(s.watchIndex<s.pattern.length){emit(s,'patternWord',{id:s.pattern[s.watchIndex],index:s.watchIndex++});s.watchClock=Infinity;}else phase(s,'pack');}}
 if(s.phase==='train'&&s.time>=s.waitAt){s.round++;if(s.round===3)finish(s);else newPattern(s);}
 if(s.phase==='happy'&&s.time>=s.waitAt)nextSound(s);
 if(s.phase==='restored'&&s.time>=s.waitAt){if(s.round===3)finish(s);else{s.friends=shuffle(animals,s.random).slice(0,3);s.missing=Math.floor(s.random()*3);phase(s,'look');}}
 if(s.phase==='pick')for(const p of s.produce){if(String(s.gesture?.target)===String(p.key))continue;p.x+=p.dir*dt*.12;if(p.x>1.05)p.x=-.05;if(p.x<-.05)p.x=1.05;}
}
const api={ids,animals,foods,pos,near,slotPoint,create,card,ready,lookAgain,replay,continueWatch,start,move,end,cancel,tick};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else window.meadowFriendsCore=api;
})();
