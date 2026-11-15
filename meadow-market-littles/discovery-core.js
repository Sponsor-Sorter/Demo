/* Compare changed details, then restore each picture. Free mistakes and gradual challenge. */
(() => {
 'use strict';
 const themes=[
  {name:'Meadow friends',scene:'discovery69/meadow',items:['hen','sheep','goat','cow']},
  {name:'A little picnic',scene:'discovery69/meadow',items:['basket','apple','flower','duck']},
  {name:'Orchard morning',scene:'harvest58/pick-scene',items:['basket','pear','sheep','apple']},
  {name:'A cosy farm',scene:'harvest58/home-scene',items:['hay','hen','nest','goat']},
  {name:'Market morning',scene:'harvest58/sort-scene',items:['pumpkin','basket','corn','carrot']},
  {name:'Garden visitors',scene:'discovery69/meadow',items:['duck','flower','sheep','basket']},
  {name:'Apple picking',scene:'harvest58/pick-scene',items:['apple','basket','goat','flower']},
  {name:'Little farm helpers',scene:'harvest58/home-scene',items:['nest','duck','hay','hen']},
  {name:'Fresh harvest',scene:'harvest58/count-scene',items:['carrot','pumpkin','basket','pear']},
  {name:'Sunshine meadow',scene:'discovery69/meadow',items:['flower','cow','duck','hay']},
  {name:'A basket to share',scene:'harvest58/fuller-scene',items:['basket','corn','apple','hen']},
  {name:'Farmyard afternoon',scene:'harvest58/home-scene',items:['sheep','nest','flower','goat']}
 ];
 const shuffle=(list,random=Math.random)=>{const a=list.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
 function rotation(saved,last,random=Math.random){let bag=Array.isArray(saved)?[...new Set(saved.filter(n=>Number.isInteger(n)&&n>=0&&n<themes.length))]:[];if(!bag.length){bag=shuffle(themes.map((_,i)=>i),random);if(bag[bag.length-1]===last)[bag[0],bag[bag.length-1]]=[bag[bag.length-1],bag[0]];}const choice=bag.pop();return {choice,remaining:bag};}
 const valid=(s,i)=>Number.isInteger(i)&&i>=0&&i<s.items.length;
 const pool=['hen','cow','sheep','goat','duck','basket','flower','hay','nest','apple','pear','carrot','corn','pumpkin','strawberry','tomato','potato','broccoli'];
 const stages=[[1,4,1,0],[2,4,2,0],[4,4,2,1],[7,6,2,1],[11,6,3,2],[16,8,3,2],[23,8,4,2],[32,8,4,4],[44,8,5,5]];
 function profile(value=1,legacy=false){const raw=Number(value),level=Number.isFinite(raw)?Math.max(1,Math.min(999,Math.floor(raw)||1)):1;if(legacy)return {level,details:level>=5?6:4,changes:level>=5?3:2,swaps:0,stage:0};const i=stages.findLastIndex(v=>v[0]<=level),v=stages[i];return {level,details:v[1],changes:v[2],swaps:v[3],stage:i+1};}
 function challenge(level,direction){const p=profile(level),i=p.stage-1;return direction<0?stages[Math.max(0,i-1)][0]:i===stages.length-1?p.level:stages[i+1][0];}
 function helpReset(s){s.hint=-1;s.misses=0;s.hintReady=false;}
 function create(level=1,variants=[0,1,2],random=Math.random,options={}){const legacy=options.legacy===true,difficulty=profile(level,legacy),s={level:difficulty.level,difficulty,legacy,variants:variants.slice(0,3),page:0,phase:'look',items:[],picture:[],missing:[],found:[],restored:[],selected:null,score:0,goal:difficulty.changes*6,time:0,wait:0,serial:0,done:false,events:[]};page(s,random);return s;}
 const family=id=>['hen','cow','sheep','goat','duck'].includes(id)?'animal':['basket','flower','hay','nest'].includes(id)?'farm':'food';
 function page(s,random=Math.random){s.variant=Number.isInteger(s.variants[s.page])&&themes[s.variants[s.page]]?s.variants[s.page]:s.page;const theme=themes[s.variant],d=s.difficulty;s.items=shuffle(theme.items,random);s.items.push(...shuffle((s.legacy?['apple','hen','sheep','carrot','basket','flower','duck','hay']:pool).filter(id=>!s.items.includes(id)),random).slice(0,d.details-s.items.length));s.missing=shuffle(s.items.map((_,i)=>i),random).slice(0,d.changes);s.picture=s.items.slice();const available=shuffle(pool.filter(id=>!s.items.includes(id)),random);s.missing.forEach((i,n)=>{if(n<d.swaps){const k=available.findIndex(id=>family(id)===family(s.items[i]));s.picture[i]=available.splice(k<0?0:k,1)[0];}else s.picture[i]=null;});s.found=[];s.restored=[];s.selected=null;s.phase='look';s.serial++;helpReset(s);}
 function miss(s){if(s.phase!=='look'&&s.phase!=='restore')return false;s.misses++;s.events.push({type:'retry'});if(s.legacy){if(s.misses>=2)hint(s);}else if(s.misses>=2&&!s.hintReady){s.hintReady=true;s.events.push({type:'hintReady'});}return false;}
 function find(s,i){if(s.phase!=='look'||!valid(s,i)||s.restored.includes(i))return false;if(!s.missing.includes(i))return miss(s);s.selected=i;s.found.push(i);s.score++;s.phase='restore';helpReset(s);s.serial++;s.events.push({type:'found',index:i});return true;}
 function restore(s,source,target){if(s.phase!=='restore'||!valid(s,source)||!valid(s,target))return false;if(source!==s.selected||target!==source)return s.legacy?false:miss(s);s.restored.push(source);s.score++;s.selected=null;s.phase='happy';helpReset(s);s.wait=s.time+1.25;s.serial++;s.events.push({type:'restored',index:source,id:s.items[source]});return true;}
 function tick(s,dt){if(s.done||!Number.isFinite(dt)||dt<0)return;s.time+=Math.min(.05,dt);if(s.phase==='happy'&&s.time>=s.wait){s.phase=s.restored.length===s.missing.length?'pageDone':'look';s.serial++;s.events.push({type:s.phase});}}
 function next(s,random=Math.random){if(s.phase!=='pageDone')return false;if(s.page===2){s.phase='done';s.done=true;s.serial++;s.events.push({type:'done'});return true;}s.page++;page(s,random);return true;}
 function hint(s){if((s.phase!=='look'&&s.phase!=='restore')||(!s.legacy&&!s.hintReady))return false;s.hint=s.phase==='restore'?s.selected:s.missing.find(i=>!s.restored.includes(i));s.events.push({type:'hint'});return true;}
 function positions(n){const xs=n===8?[14,38,62,86]:n===6?[20,50,80]:[27,73];return [40,80].flatMap(y=>xs.map(x=>({x,y})));}
 window.meadowDiscoveryCore={themes,rotation,create,find,restore,tick,next,hint,positions,profile,challenge,miss,stages};
})();
