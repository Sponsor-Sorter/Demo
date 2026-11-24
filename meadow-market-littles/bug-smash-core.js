/* Original paint-ant game. Pure rules/geometry; no storage, timers, audio or DOM.
   The user explicitly requested no hints: all ants are valid targets and misses stay free. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.meadowBugSmashCore=factory();})(globalThis,()=>{
  'use strict';
  const colours=[['coral','#f46869','#b92549'],['blue','#54bbf4','#2464bd'],['yellow','#ffda4b','#c18a12'],['green','#8cd953','#398b39'],['purple','#bf8bef','#7548b9'],['orange','#ffab47','#cf5f24']];
  const bosses=['acorn','bubble','tickle'];
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),finite=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
  function settings(level=1){const n=clamp(Math.floor(Number(level)||1),1,12);return{level:n,goal:8+Math.min(10,Math.floor((n-1)/2)*2),maxAnts:Math.min(6,3+Math.floor(n/3)),speed:28+n*4,armourHp:Math.min(4,2+Math.floor((n-1)/4)),armourEvery:n<4?4:n<8?3:2,boss:bosses[(n-1)%3],claspHp:n>=7?2:1,bubbleHp:n>=8?2:1,bodyHp:3+Math.min(3,Math.floor((n-1)/3))};}
  function ellipse(p,c,rx,ry){return finite(p)&&rx>0&&ry>0&&((p.x-c.x)/rx)**2+((p.y-c.y)/ry)**2<=1;}
  function segmentCircle(a,b,c,r){
    if(!finite(a)||!finite(b)||!finite(c)||!Number.isFinite(r)||r<=0)return 0;
    const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);if(len<.5)return 0;
    const fx=a.x-c.x,fy=a.y-c.y,A=dx*dx+dy*dy,B=2*(fx*dx+fy*dy),C=fx*fx+fy*fy-r*r,D=B*B-4*A*C;
    if(D<0)return 0;const s=Math.sqrt(D),lo=Math.max(0,(-B-s)/(2*A)),hi=Math.min(1,(-B+s)/(2*A));return hi>lo?(hi-lo)*len:0;
  }
  class Game{
    constructor(width,height,{level=1,random=Math.random}={}){
      this.config=settings(level);this.random=random;this.width=Math.max(160,Number(width)||390);this.height=Math.max(130,Number(height)||500);this.elapsed=0;this.phase='ants';this.paused=false;this.done=false;this.hits=0;this.taps=0;this.serial=0;this.ants=[];this.splats=[];this.particles=[];this.events=[];this.boss=null;this.spawnIn=0;
    }
    get radius(){return clamp(Math.min(this.width,this.height)*.09,24,38);}
    get capacity(){return Math.max(2,Math.min(this.config.maxAnts,Math.floor(this.height/(this.radius*2.8))+1));}
    emit(type,data={}){this.events.push({type,...data});}
    drain(){return this.events.splice(0);}
    spawn(){
      if(this.phase!=='ants'||this.ants.length>=this.capacity)return;
      const id=++this.serial,armoured=id%this.config.armourEvery===0,r=this.radius*(armoured?1.2:1),lanes=Math.max(1,Math.floor(this.height/(r*2.8))),lane=(id-1)%lanes,dir=id%2?1:-1;
      const y=clamp((lane+.5)*this.height/lanes,r*1.25,this.height-r*1.25),x=dir===1?-r*2:this.width+r*2;
      if(this.ants.some(a=>Math.hypot(a.x-x,a.y-y)<r*3.2))return;
      this.ants.push({id,colour:(id+Math.floor(this.random()*colours.length))%colours.length,x,y,baseY:y,r,dir,speed:this.config.speed*(.82+this.random()*.3)*(armoured?.72:1),armoured,hp:armoured?this.config.armourHp:1,maxHp:armoured?this.config.armourHp:1,walk:this.random()*8,recoil:0,stun:0,lastTap:-10});
    }
    splash(x,y,r,colour,big=false){
      this.splats.push({x,y,r,colour,life:big?12:8,rotation:this.random()*6.28,seed:Math.floor(this.random()*10000),big});this.splats=this.splats.slice(-22);
      const count=big?90:17;for(let i=0;i<count;i++){const angle=this.random()*Math.PI*2,speed=(big?70:40)+this.random()*(big?300:140);this.particles.push({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed-(big?60:0),r:(big?4:2)+this.random()*(big?7:5),life:.55+this.random()*.7,colour:big?i%colours.length:colour,star:big&&i%4===0,angle:this.random()*6.28});}this.particles=this.particles.slice(-240);
    }
    chip(x,y,colour=2){for(let i=0;i<8;i++)this.particles.push({x,y,vx:(this.random()-.5)*170,vy:-40-this.random()*100,r:3+this.random()*4,life:.35+this.random()*.3,colour,star:i%3===0,angle:this.random()*6.28});this.particles=this.particles.slice(-240);}
    step(value){
      if(this.paused)return;const dt=clamp(Number(value)||0,0,.05);this.elapsed+=dt;
      for(const p of this.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=180*dt;p.life-=dt;p.angle+=dt*2;}this.particles=this.particles.filter(p=>p.life>0);
      for(const p of this.splats)p.life-=dt;this.splats=this.splats.filter(p=>p.life>0);
      if(this.phase==='ants'){
        for(const a of this.ants){a.walk+=dt*(a.stun>0?1:9);a.stun=Math.max(0,a.stun-dt);a.recoil=Math.max(0,a.recoil-dt*5);if(a.stun===0)a.x+=a.dir*a.speed*dt;a.y=a.baseY+Math.sin(a.walk*.18)*Math.min(9,this.height*.02);}
        this.ants=this.ants.filter(a=>a.x>-a.r*3&&a.x<this.width+a.r*3);this.spawnIn-=dt;if(this.spawnIn<=0){this.spawn();this.spawnIn=.5+this.random()*.4;}
      }
      if(this.boss){const b=this.boss;b.recoil=Math.max(0,b.recoil-dt*4);b.wiggle+=dt*3;b.enter=Math.min(1,b.enter+dt*.7);b.x=this.width/2-(1-b.enter)**3*(this.width/2+b.r*3);b.y=this.height/2+Math.sin(b.wiggle*.5)*Math.min(8,this.height*.025);if(this.phase==='boss-enter'&&b.enter===1){this.phase='boss';this.emit('boss-ready',{boss:b.type});}}
    }
    beginBoss(){
      if(this.boss)return;this.ants=[];this.phase='boss-enter';const type=this.config.boss,r=Math.min(this.width*.205,this.height*.255,104),hp=type==='acorn'?this.config.claspHp:this.config.bubbleHp;
      this.boss={id:'boss',type,x:-r*3,y:this.height/2,r,enter:0,wiggle:0,recoil:0,stage:'shield',parts:[hp,hp,hp],maxPartHp:hp,hp:this.config.bodyHp,maxHp:this.config.bodyHp,tickle:0,tickleGoal:r*(3.4+this.config.level*.12),lastTap:-10};this.emit('boss-enter',{boss:type});
    }
    parts(){const b=this.boss;if(!b||b.stage!=='shield'||b.type==='tickle')return[];return b.parts.map((hp,i)=>({id:'part-'+i,index:i,x:b.x+(i-1)*Math.max(48,b.r*1.25),y:b.y+(b.type==='bubble'?(i-1)*b.r*.26:-b.r*.15),r:Math.max(22,b.r*(b.type==='bubble'?.49:.32)),hp})).filter(p=>p.hp>0);}
    openShell(){const b=this.boss;if(!b||b.stage!=='shield')return;b.stage='body';b.recoil=1;this.chip(b.x,b.y,3);this.emit('shell-open',{boss:b.type});}
    hitPart(index){const b=this.boss;if(this.paused||this.done||!b||this.phase!=='boss'||b.stage!=='shield'||!b.parts[index])return false;const p=this.parts().find(p=>p.index===index);if(!p)return false;b.parts[index]--;b.recoil=.45;this.chip(p.x,p.y,b.type==='bubble'?1:2);this.emit(b.type==='bubble'?'bubble-pop':'clasp-pop',{index,left:b.parts[index]});if(b.parts.every(hp=>hp===0))this.openShell();return true;}
    hitBody(){const b=this.boss;if(this.paused||this.done||!b||this.phase!=='boss'||b.stage!=='body'||this.elapsed-b.lastTap<.09)return false;b.lastTap=this.elapsed;b.hp--;b.recoil=1;this.chip(b.x+b.r*.4,b.y,4);this.emit('boss-hit',{left:b.hp});if(b.hp===0){this.phase='done';this.done=true;b.stage='splash';this.splash(b.x,b.y,b.r*1.8,4,true);this.emit('won',{level:this.config.level});}return true;}
    tap(p){
      if(this.paused||this.done||!finite(p)||p.x<0||p.y<0||p.x>this.width||p.y>this.height)return false;
      this.taps++;
      if(this.phase==='ants'){
        const a=[...this.ants].reverse().find(a=>ellipse(p,a,a.r*1.75,a.r*1.25));if(!a||this.elapsed-a.lastTap<.09)return false;a.lastTap=this.elapsed;a.hp--;a.recoil=1;a.stun=.4;
        if(a.hp>0){this.chip(a.x,a.y,2);this.emit('armour-hit',{id:a.id,left:a.hp});return true;}
        this.ants=this.ants.filter(n=>n!==a);this.hits++;this.splash(a.x,a.y,a.r*1.45,a.colour);this.emit('squish',{id:a.id,colour:a.colour,armoured:a.armoured});if(this.hits>=this.config.goal)this.beginBoss();return true;
      }
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
      if(this.paused||this.done)return false;const a=this.ants.find(a=>String(a.id)===String(id));if(a)return this.tap(a);
      if(id==='boss-body')return this.tap({x:this.boss?.x,y:this.boss?.y});
      if(/^part-[0-2]$/.test(id))return this.hitPart(Number(id.at(-1)));
      if(id==='tickle-belly'&&this.phase==='boss'&&this.boss.type==='tickle'&&this.boss.stage==='shield'){const b=this.boss;return this.stroke({x:b.x-b.r*.7,y:b.y},{x:b.x+b.r*.7,y:b.y});}return false;
    }
    resize(width,height){
      if(!Number.isFinite(width)||!Number.isFinite(height)||width<160||height<130)return;const sx=width/this.width,sy=height/this.height;this.width=width;this.height=height;
      for(const a of this.ants){a.x*=sx;a.y*=sy;a.baseY*=sy;a.r=this.radius*(a.armoured?1.2:1);a.baseY=clamp(a.baseY,a.r*1.25,height-a.r*1.25);}
      for(const p of [...this.splats,...this.particles]){p.x*=sx;p.y*=sy;}
      if(this.boss){const b=this.boss,progress=b.tickle/b.tickleGoal;b.r=Math.min(width*.205,height*.255,104);b.tickleGoal=b.r*(3.4+this.config.level*.12);b.tickle=b.tickleGoal*progress;b.x=width/2-(1-b.enter)**3*(width/2+b.r*3);b.y=height/2;}
    }
  }
  return{Game,settings,colours,bosses,ellipse,segmentCircle};
});
