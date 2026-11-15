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
  const milestones=[1,4,9,16];
  function profile(level=1){
    level=Math.max(1,Math.floor(Number(level)||1));
    const step=milestones.reduce((n,v,i)=>level>=v?i:n,0);
    return {level:milestones[step],step,pickNeeded:[2,2,3,4][step],pickChoices:[4,5,6,8][step],orderLength:[2,3,3,4][step],orderChoices:[3,4,5,6][step],friends:[2,3,3,4][step],sortChoices:[4,4,6,8][step],countMin:[1,1,2,3][step],countMax:[3,4,5,6][step],numberChoices:[2,3,3,4][step],basketMin:[1,1,2,3][step],basketMax:[2,3,4,5][step],basketGap:[2,2,1,1][step]};
  }
  function growing(kind,seed,index,p){
    const random=rng((seed+Math.imul(index+1,1103515245))>>>0),order=shuffle(foods,rng(seed));
    if(kind==='pick'){
      const wanted=order[index],others=shuffle(foods.filter(f=>f!==wanted),random);
      return {wanted,needed:p.pickNeeded,items:shuffle([...Array(p.pickNeeded).fill(wanted),...Array.from({length:p.pickChoices-p.pickNeeded},(_,i)=>others[i%others.length])],random),moved:[]};
    }
    if(kind==='order'){
      const list=Array.from({length:p.orderLength},(_,i)=>order[(index+i)%6]),others=shuffle(foods.filter(f=>!list.includes(f)),random);
      return {order:list,items:shuffle([...list,...others.slice(0,p.orderChoices-list.length)],random),moved:[],friend:['sheep','goat','cow'][index]};
    }
    if(kind==='home')return {items:shuffle(shuffle(['hen','cow','sheep','goat'],rng(seed+index)).slice(0,p.friends),random),moved:[]};
    if(kind==='sort'){
      const fruit=order.find(f=>family(f)==='fruit'),vegetable=order.find(f=>family(f)==='vegetable'),rest=order.filter(f=>f!==fruit&&f!==vegetable),items=[fruit,vegetable,...rest];
      return {items:shuffle(Array.from({length:p.sortChoices},(_,i)=>items[i%6]),random),moved:[],bins:{fruit:[],vegetable:[]}};
    }
    if(kind==='count'){
      const smaller=shuffle(Array.from({length:p.countMax-p.countMin},(_,i)=>p.countMin+i),rng(seed)),counts=shuffle([...smaller.slice(0,2),p.countMax],rng(seed^0x77c0ffee)),count=counts[index],near=Array.from({length:8},(_,i)=>i+1).filter(n=>n!==count).sort((a,b)=>Math.abs(a-count)-Math.abs(b-count)||a-b);
      return {count,items:Array(count).fill('apple'),moved:[],choices:shuffle([count,...near.slice(0,p.numberChoices-1)],random),answer:null};
    }
    if(kind==='fuller'){
      const lower=p.basketMin+(seed+index)%(p.basketMax-p.basketMin+1),higher=lower+p.basketGap;
      return {amounts:(seed+index)%2?[higher,lower]:[lower,higher],slots:[null,null],chosen:null};
    }
    throw Error('Unknown harvest activity');
  }
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
    constructor(kind,{seed=1,tier=1,index=0,progressive=false,level=1}={}){
      this.kind=kind;this.done=false;this.progressive=Boolean(progressive);this.profile=profile(level);this.misses=0;this.hint=null;
      this.state=this.progressive?growing(kind,seed>>>0,Math.abs(index%3),this.profile):initial(kind,seed>>>0,tier===2?2:1,index%3);
    }
    miss(){if(!this.progressive||this.done)return {ok:false,done:this.done,ignored:true};this.misses++;return {ok:false,done:false,mistake:true,helpReady:this.misses>=2};}
    requestHint(){
      if(!this.progressive||this.done||this.misses<2)return null;
      const s=this.state,result={sources:[],targets:[],actions:[],caption:''};
      if(this.kind==='fuller'){
        if(s.slots.every(v=>v!==null)){result.actions=['choose:'+s.amounts.indexOf(Math.max(...s.amounts))];result.caption='This basket has more apples. Touch the glowing basket.';}
        else{result.sources=[String([0,1].find(i=>!s.slots.includes(i)))];result.targets=[String(s.slots.indexOf(null))];result.caption='Move this apple basket onto the glowing side of the scales.';}
      }else if(this.kind==='count'&&s.moved.length===s.count){result.sources=['number-'+s.count];result.targets=['label'];result.caption='This number matches our apples. Move it onto the glowing label.';}
      else{
        const i=s.items.findIndex((id,i)=>!s.moved.includes(i)&&(this.kind!=='pick'||id===s.wanted)&&(this.kind!=='order'||id===s.order[s.moved.length]));
        if(i<0)return null;result.sources=[String(i)];result.targets=[this.kind==='home'?home(s.items[i]):this.kind==='sort'?family(s.items[i]):'basket'];
        result.caption=this.kind==='home'?'Guide this friend to the glowing home.':this.kind==='sort'?'Carry this harvest to the glowing basket.':'Carry this piece to the glowing basket.';
      }
      this.hint=result;return result;
    }
    act(action,{item,target,number}={}){
      if(this.done)return {ok:false,done:true,duplicate:true};const s=this.state;let ok=false,phaseChanged=false,attempt=false;
      if(action==='place'&&this.kind==='fuller'){
        attempt=Number.isInteger(item)&&item>=0&&item<2&&!s.slots.includes(item)&&Number.isInteger(target)&&target>=0&&target<2;
        if(Number.isInteger(item)&&item>=0&&item<2&&Number.isInteger(target)&&target>=0&&target<2&&s.slots[target]===null&&!s.slots.includes(item)){s.slots[target]=item;ok=true;phaseChanged=s.slots.every(v=>v!==null);}
      }else if(action==='choose'&&this.kind==='fuller'){
        attempt=s.slots.every(v=>v!==null)&&Number.isInteger(item)&&item>=0&&item<2;
        ok=s.slots.every(v=>v!==null)&&Number.isInteger(item)&&item>=0&&item<2&&s.amounts[item]===Math.max(...s.amounts);if(ok){s.chosen=item;this.done=true;}
      }else if(action==='answer'&&this.kind==='count'){
        attempt=s.moved.length===s.count&&s.choices.includes(number);
        ok=s.moved.length===s.count&&Number.isInteger(number)&&number===s.count;if(ok){s.answer=number;this.done=true;}
      }else if(action==='place'&&Array.isArray(s.items)&&Number.isInteger(item)&&item>=0&&item<s.items.length&&!s.moved.includes(item)){
        const id=s.items[item];attempt=['basket','label','coop','barn','paddock','fruit','vegetable'].includes(target);
        if(this.kind==='pick')ok=target==='basket'&&id===s.wanted;
        if(this.kind==='order')ok=target==='basket'&&id===s.order[s.moved.length];
        if(this.kind==='home')ok=target===home(id);
        if(this.kind==='sort')ok=target===family(id);
        if(this.kind==='count')ok=target==='basket';
        if(ok){s.moved.push(item);if(this.kind==='sort')s.bins[target].push(id);const needed=this.kind==='pick'?s.needed:this.kind==='order'?s.order.length:s.items.length;phaseChanged=this.kind==='count'&&s.moved.length===needed;this.done=this.kind!=='count'&&s.moved.length===needed;}
      }
      if(ok){this.misses=0;this.hint=null;}
      else if(attempt&&this.progressive)return this.miss();
      else if(this.progressive)return {ok:false,done:false,ignored:true};
      return {ok,done:this.done,phaseChanged};
    }
  }
  window.meadowHarvest58Core={catalog,Round,family,home,shuffle,rng,profile,milestones};
})();
