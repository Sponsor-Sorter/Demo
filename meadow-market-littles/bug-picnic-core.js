/* Top-down picnic defence. Pure rules; no storage, timers, audio or DOM.
   All ants are valid targets. Missed ants can carry a crumb away, but never
   deduct progress, spend an attempt or turn a preschool round into a failure. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.meadowBugPicnicCore=factory();})(globalThis,()=>{
  'use strict';
  const colours=[['coral','#f46869','#b92549'],['blue','#54bbf4','#2464bd'],['yellow','#ffda4b','#c18a12'],['green','#8cd953','#398b39'],['purple','#bf8bef','#7548b9'],['orange','#ffab47','#cf5f24']];
  const bosses=['acorn','bubble','tickle'];
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),finite=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
  function settings(level=1){
    const n=clamp(Math.floor(Number(level)||1),1,12),extra=Math.floor((n-1)*.6),waves=[12+extra,14+extra,16+extra];
    return{level:n,waves,goal:waves.reduce((a,b)=>a+b,0),maxAnts:Math.min(6,4+Math.floor(n/4)),speed:72+n*5,approachSeconds:5.8-n*.13,spawnSeconds:.99-n*.015,armourHp:Math.min(4,2+Math.floor((n-1)/4)),armourEvery:n<4?4:n<8?3:2,boss:bosses[(n-1)%3],claspHp:n>=7?2:1,bubbleHp:n>=8?2:1,bodyHp:3+Math.min(3,Math.floor((n-1)/3))};
  }
  function ellipse(p,c,rx,ry){return finite(p)&&rx>0&&ry>0&&((p.x-c.x)/rx)**2+((p.y-c.y)/ry)**2<=1;}
  function antContains(p,a){if(!finite(p))return false;const angle=a.angle||0,dx=p.x-a.x,dy=p.y-a.y;return ellipse({x:dx*Math.cos(angle)+dy*Math.sin(angle),y:-dx*Math.sin(angle)+dy*Math.cos(angle)},{x:0,y:0},a.r*1.75,a.r*1.25);}
  function antBounds(a){const angle=a.angle||0,c=Math.cos(angle),s=Math.sin(angle),rx=a.r*Math.hypot(1.75*c,1.25*s),ry=a.r*Math.hypot(1.75*s,1.25*c);return{x:a.x-rx,y:a.y-ry,w:rx*2,h:ry*2};}
  function segmentCircle(a,b,c,r){
    if(!finite(a)||!finite(b)||!finite(c)||!Number.isFinite(r)||r<=0)return 0;
    const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);if(len<.5)return 0;
    const fx=a.x-c.x,fy=a.y-c.y,A=dx*dx+dy*dy,B=2*(fx*dx+fy*dy),C=fx*fx+fy*fy-r*r,D=B*B-4*A*C;
    if(D<0)return 0;const s=Math.sqrt(D),lo=Math.max(0,(-B-s)/(2*A)),hi=Math.min(1,(-B+s)/(2*A));return hi>lo?(hi-lo)*len:0;
  }
  class Game{
    constructor(width,height,{level=1,random=Math.random}={}){
      this.config=settings(level);this.random=random;this.width=Math.max(160,Number(width)||390);this.height=Math.max(130,Number(height)||500);this.elapsed=0;this.phase='ants';this.paused=false;this.done=false;this.hits=0;this.taps=0;this.serial=0;this.ants=[];this.splats=[];this.particles=[];this.events=[];this.boss=null;this.spawnIn=0;this.wave=0;this.waveHits=0;this.wavePause=0;this.combo=0;this.bestCombo=0;this.lastSquish=-10;this.foodWiggle=0;this.crumbsRecovered=0;
    }
    get radius(){return clamp(Math.min(this.width,this.height)*.09,24,38);}
    get capacity(){return Math.max(2,Math.min(this.config.maxAnts,Math.floor(this.width*this.height/(this.radius*this.radius*24))));}
    get food(){const r=clamp(Math.min(this.width*.18,this.height*.24),30,104);return{x:this.width/2,y:this.height-r*1.05-5,r};}
    get bossY(){const r=this.boss?.r||0;return clamp(this.height*.41,r*1.25,this.height-r*1.25);}
    emit(type,data={}){this.events.push({type,...data});}
    drain(){return this.events.splice(0);}
    spawn(){
      if(this.phase!=='ants'||this.ants.length>=this.capacity)return false;
      const id=this.serial+1,armoured=id%this.config.armourEvery===0,r=this.radius*(armoured?1.2:1),food=this.food;
      let x,y,edge;
      for(let attempt=0;attempt<10;attempt++){
        edge=Math.floor(this.random()*3);x=edge===0?r*2+this.random()*Math.max(0,this.width-r*4):edge===1?-r*2:this.width+r*2;y=edge===0?-r*2:r*1.4+this.random()*Math.max(0,this.height*.53-r*2.8);
        if(!this.ants.some(a=>Math.hypot(a.x-x,a.y-y)<(a.r+r)*1.75))break;
        if(attempt===9)return false;
      }
      this.serial=id;const targetX=food.x+(this.random()-.5)*food.r*.8,targetY=food.y,dx=targetX-x,dy=targetY-y,travel=Math.hypot(dx,dy),speed=travel/(this.config.approachSeconds-this.wave*.5)*(.94+this.random()*.16)*(armoured?.8:1);
      this.ants.push({id,colour:Math.floor(this.random()*colours.length),x,y,r,angle:Math.atan2(dy,dx),entryX:x,entryY:y,targetX,targetY,speed,armoured,hp:armoured?this.config.armourHp:1,maxHp:armoured?this.config.armourHp:1,walk:this.random()*8,recoil:0,stun:0,lastTap:-10,returning:false,crumb:false});return true;
    }
    splash(x,y,r,colour,big=false){
      this.splats.push({x,y,r,colour,life:big?12:5,rotation:this.random()*6.28,seed:Math.floor(this.random()*10000),big});this.splats=this.splats.slice(-22);
      const count=big?90:17;for(let i=0;i<count;i++){const angle=this.random()*Math.PI*2,speed=(big?70:40)+this.random()*(big?300:140);this.particles.push({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed-(big?60:0),r:(big?4:2)+this.random()*(big?7:5),life:.55+this.random()*.7,colour:big?i%colours.length:colour,star:big&&i%4===0,angle:this.random()*6.28});}this.particles=this.particles.slice(-240);
    }
    chip(x,y,colour=2){for(let i=0;i<8;i++)this.particles.push({x,y,vx:(this.random()-.5)*170,vy:-40-this.random()*100,r:3+this.random()*4,life:.35+this.random()*.3,colour,star:i%3===0,angle:this.random()*6.28});this.particles=this.particles.slice(-240);}
    step(value){
      if(this.paused)return;const dt=clamp(Number(value)||0,0,.05);this.elapsed+=dt;this.foodWiggle=Math.max(0,this.foodWiggle-dt*2.5);
      for(const p of this.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=180*dt;p.life-=dt;p.angle+=dt*2;}this.particles=this.particles.filter(p=>p.life>0);
      for(const p of this.splats)p.life-=dt;this.splats=this.splats.filter(p=>p.life>0);
      if(this.phase==='wave-break'){this.wavePause-=dt;if(this.wavePause<=0){this.wave++;this.waveHits=0;this.phase='ants';this.spawnIn=.12;this.emit('wave-start',{wave:this.wave+1});}}
      if(this.phase==='ants'){
        const food=this.food;
        for(const a of this.ants){
          a.walk+=dt*(a.stun>0?1:12);a.stun=Math.max(0,a.stun-dt);a.recoil=Math.max(0,a.recoil-dt*5);
          const tx=a.returning?a.entryX:a.targetX,ty=a.returning?a.entryY:a.targetY,heading=Math.atan2(ty-a.y,tx-a.x);a.angle=heading+Math.sin(a.walk*.24)*.09;
          if(a.stun===0){a.x+=Math.cos(a.angle)*a.speed*dt;a.y+=Math.sin(a.angle)*a.speed*dt;}
          if(!a.returning&&Math.hypot(a.x-food.x,a.y-food.y)<food.r*.6+a.r*.3){a.returning=true;a.crumb=true;a.speed*=1.14;this.foodWiggle=1;this.emit('food-nibble',{id:a.id});}
        }
        this.ants=this.ants.filter(a=>!a.returning||Math.hypot(a.x-a.entryX,a.y-a.entryY)>a.r*.7);this.spawnIn-=dt;
        if(this.spawnIn<=0){const spawned=this.spawn();this.spawnIn=spawned?this.config.spawnSeconds-this.wave*.08+this.random()*.16:.12;}
      }
      if(this.boss){const b=this.boss;b.recoil=Math.max(0,b.recoil-dt*4);b.wiggle+=dt*3;b.enter=Math.min(1,b.enter+dt*.7);b.x=this.width/2-(1-b.enter)**3*(this.width/2+b.r*3);b.y=this.bossY+Math.sin(b.wiggle*.5)*Math.min(8,this.height*.025);if(this.phase==='boss-enter'&&b.enter===1){this.phase='boss';this.emit('boss-ready',{boss:b.type});}}
    }
    finishWave(){
      if(this.wave===this.config.waves.length-1){this.beginBoss();return;}
      this.phase='wave-break';this.wavePause=1.65;this.ants=[];this.emit('wave-clear',{wave:this.wave+1,nextWave:this.wave+2});
    }
    beginBoss(){
      if(this.boss)return;this.ants=[];this.phase='boss-enter';const type=this.config.boss,r=Math.min(this.width*.205,this.height*.22,104),hp=type==='acorn'?this.config.claspHp:this.config.bubbleHp;
      this.boss={id:'boss',type,x:-r*3,y:this.height*.41,r,enter:0,wiggle:0,recoil:0,stage:'shield',parts:[hp,hp,hp],maxPartHp:hp,hp:this.config.bodyHp,maxHp:this.config.bodyHp,tickle:0,tickleGoal:r*(3.4+this.config.level*.12),lastTap:-10};this.emit('boss-enter',{boss:type});
    }
    parts(){const b=this.boss;if(!b||b.stage!=='shield'||b.type==='tickle')return[];return b.parts.map((hp,i)=>({id:'part-'+i,index:i,x:b.x+(i-1)*Math.max(48,b.r*1.25),y:b.y+(b.type==='bubble'?(i-1)*b.r*.26:-b.r*.15),r:Math.max(22,b.r*(b.type==='bubble'?.49:.32)),hp})).filter(p=>p.hp>0);}
    openShell(){const b=this.boss;if(!b||b.stage!=='shield')return;b.stage='body';b.recoil=1;this.chip(b.x,b.y,3);this.emit('shell-open',{boss:b.type});}
    hitPart(index){const b=this.boss;if(this.paused||this.done||!b||this.phase!=='boss'||b.stage!=='shield'||!b.parts[index])return false;const p=this.parts().find(p=>p.index===index);if(!p)return false;b.parts[index]--;b.recoil=.45;this.chip(p.x,p.y,b.type==='bubble'?1:2);this.emit(b.type==='bubble'?'bubble-pop':'clasp-pop',{index,left:b.parts[index]});if(b.parts.every(hp=>hp===0))this.openShell();return true;}
    hitBody(){const b=this.boss;if(this.paused||this.done||!b||this.phase!=='boss'||b.stage!=='body'||this.elapsed-b.lastTap<.09)return false;b.lastTap=this.elapsed;b.hp--;b.recoil=1;this.chip(b.x,b.y,4);this.emit('boss-hit',{left:b.hp});if(b.hp===0){this.phase='done';this.done=true;b.stage='splash';this.splash(b.x,b.y,b.r*1.8,4,true);this.emit('won',{level:this.config.level});}return true;}
    hitAnt(a){
        if(this.paused||this.done||this.phase!=='ants'||!a||!this.ants.includes(a)||this.elapsed-a.lastTap<.09)return false;
        const bounds=antBounds(a);if(bounds.x+bounds.w<=0||bounds.y+bounds.h<=0||bounds.x>=this.width||bounds.y>=this.height)return false;
        a.lastTap=this.elapsed;a.hp--;a.recoil=1;a.stun=.42;
        if(a.hp>0){this.chip(a.x,a.y,2);this.emit('armour-hit',{id:a.id,left:a.hp});return true;}
        this.ants=this.ants.filter(n=>n!==a);this.hits++;this.waveHits++;this.combo=this.elapsed-this.lastSquish<1.3?this.combo+1:1;this.bestCombo=Math.max(this.bestCombo,this.combo);this.lastSquish=this.elapsed;
        this.splash(a.x,a.y,a.r*1.45,a.colour);this.emit('squish',{id:a.id,colour:a.colour,armoured:a.armoured});
        if(a.crumb){this.crumbsRecovered++;this.foodWiggle=1;this.chip(this.food.x,this.food.y,2);this.emit('food-saved');}
        if(this.combo>=3&&this.combo%3===0){this.chip(a.x,a.y,2);this.emit('combo',{combo:this.combo});}
        if(this.waveHits>=this.config.waves[this.wave])this.finishWave();return true;
    }
    tap(p){
      if(this.paused||this.done||!finite(p)||p.x<0||p.y<0||p.x>this.width||p.y>this.height)return false;this.taps++;
      if(this.phase==='ants')return this.hitAnt([...this.ants].reverse().find(a=>antContains(p,a)));
      if(this.phase==='boss'){
        const b=this.boss;if(b.stage==='shield'&&b.type!=='tickle'){const part=this.parts().find(c=>ellipse(p,c,c.r,c.r));if(part)return this.hitPart(part.index);}
        if(ellipse(p,b,b.r*1.6,b.r*1.15)){b.recoil=.45;if(b.stage==='body')return this.hitBody();this.emit('wiggle',{boss:b.type});}
      }return false;
    }
    stroke(a,b){
      if(this.paused||this.done||this.phase!=='boss'||!finite(a)||!finite(b))return false;const boss=this.boss;if(boss.stage!=='shield')return false;
      if(boss.type==='bubble'){let hit=false;for(const p of this.parts())if(segmentCircle(a,b,p,p.r)>0)hit=this.hitPart(p.index)||hit;return hit;}
      if(boss.type!=='tickle')return false;const distance=segmentCircle(a,b,{x:boss.x-boss.r*.2,y:boss.y},boss.r*.9);if(distance<=0)return false;boss.tickle=Math.min(boss.tickleGoal,boss.tickle+distance);boss.recoil=.4;this.emit('tickle',{progress:boss.tickle/boss.tickleGoal});if(boss.tickle>=boss.tickleGoal)this.openShell();return true;
    }
    accessible(id){
      if(this.paused||this.done)return false;const a=this.ants.find(a=>String(a.id)===String(id));if(a){this.taps++;return this.hitAnt(a);}
      if(id==='boss-body')return this.tap({x:this.boss?.x,y:this.boss?.y});if(/^part-[0-2]$/.test(id))return this.hitPart(Number(id.at(-1)));
      if(id==='tickle-belly'&&this.phase==='boss'&&this.boss.type==='tickle'&&this.boss.stage==='shield'){const b=this.boss;return this.stroke({x:b.x-b.r*.7,y:b.y},{x:b.x+b.r*.7,y:b.y});}return false;
    }
    resize(width,height){
      if(!Number.isFinite(width)||!Number.isFinite(height)||width<160||height<130)return;const oldFood=this.food,sx=width/this.width,sy=height/this.height;this.width=width;this.height=height;const food=this.food;
      for(const a of this.ants){a.x*=sx;a.y*=sy;a.entryX*=sx;a.entryY*=sy;a.targetX=food.x+(a.targetX-oldFood.x)/oldFood.r*food.r;a.targetY=food.y;a.r=this.radius*(a.armoured?1.2:1);a.speed*=Math.sqrt(sx*sy);}
      for(const p of [...this.splats,...this.particles]){p.x*=sx;p.y*=sy;}
      if(this.boss){const b=this.boss,progress=b.tickle/b.tickleGoal;b.r=Math.min(width*.205,height*.22,104);b.tickleGoal=b.r*(3.4+this.config.level*.12);b.tickle=b.tickleGoal*progress;b.x=width/2-(1-b.enter)**3*(width/2+b.r*3);b.y=this.bossY;}
    }
  }
  return{Game,settings,colours,bosses,ellipse,antContains,antBounds,segmentCircle};
});
