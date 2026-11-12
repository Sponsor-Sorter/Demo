/* Independent, deterministic lesson rules. Incorrect tries never spend a completed round. */
(() => {
  'use strict';
  const catalog=[
    ['water','Water the Garden','jade','Turn gutters and grow a garden'],['sounds','Jade’s Sound Train','jade','Build words and blend their sounds'],['shares','Picnic Fair Shares','jade','Share a picnic with farm friends'],['rolling','Rhys’s Rolling Rescue','rhys','Build ramps and guide a trolley'],['patchwork','Patchwork Farm Animals','rhys','Fit and turn chunky wooden shapes'],['orchard','Orchard Add and Take Away','jay','Pick, share and discover numbers'],['rhymes','Rhyming River','rhys','Build bridges with rhyming pictures'],['pip','Where’s Pip?','jay','Listen, move and find hiding places'],['coding','Little Tractor Coding','rhys','Arrange arrows and drive your route'],['freeze','Meadow Freeze Dance','jay','Move to music, then freeze together']
  ].map(([kind,name,farmer,description])=>({id:'learning_'+kind,kind,name,farmer,description,scene:'assets/generated/learning56/'+kind+(kind==='pip'?'-scene-v2.webp':'-scene.webp'),preview:'assets/generated/learning56/'+kind+'-preview.webp'}));
  const words=['cat','dog','pig','hen','sun','bed','pen','bus'];
  const families=[['cat','hat','mat'],['dog','log','frog'],['bee','tree','key'],['goat','boat','coat']];
  const rng=seed=>()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  function shuffle(list,random){const a=list.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
  const rotateMask=mask=>((mask<<1)&15)|(mask>>3),dirs=[[0,-1,1,4],[1,0,2,8],[0,1,4,1],[-1,0,8,2]];
  function waterFlow(state){let at=0,incoming=8;const path=[],seen=new Set();for(let i=0;i<10;i++){if(seen.has(at))return {ok:false,path,bad:at};seen.add(at);path.push(at);const mask=state.pipes[at];if(!(mask&incoming))return {ok:false,path,bad:at};const exit=dirs.find(d=>(mask&d[2])&&d[2]!==incoming);if(!exit)return {ok:false,path,bad:at};const x=at%3+exit[0],y=Math.floor(at/3)+exit[1];if(x<0||x>2||y<0||y>2)return {ok:at===8&&exit[2]===4,path,bad:at};at=y*3+x;incoming=exit[3];}return {ok:false,path,bad:at};}
  function routeResult(state){let pos=state.start;const path=[pos];for(let i=0;i<state.commands.length;i++){const c=state.commands[i],x=pos%state.size,y=Math.floor(pos/state.size),d={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]}[c];if(!d)return {ok:false,path,bad:i};const nx=x+d[0],ny=y+d[1],next=ny*state.size+nx;if(nx<0||ny<0||nx>=state.size||ny>=state.size||state.blocks.includes(next))return {ok:false,path,bad:i};pos=next;path.push(pos);}return {ok:pos===state.goal,path,bad:pos===state.goal?null:state.commands.length};}
  const shapePlans={
    sheep:[['oval',42,48,43,32,0],['circle',72,36,22,22,0],['rect',30,68,9,24,0],['rect',53,68,9,24,0]],
    hen:[['oval',46,50,40,34,0],['circle',69,32,21,21,0],['triangle',82,33,14,14,90],['rect',40,68,7,19,0],['rect',58,68,7,19,0]],
    pig:[['oval',45,50,48,34,0],['circle',74,47,24,24,0],['triangle',69,29,14,16,0],['rect',30,68,9,23,0],['rect',54,68,9,23,0]]
  };
  function make(kind,seed,tier,round){
    const random=rng(seed),pick=a=>a[Math.floor(random()*a.length)];
    if(kind==='water'){const routes=[[0,1,4,5,8],[0,3,4,7,8],[0,1,2,5,8],[0,3,6,7,8]],route=shuffle(routes,rng(seed-round*997))[round%4],answer=Array(9).fill(0);for(let i=0;i<route.length;i++){const a=route[i],prev=i?route[i-1]:a-1,next=i<route.length-1?route[i+1]:a+3;const edge=b=>b===a-3?1:b===a+1?2:b===a+3?4:8;answer[a]=edge(prev)|edge(next);}const pipes=answer.map((m,i)=>{if(!m)return 0;let turns=tier===1&&i%2===0?0:1+Math.floor(random()*3);while(turns--)m=rotateMask(m);return m;});return {pipes,answer,route,flow:[],bad:null};}
    if(kind==='sounds'){const word=shuffle(words,rng(seed-round*997))[round%words.length],letters=shuffle([...new Set([...word,...shuffle('abcdefghijklmnopqrstuvwxyz'.split(''),random).filter(c=>!word.includes(c)).slice(0,tier===1?1:3)])],random);return {word,letters,slots:Array(3).fill(null),bad:null};}
    if(kind==='shares'){const friends=tier===1?2:3,each=round===0?1:round===1?2:3,food=['apple','carrot','strawberry'][(seed+round)%3];return {friends,each,food,animals:shuffle(['sheep','goat','cow'],random).slice(0,friends),given:Array(friends*each).fill(-1)};}
    if(kind==='rolling'){const plans=[[0,1,1,0],[0,0,1,1],[1,0,0,1],[1,1,0,1]],heights=shuffle(plans,rng(seed-round*997))[round%4];return {heights,ramps:Array(3).fill(null),friend:['sheep','goat','cow'][round%3],bad:null};}
    if(kind==='patchwork'){const animal=['sheep','hen','pig'][round%3],pieces=shapePlans[animal].map(([shape,x,y,w,h,angle],i)=>({id:i,shape,x,y,w,h,angle,turn:tier===1?angle:(angle+90*(1+Math.floor(random()*3)))%360,placed:false}));return {animal,pieces,order:shuffle(pieces.map(p=>p.id),random)};}
    if(kind==='orchard'){const operation=round===1?'take':'add',a=operation==='take'?(tier===2?2:3):1+round,b=operation==='take'&&tier===2?2:round===2?2:1,answer=operation==='take'?a-b:a+b;return {operation,a,b,answer,moved:[],choices:shuffle([...new Set([Math.max(0,answer-1),answer,answer+1,...(answer===0?[2]:[])])],random),bad:null};}
    if(kind==='rhymes'){const family=shuffle(families,rng(seed-round*997))[round%families.length],others=shuffle(families.flat().filter(w=>!family.includes(w)),random).slice(0,2);return {family,choices:shuffle([...family.slice(1),...others],random),slots:[family[0],null,null],bad:null};}
    if(kind==='pip'){const places=shuffle(['inside','under','behind'],rng(seed-round*997));return {place:places[round%3],found:false,attempt:null};}
    if(kind==='coding'){const size=tier===1?3:4,plans=tier===1?[[6,4,[]],[8,4,[]],[6,2,[0]]]:[[12,3,[5,9]],[15,0,[6,10]],[12,3,[1,5,10]]],[start,goal,blocks]=plans[round%3];return {size,start,goal,blocks,commands:[],limit:tier===1?6:8,bad:null,walk:[]};}
    if(kind==='freeze')return {phase:'dance',distance:0,elapsed:0,still:0,grace:.75,freezeTravel:0,friend:['sheep','goat','cow'][round%3],x:.5,y:.55,wobbles:0};
    throw Error('Unknown lesson');
  }
  class Round {
    constructor(kind,{seed=1,tier=1,index=0}={}){if(!catalog.some(g=>g.kind===kind))throw Error('Unknown lesson');this.kind=kind;this.seed=seed>>>0;this.tier=tier===2?2:1;this.index=index;this.state=make(kind,(this.seed+index*997)>>>0,this.tier,index);this.done=false;this.mistakes=0;}
    result(ok,extra={}){if(!ok)this.mistakes++;return {ok,done:this.done,...extra};}
    act(action,p={}){
      if(this.done)return {ok:false,done:true,duplicate:true};const s=this.state,validIndex=(n,size)=>Number.isInteger(n)&&n>=0&&n<size;
      if(this.kind==='water'){
        if(action==='turn'&&validIndex(p.index,9)&&s.pipes[p.index]){s.pipes[p.index]=rotateMask(s.pipes[p.index]);s.flow=[];return this.result(true);}
        if(action==='flow'){const r=waterFlow(s);s.flow=r.path;s.bad=r.ok?null:r.bad;this.done=r.ok;return this.result(r.ok,{path:r.path});}
      }
      if(this.kind==='sounds'){
        if(action==='place'&&validIndex(p.slot,3)&&s.letters.includes(p.letter)){s.slots[p.slot]=p.letter;s.bad=null;return this.result(true);}
        if(action==='clear'&&validIndex(p.slot,3)){s.slots[p.slot]=null;return this.result(true);}
        if(action==='go'){const bad=s.slots.findIndex((x,i)=>x!==s.word[i]);s.bad=bad<0?null:bad;this.done=bad<0;return this.result(this.done);}
      }
      if(this.kind==='shares'){
        if(action==='give'&&validIndex(p.item,s.given.length)&&Number.isInteger(p.friend)&&p.friend>=-1&&p.friend<s.friends){s.given[p.item]=p.friend;return this.result(true);}
        if(action==='check'){const counts=Array.from({length:s.friends},(_,i)=>s.given.filter(n=>n===i).length);this.done=counts.every(n=>n===s.each);return this.result(this.done,{counts});}
      }
      if(this.kind==='rolling'){
        if(action==='place'&&validIndex(p.slot,3)&&[-1,0,1].includes(p.ramp)){s.ramps[p.slot]=p.ramp;s.bad=null;return this.result(true);}
        if(action==='go'){const bad=s.ramps.findIndex((r,i)=>r===null||r!==s.heights[i+1]-s.heights[i]);s.bad=bad<0?null:bad;this.done=bad<0;return this.result(this.done,{stop:bad<0?3:bad});}
      }
      if(this.kind==='patchwork'){
        const piece=s.pieces.find(x=>x.id===p.item);if(!piece||piece.used)return this.result(false);
        if(action==='turn'){piece.turn=(piece.turn+90)%360;return this.result(true);}
        if(action==='place'){const target=s.pieces.find(x=>x.id===p.target);if(!target||target.placed||target.shape!==piece.shape||target.w!==piece.w||target.h!==piece.h)return this.result(false);const period=piece.shape==='circle'?1:['oval','rect'].includes(piece.shape)?180:360,ok=Math.abs(piece.turn-target.angle)%period===0;if(ok){piece.used=true;target.placed=true;target.fillFrom=piece.id;}this.done=s.pieces.every(x=>x.placed);return this.result(ok);}
      }
      if(this.kind==='orchard'){
        if(action==='move'&&validIndex(p.item,s.b)&&!s.moved.includes(p.item)){s.moved.push(p.item);return this.result(true);}
        if(action==='answer'&&s.moved.length===s.b&&s.choices.includes(p.number)){this.done=p.number===s.answer;s.bad=this.done?null:p.number;return this.result(this.done);}
      }
      if(this.kind==='rhymes'){
        if(action==='place'&&validIndex(p.slot,3)&&p.slot>0&&s.choices.includes(p.word)){if(!s.family.includes(p.word)||s.slots.includes(p.word)){s.bad=p.word;return this.result(false);}s.slots[p.slot]=p.word;s.bad=null;this.done=s.slots.every(Boolean);return this.result(true);}
      }
      if(this.kind==='pip'&&action==='hide'&&['inside','under','behind'].includes(p.place)){s.attempt=p.place;this.done=p.place===s.place;s.found=this.done;return this.result(this.done);}
      if(this.kind==='coding'){
        if(action==='add'&&['up','down','left','right'].includes(p.direction)&&s.commands.length<s.limit){s.commands.push(p.direction);s.bad=null;return this.result(true);}
        if(action==='remove'&&validIndex(p.index,s.commands.length)){s.commands.splice(p.index,1);return this.result(true);}
        if(action==='clear'){s.commands=[];s.walk=[];s.bad=null;return this.result(true);}
        if(action==='go'){const r=routeResult(s);s.walk=r.path;s.bad=r.bad;this.done=r.ok;return this.result(r.ok,{path:r.path});}
      }
      if(this.kind==='freeze'&&action==='move'&&Number.isFinite(p.distance)&&p.distance>0){const d=Math.min(.5,p.distance);if(s.phase==='dance')s.distance+=d;else if(s.grace<=0){s.freezeTravel+=d;if(s.freezeTravel>=.025){s.still=0;s.freezeTravel=0;s.wobbles++;}}if(Number.isFinite(p.x)&&Number.isFinite(p.y)){s.x=Math.max(.12,Math.min(.88,p.x));s.y=Math.max(.25,Math.min(.8,p.y));}return this.result(true);}
      return this.result(false);
    }
    step(seconds){if(this.done||this.kind!=='freeze')return null;const s=this.state,dt=Math.max(0,Math.min(.05,Number(seconds)||0));s.elapsed+=dt;if(s.phase==='dance'){if(s.elapsed>=2&&s.distance>=.35){s.phase='freeze';s.elapsed=0;return 'freeze';}}else if(s.grace>0)s.grace=Math.max(0,s.grace-dt);else{s.still+=dt;if(s.still>=1.4){this.done=true;return 'done';}}return null;}
  }
  globalThis.meadowLearningCore={catalog,Round,rng,shuffle,waterFlow,routeResult,rotateMask,words,families};
})();
