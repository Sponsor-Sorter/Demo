/* Rules for six hands-on farm-friend activities. No clocks or lost attempts. */
(() => {
'use strict';
const ids=['meadowpairs','paddockchange','farmerpattern','barnyardlisten','gentleharvest','farmpicture'],animals=['hen','cow','sheep','goat'],foods=['apple','carrot','corn','strawberry','pear','potato'];
const near=(p,q,r=.18)=>Math.hypot(p.x-q.x,p.y-q.y)<r;
function shuffle(a,r){a=a.slice();for(let i=a.length-1;i;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a;}
const pos=(i,count,y)=>({x:(i+1)/(count+1),y});
function emit(s,type,data={}){s.events.push({type,...data});}
const stages=[1,4,9];
function profile(id,value=1){
 if(!ids.includes(id))throw Error('Unknown farm friend activity');
 const n=Number(value),level=Number.isFinite(n)?Math.max(1,Math.min(999,Math.floor(n)||1)):1,stage=stages.findLastIndex(x=>x<=level);
 return {level,stage,pairs:2+stage,friendChoices:2+stage,patternLength:2+stage,foodChoices:3+stage,doors:2+stage,harvestChoices:2+stage,harvestGoal:4+stage,harvestSpeed:[.07,.09,.11][stage],columns:2+stage,rows:2};
}
function challenge(id,level,direction){const p=profile(id,level);return direction<0?stages[Math.max(0,p.stage-1)]:p.stage===stages.length-1?p.level:stages[p.stage+1];}
function resetHelp(s){if(!s.progressive)return;s.misses=0;s.hintReady=false;s.hints=[];s.hintShown=false;s.helpSerial++;}
function success(s){resetHelp(s);emit(s,'success');}
function miss(s){emit(s,'retry');if(!s.progressive||s.done)return;s.misses++;s.hints=[];s.hintShown=false;s.hintReady=s.misses>=2;s.helpSerial++;}
function hint(s){
 if(!s.progressive||!s.hintReady||s.done)return false;let targets=[];
 if(s.phase==='match'){
  if(s.open.length===2||s.waitAt)return false;
  const first=s.open[0]??s.deck.findIndex((_,i)=>!s.matched.includes(i)),mate=s.deck.findIndex((id,i)=>i!==first&&!s.matched.includes(i)&&id===s.deck[first]);
  if(first<0||mate<0)return false;targets=s.open.length?['card'+mate]:['card'+first,'card'+mate];
 }
 if(s.phase==='home'){const id=[...new Set(s.deck)].find(id=>!s.homes.includes(id));if(id)targets=[id,'home-'+id];}
 if(s.phase==='restore')targets=[s.friends[s.missing],'missing'];
 if(s.phase==='pack')targets=[s.pattern[s.loaded.length],'wagon'+s.loaded.length];
 if(s.phase==='listen')targets=[s.target];
 if(s.phase==='pick'){const item=s.produce.find(x=>x.id===s.target);if(item)targets=[String(item.key),'basket-target'];}
 if(s.phase==='deliver')targets=['basket','cart'];
 if(s.phase==='build'){const piece=s.pieces.find(i=>!s.placed.includes(i));if(piece!==undefined)targets=['piece'+piece,'slot'+piece];}
 if(!targets.length)return false;s.hints=targets;s.hintShown=true;s.helpSerial++;return true;
}
const wagonPoint=(s,i)=>s.progressive?{x:.24+(i+.5)*.72/s.pattern.length,y:.4}:pos(i,s.pattern.length,.4);
function doorIds(s){if(s.progressive)return s.doors;const choices=animals.slice(0,3);if(!choices.includes(s.target))choices[2]=s.target;return choices;}
function newPaddock(s){s.friends=shuffle(animals,s.random).slice(0,3);s.missing=Math.floor(s.random()*3);s.friendOptions=shuffle([s.friends[s.missing],...shuffle(animals.filter(id=>id!==s.friends[s.missing]),s.random).slice(0,s.difficulty.friendChoices-1)],s.random);resetHelp(s);}
function newDoors(s){s.doors=shuffle([s.target,...shuffle(animals.filter(id=>id!==s.target),s.random).slice(0,s.difficulty.doors-1)],s.random);resetHelp(s);}
function phase(s,p){s.phase=p;s.phaseSerial++;s.gesture=null;emit(s,'phase',{phase:p});}
function finish(s){if(s.done)return;resetHelp(s);s.done=true;s.score=s.goal;phase(s,'done');}
function create(id,level=1,random=Math.random,variant=0,options={}){
 if(!ids.includes(id))throw Error('Unknown farm friend activity');
 const progressive=options.progressive===true,difficulty=profile(id,level),pairGoal=progressive?difficulty.pairs:level<8?3:4,grid=progressive?difficulty.columns:level<5?2:3,s={id,level:progressive?difficulty.level:level,progressive,difficulty,misses:0,hintReady:false,hints:[],hintShown:false,helpSerial:0,random,time:0,phaseSerial:0,events:[],score:0,done:false,gesture:null,round:0,open:[],matched:[],resetAt:0,waitAt:0,homes:[],pairs:pairGoal,
  deck:shuffle(shuffle(animals,random).slice(0,pairGoal).flatMap(a=>[a,a]),random),friends:shuffle(animals,random).slice(0,3),missing:0,watchIndex:0,watchClock:0,pattern:[],loaded:[],pet:0,
  target:'',produce:[],caught:0,pieceGrid:grid,pieceRows:progressive?difficulty.rows:2,harvestGoal:progressive?difficulty.harvestGoal:6,variant:Math.abs(variant|0)%12,pieces:[],placed:[],turns:0};
 s.goal=({meadowpairs:pairGoal*2,paddockchange:3,farmerpattern:3,barnyardlisten:6,gentleharvest:s.harvestGoal+1,farmpicture:grid*s.pieceRows})[id];
 if(id==='meadowpairs')phase(s,'match');
 if(id==='paddockchange'){if(progressive)newPaddock(s);else s.missing=Math.floor(random()*3);phase(s,'look');}
 if(id==='farmerpattern')newPattern(s);
 if(id==='barnyardlisten'){s.target=shuffle(animals,random)[0];if(progressive)newDoors(s);phase(s,'listen');}
 if(id==='gentleharvest')newHarvest(s);
 if(id==='farmpicture'){s.pieces=shuffle(Array.from({length:grid*s.pieceRows},(_,i)=>i),random);phase(s,'build');}
 return s;
}
function newPattern(s){resetHelp(s);const n=s.progressive?s.difficulty.patternLength:s.level>=4&&s.round===2?3:2;s.pattern=Array.from({length:n},()=>foods[Math.floor(s.random()*foods.length)]);s.options=shuffle([...new Set(s.pattern),...shuffle(foods.filter(x=>!s.pattern.includes(x)),s.random).slice(0,Math.max(0,(s.progressive?s.difficulty.foodChoices:3)-new Set(s.pattern).size))],s.random);s.loaded=[];s.watchIndex=0;s.watchClock=Infinity;phase(s,'watch');}
function newHarvest(s){resetHelp(s);s.target=foods[Math.floor(s.random()*foods.length)];const choices=shuffle([s.target,...shuffle(foods.filter(x=>x!==s.target),s.random).slice(0,s.progressive?s.difficulty.harvestChoices-1:2)],s.random);s.produce=choices.map((id,i)=>{const x=s.progressive?(choices.length===4?[.28,.72][i%2]:(i+.5)/choices.length):.15+i*.3,y=s.progressive?(choices.length===4?(i<2?.28:.56):.38):.26+i*.18;return{id,key:i,x,y,baseX:x,dir:i%2?-1:1};});phase(s,'pick');emit(s,'findFood',{id:s.target});}
function card(s,i){if(s.phase!=='match'||!Number.isInteger(i)||i<0||i>=s.deck.length||s.open.length===2||s.matched.includes(i)||s.open.includes(i))return false;s.open.push(i);emit(s,'animalName',{id:s.deck[i]});if(s.open.length===2){if(s.deck[i]===s.deck[s.open[0]]){s.matched.push(...s.open);s.open=[];s.score++;success(s);if(s.matched.length===s.deck.length)s.waitAt=s.time+1.6;}else{s.resetAt=s.time+.9;if(s.progressive)miss(s);}}else if(s.hintShown)hint(s);return true;}
function ready(s){if(s.phase!=='look')return;phase(s,'restore');emit(s,'missingFriend');}
function lookAgain(s){if(s.phase==='restore')phase(s,'look');}
function replay(s){if(s.id==='farmerpattern'&&s.phase==='pack'){s.watchIndex=0;s.watchClock=Infinity;phase(s,'watch');}}
function continueWatch(s,delay){if(s.phase==='watch')s.watchClock=Math.max(.1,Math.min(20,Number(delay)||.1));}
function slotPoint(s,piece){return s.slots?.[piece]||{x:.17+(piece%s.pieceGrid+.5)*.66/s.pieceGrid,y:.12+(Math.floor(piece/s.pieceGrid)+.5)*.52/s.pieceRows};}
function start(s,p,target){if(s.done||s.gesture)return false;s.gesture={start:{...p},last:{...p},target,version:s.phaseSerial,distance:0};return true;}
function move(s,p){const g=s.gesture;if(!g||g.version!==s.phaseSerial)return;const d=Math.min(.12,Math.hypot(p.x-g.last.x,p.y-g.last.y));g.distance+=d;if(s.phase==='pet'&&near(p,{x:.5,y:.46},.28)){s.pet+=d;if(s.pet>=.45){s.score++;s.waitAt=s.time+1;phase(s,'happy');success(s);}}g.last={...p};}
function nextSound(s){s.round++;if(s.round===3){finish(s);return;}s.pet=0;const next=shuffle(animals.filter(x=>x!==s.target),s.random)[0];s.target=next;if(s.progressive)newDoors(s);phase(s,'listen');}
function end(s,p){const g=s.gesture;if(!g)return;move(s,p);if(s.gesture!==g||g.version!==s.phaseSerial)return;s.gesture=null;
 if(s.progressive&&g.distance<.035)return;
 if(s.phase==='home'){
  const unique=[...new Set(s.deck)],i=unique.indexOf(g.target),nearest=unique.map((_,j)=>j).sort((a,b)=>Math.hypot(p.x-pos(a,unique.length,.76).x,p.y-.76)-Math.hypot(p.x-pos(b,unique.length,.76).x,p.y-.76))[0];if(i>=0&&!s.homes.includes(g.target)&&(!s.progressive||nearest===i)&&near(p,pos(i,unique.length,.76),.2)){s.homes.push(g.target);s.score++;success(s);if(s.homes.length===unique.length)finish(s);}else if(s.progressive&&i>=0&&!s.homes.includes(g.target)&&unique.some((_,j)=>near(p,pos(j,unique.length,.76),.2)))miss(s);
 }else if(s.phase==='restore'){
  if(g.target===s.friends[s.missing]&&near(p,pos(s.missing,3,.42),.22)){s.round++;s.score++;s.waitAt=s.time+1.2;phase(s,'restored');success(s);}
  else if(!s.progressive||s.friendOptions.includes(g.target)&&near(p,pos(s.missing,3,.42),.22))miss(s);
 }else if(s.phase==='pack'){
  const nearest=s.pattern.map((_,i)=>i).sort((a,b)=>Math.hypot(p.x-wagonPoint(s,a).x,p.y-.4)-Math.hypot(p.x-wagonPoint(s,b).x,p.y-.4))[0];
  if(g.target===s.pattern[s.loaded.length]&&(!s.progressive||nearest===s.loaded.length)&&near(p,wagonPoint(s,s.loaded.length),.2)){s.loaded.push(g.target);success(s);if(s.loaded.length===s.pattern.length){s.score++;s.waitAt=s.time+1.7;phase(s,'train');}}
  else if(!s.progressive||s.options.includes(g.target)&&s.pattern.some((_,i)=>near(p,wagonPoint(s,i),.2)))miss(s);
 }else if(s.phase==='listen'){
  if(g.target===s.target&&Math.abs(p.x-g.start.x)>=.16){s.score++;resetHelp(s);phase(s,'pet');emit(s,'animal',{id:s.target});}else if(!s.progressive||doorIds(s).includes(g.target)&&Math.abs(p.x-g.start.x)>=.16)miss(s);
 }else if(s.phase==='pick'){
  const item=s.produce.find(x=>String(x.key)===String(g.target));if(item&&item.id===s.target&&near(p,{x:.5,y:.87},.23)){s.caught++;s.score++;success(s);if(s.caught===s.harvestGoal)phase(s,'deliver');else newHarvest(s);}else if(!s.progressive||item&&near(p,{x:.5,y:.87},.23))miss(s);
 }else if(s.phase==='deliver'){
  if(g.target==='basket'&&near(p,{x:.8,y:.38},.23))finish(s);else if(s.progressive&&g.target==='basket')miss(s);
 }else if(s.phase==='build'){
  if(typeof g.target!=='string'||!/^\d+$/.test(g.target)){if(!s.progressive)emit(s,'retry');return;}
  const piece=+g.target,nearest=s.pieces.slice().sort((a,b)=>Math.hypot(p.x-slotPoint(s,a).x,p.y-slotPoint(s,a).y)-Math.hypot(p.x-slotPoint(s,b).x,p.y-slotPoint(s,b).y))[0];if(Number.isInteger(piece)&&piece>=0&&piece<s.pieceGrid*s.pieceRows&&!s.placed.includes(piece)&&nearest===piece&&near(p,slotPoint(s,piece),.16)){s.placed.push(piece);s.score++;success(s);if(s.placed.length===s.pieceGrid*s.pieceRows)finish(s);}else if(!s.progressive||s.pieces.includes(piece)&&!s.placed.includes(piece)&&near(p,slotPoint(s,nearest),.16))miss(s);
 }
}
function cancel(s){s.gesture=null;}
function tick(s,dt){dt=Math.max(0,Math.min(.05,dt));s.time+=dt;if(s.phase==='match'){if(s.resetAt&&s.time>=s.resetAt){s.open=[];s.resetAt=0;}if(s.waitAt&&s.time>=s.waitAt){s.waitAt=0;phase(s,'home');}}
 if(s.phase==='watch'){s.watchClock-=dt;if(s.watchClock<=0){if(s.watchIndex<s.pattern.length){emit(s,'patternWord',{id:s.pattern[s.watchIndex],index:s.watchIndex++});s.watchClock=Infinity;}else phase(s,'pack');}}
 if(s.phase==='train'&&s.time>=s.waitAt){s.round++;if(s.round===3)finish(s);else newPattern(s);}
 if(s.phase==='happy'&&s.time>=s.waitAt)nextSound(s);
 if(s.phase==='restored'&&s.time>=s.waitAt){if(s.round===3)finish(s);else{if(s.progressive)newPaddock(s);else{s.friends=shuffle(animals,s.random).slice(0,3);s.missing=Math.floor(s.random()*3);}phase(s,'look');}}
 if(s.phase==='pick')for(const p of s.produce){if(String(s.gesture?.target)===String(p.key))continue;if(s.progressive)p.x=p.baseX+Math.sin(s.time*s.difficulty.harvestSpeed*10+p.key)*.045;else{p.x+=p.dir*dt*.12;if(p.x>1.05)p.x=-.05;if(p.x<-.05)p.x=1.05;}}
}
const api={ids,animals,foods,pos,near,slotPoint,create,card,ready,lookAgain,replay,continueWatch,start,move,end,cancel,tick,profile,challenge,stages,hint,wagonPoint,doorIds};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else window.meadowFriendsCore=api;
})();
