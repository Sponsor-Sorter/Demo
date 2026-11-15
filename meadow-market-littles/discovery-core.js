/* Find a real missing detail, then return it to its place. Free mistakes, one clock. */
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
 function create(level=1,variants=[0,1,2],random=Math.random){const more=Number(level)>=5,s={level,variants:variants.slice(0,3),page:0,phase:'look',items:[],missing:[],found:[],restored:[],selected:null,score:0,goal:more?18:12,time:0,wait:0,serial:0,done:false,events:[],more};page(s,random);return s;}
 function page(s,random=Math.random){s.variant=Number.isInteger(s.variants[s.page])&&themes[s.variants[s.page]]?s.variants[s.page]:s.page;const theme=themes[s.variant];s.items=shuffle(theme.items,random);if(s.more)s.items.push(...shuffle(['apple','hen','sheep','carrot','basket','flower','duck','hay'].filter(id=>!s.items.includes(id)),random).slice(0,2));s.missing=shuffle(s.items.map((_,i)=>i),random).slice(0,s.more?3:2);s.found=[];s.restored=[];s.selected=null;s.phase='look';s.serial++;s.hint=-1;s.misses=0;}
 function find(s,i){if(s.phase!=='look'||!valid(s,i)||s.restored.includes(i))return false;if(!s.missing.includes(i)){s.misses++;s.events.push({type:'retry'});if(s.misses>=2)hint(s);return false;}s.selected=i;s.found.push(i);s.score++;s.phase='restore';s.hint=-1;s.serial++;s.events.push({type:'found',index:i});return true;}
 function restore(s,source,target){if(s.phase!=='restore'||!valid(s,source)||!valid(s,target)||source!==s.selected||target!==source)return false;s.restored.push(source);s.score++;s.selected=null;s.phase='happy';s.wait=s.time+1.25;s.serial++;s.events.push({type:'restored',index:source,id:s.items[source]});return true;}
 function tick(s,dt){if(s.done||!Number.isFinite(dt)||dt<0)return;s.time+=Math.min(.05,dt);if(s.phase==='happy'&&s.time>=s.wait){s.phase=s.restored.length===s.missing.length?'pageDone':'look';s.serial++;s.events.push({type:s.phase});}}
 function next(s,random=Math.random){if(s.phase!=='pageDone')return false;if(s.page===2){s.phase='done';s.done=true;s.serial++;s.events.push({type:'done'});return true;}s.page++;page(s,random);return true;}
 function hint(s){if(s.phase!=='look'&&s.phase!=='restore')return false;s.hint=s.phase==='restore'?s.selected:s.missing.find(i=>!s.restored.includes(i));s.events.push({type:'hint'});return true;}
 function positions(n){return n===6?[{x:20,y:40},{x:50,y:40},{x:80,y:40},{x:20,y:80},{x:50,y:80},{x:80,y:80}]:[{x:27,y:40},{x:73,y:40},{x:27,y:80},{x:73,y:80}];}
 window.meadowDiscoveryCore={themes,rotation,create,find,restore,tick,next,hint,positions};
})();
