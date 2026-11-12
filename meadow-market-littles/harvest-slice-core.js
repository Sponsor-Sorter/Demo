/* Screen-sized, time-based tossing and continuous swipe collision. No missed-fruit penalty. */
(() => {
  'use strict';
  const types=[['apple','Apple','#ed6359'],['orange','Orange','#ffb438'],['watermelon','Watermelon','#fa7182'],['carrot','Carrot','#ff9240'],['cucumber','Cucumber','#9dce6f'],['pumpkin','Pumpkin','#f6ad43']];
  function segmentHits(a,b,c,r){
    const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
    if(!Number.isFinite(length)||length<.25)return false;
    const t=Math.max(0,Math.min(1,((c.x-a.x)*dx+(c.y-a.y)*dy)/length));
    return (a.x+t*dx-c.x)**2+(a.y+t*dy-c.y)**2<=r*r;
  }
  class Game {
    constructor(width,height,{goal=12,random=Math.random}={}){
      this.random=random;this.width=width;this.height=height;this.goal=goal;
      this.fruit=[];this.pieces=[];this.drops=[];this.hits=0;this.missed=0;
      this.elapsed=0;this.waveIn=.65;this.wave=0;this.serial=0;this.bag=[];this.last=-1;this.done=false;this.paused=false;
    }
    get radius(){return Math.max(34,Math.min(72,Math.min(this.width,this.height)*.125));}
    nextType(){
      if(!this.bag.length){this.bag=types.map((_,i)=>i);for(let i=this.bag.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[this.bag[i],this.bag[j]]=[this.bag[j],this.bag[i]];}if(this.bag[0]===this.last)[this.bag[0],this.bag[1]]=[this.bag[1],this.bag[0]];}
      return this.last=this.bag.shift();
    }
    toss(slot=0,count=1){
      const r=this.radius,w=this.width,h=this.height,g=h*.48;
      const x=count>1?w*(slot? .67:.33):w*(.25+this.random()*.5);
      const apex=Math.max(r*1.4,h*(.22+this.random()*.16));
      const vy=-Math.sqrt(2*g*(h+r-apex)),time=-vy/g;
      const target=Math.max(r*1.3,Math.min(w-r*1.3,x+(this.random()-.5)*w*.3));
      this.fruit.push({id:++this.serial,type:this.nextType(),x,y:h+r,vx:(target-x)/time,vy,r,angle:(this.random()-.5)*.5,spin:(this.random()-.5)*1.4});
    }
    step(seconds){
      if(this.paused)return;
      const dt=Math.max(0,Math.min(.05,Number(seconds)||0));
      if(!this.done){this.elapsed+=dt;this.waveIn-=dt;if(this.waveIn<=0&&this.fruit.length<4){const count=Math.min(4-this.fruit.length,this.wave>0&&this.wave%3===0?2:1);for(let i=0;i<count;i++)this.toss(i,count);this.wave++;this.waveIn=count===2?1.9:1.45;}}
      const g=this.height*.48;
      for(const fruit of this.fruit){fruit.x+=fruit.vx*dt;fruit.y+=fruit.vy*dt;fruit.vy+=g*dt;fruit.angle+=fruit.spin*dt;}
      this.fruit=this.fruit.filter(f=>{if(f.vy>0&&f.y>this.height+f.r*1.4){if(!this.done)this.missed++;return false;}return true;});
      for(const p of this.pieces){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=g*dt;p.angle+=p.spin*dt;p.life-=dt;}
      this.pieces=this.pieces.filter(p=>p.life>0&&p.y<this.height+p.r*3);
      for(const p of this.drops){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=g*.45*dt;p.life-=dt;}
      this.drops=this.drops.filter(p=>p.life>0).slice(-140);
    }
    cut(fruit,a,b){
      const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy)||1,nx=-dy/length,ny=dx/length;
      this.fruit=this.fruit.filter(f=>f.id!==fruit.id);this.hits++;
      for(const side of [-1,1])this.pieces.push({...fruit,x:fruit.x+nx*side*fruit.r*.12,y:fruit.y+ny*side*fruit.r*.12,vx:fruit.vx+nx*side*120,vy:fruit.vy*.32-55+ny*side*90,spin:side*(2.2+this.random()*2),column:side<0?1:2,life:1.6});
      for(let i=0;i<10;i++){const angle=this.random()*Math.PI*2,speed=70+this.random()*150;this.drops.push({x:fruit.x,y:fruit.y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed-50,r:2+this.random()*5,life:.5+this.random()*.45,color:types[fruit.type][2]});}
      if(this.hits>=this.goal)this.done=true;
      return fruit;
    }
    slice(a,b){
      if(this.done||this.paused||![a?.x,a?.y,b?.x,b?.y].every(Number.isFinite))return [];
      const hit=[];
      for(const fruit of [...this.fruit]){
        if(this.done)break;
        if(fruit.y>this.height+fruit.r*.1||fruit.y<0)continue;
        if(segmentHits(a,b,fruit,fruit.r*1.03))hit.push(this.cut(fruit,a,b));
      }
      return hit;
    }
    accessibleCut(id){const f=this.fruit.find(f=>f.id===id);return f?this.slice({x:f.x-f.r*1.2,y:f.y},{x:f.x+f.r*1.2,y:f.y}):[];}
    resize(width,height){
      const sx=width/this.width,sy=height/this.height;this.width=width;this.height=height;
      for(const p of [...this.fruit,...this.pieces,...this.drops]){p.x*=sx;p.y*=sy;p.vx*=sx;p.vy*=sy;if(p.type!==undefined)p.r=this.radius;}
    }
  }
  globalThis.meadowHarvestSliceCore={Game,segmentHits,types};
})();
