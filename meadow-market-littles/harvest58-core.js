/* Rules for the six hands-on harvest activities. A piece is consumed only by a valid move. */
(() => {
  'use strict';
  const foods=['apple','strawberry','pear','carrot','corn','potato'];
  const family=id=>['apple','strawberry','pear'].includes(id)?'fruit':'vegetable';
  const home=id=>id==='hen'?'coop':id==='cow'?'barn':'paddock';
  const catalog=[
    ['listenharvest','pick','Listen, Look, Harvest','jade','Pick the named harvest and carry it to your basket'],
    ['spokenorder','order','Pack the Spoken Order','jay','Listen, pack in order and deliver to a farm friend'],
    ['animalhome','home','Find the Animal’s Home','jay','Guide the farm friends into their cosy homes'],
    ['applecartsort','sort','Apple Cart Sort','jay','Move the harvest into fruit and vegetable baskets'],
    ['harvestcount','count','Count the Harvest','rhys','Pick, count and label a basket of apples'],
    ['fullbasket','fuller','Which Basket Is Fuller?','rhys','Load the scales and discover which basket has more']
  ].map(([id,kind,name,farmer,description])=>({id,kind,name,farmer,description,scene:'assets/generated/harvest58/'+kind+'-scene.webp',preview:window.meadowGamePreviews?.[id]||'assets/generated/learning56/orchard-preview.webp'}));
  const rng=seed=>()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  function shuffle(values,random){const a=values.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
  function initial(kind,seed,tier,index){
    const random=rng((seed+Math.imul(index+1,1103515245))>>>0),order=shuffle(foods,rng(seed));
    if(kind==='pick'){const wanted=order[index],needed=tier===1?2:3,other=shuffle(foods.filter(f=>f!==wanted),random).slice(0,6-needed);return {wanted,needed,items:shuffle([...Array(needed).fill(wanted),...other],random),moved:[]};}
    if(kind==='order'){const list=[order[index],order[(index+2)%6],order[(index+4)%6]],extra=foods.filter(f=>!list.includes(f));return {order:list,items:shuffle([...list,...extra],random),moved:[],friend:['sheep','goat','cow'][index]};}
    if(kind==='home'){const friends=shuffle(['hen','cow','sheep','goat'],rng(seed)).filter((_,i)=>i!==(index+3)%4);return {items:shuffle(friends,random),moved:[]};}
    if(kind==='sort'){const items=tier===1?shuffle([order.find(f=>family(f)==='fruit'),order.find(f=>family(f)==='vegetable'),...order.filter(f=>f!==order.find(f=>family(f)==='fruit')&&f!==order.find(f=>family(f)==='vegetable')).slice(0,2)],random):shuffle(foods,random);return {items,moved:[],bins:{fruit:[],vegetable:[]}};}
    if(kind==='count'){const count=(tier===1?1:3)+(index+(seed%3))%3;return {count,items:Array(count).fill('apple'),moved:[],choices:shuffle([count-1,count,count+1],random),answer:null};}
    if(kind==='fuller'){const lower=1+((seed+index)%3),higher=lower+1+(tier===2?1:0),amounts=(seed+index)%2?[higher,lower]:[lower,higher];return {amounts,slots:[null,null],chosen:null};}
    throw Error('Unknown harvest activity');
  }
  class Round{
    constructor(kind,{seed=1,tier=1,index=0}={}){this.kind=kind;this.done=false;this.state=initial(kind,seed>>>0,tier===2?2:1,index%3);}
    act(action,{item,target,number}={}){
      if(this.done)return {ok:false,done:true,duplicate:true};const s=this.state;let ok=false,phaseChanged=false;
      if(action==='place'&&this.kind==='fuller'){
        if(Number.isInteger(item)&&item>=0&&item<2&&Number.isInteger(target)&&target>=0&&target<2&&s.slots[target]===null&&!s.slots.includes(item)){s.slots[target]=item;ok=true;phaseChanged=s.slots.every(v=>v!==null);}
      }else if(action==='choose'&&this.kind==='fuller'){
        ok=s.slots.every(v=>v!==null)&&Number.isInteger(item)&&item>=0&&item<2&&s.amounts[item]===Math.max(...s.amounts);if(ok){s.chosen=item;this.done=true;}
      }else if(action==='answer'&&this.kind==='count'){
        ok=s.moved.length===s.count&&Number.isInteger(number)&&number===s.count;if(ok){s.answer=number;this.done=true;}
      }else if(action==='place'&&Array.isArray(s.items)&&Number.isInteger(item)&&item>=0&&item<s.items.length&&!s.moved.includes(item)){
        const id=s.items[item];
        if(this.kind==='pick')ok=target==='basket'&&id===s.wanted;
        if(this.kind==='order')ok=target==='basket'&&id===s.order[s.moved.length];
        if(this.kind==='home')ok=target===home(id);
        if(this.kind==='sort')ok=target===family(id);
        if(this.kind==='count')ok=target==='basket';
        if(ok){s.moved.push(item);if(this.kind==='sort')s.bins[target].push(id);const needed=this.kind==='pick'?s.needed:this.kind==='order'?3:s.items.length;phaseChanged=this.kind==='count'&&s.moved.length===needed;this.done=this.kind!=='count'&&s.moved.length===needed;}
      }
      return {ok,done:this.done,phaseChanged};
    }
  }
  window.meadowHarvest58Core={catalog,Round,family,home,shuffle,rng};
})();
