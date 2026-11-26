/* Original articulated ant artwork. Six animated legs, glossy bodies and tactile farm armour. */
(() => {
  'use strict';
  const palette=globalThis.meadowBugPicnicCore.colours;
  function oval(c,x,y,rx,ry,fill,stroke,width=1){c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
  function shine(c,x,y,rx,ry,light,base,dark){const g=c.createRadialGradient(x-rx*.33,y-ry*.4,rx*.07,x,y,rx*1.3);g.addColorStop(0,light);g.addColorStop(.4,base);g.addColorStop(1,dark);oval(c,x,y,rx,ry,g,dark,Math.max(1.5,rx*.055));c.save();c.globalAlpha=.42;oval(c,x-rx*.3,y-ry*.42,rx*.29,ry*.14,'#ffffff');c.restore();}
  function star(c,x,y,r,colour,rotation=0){c.save();c.translate(x,y);c.rotate(rotation);c.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,k=i%2?r*.44:r;i?c.lineTo(Math.cos(a)*k,Math.sin(a)*k):c.moveTo(Math.cos(a)*k,Math.sin(a)*k);}c.closePath();c.fillStyle=colour;c.fill();c.restore();}
  function ant(c,a,time,{boss=false,type='',stage=''}={}){
    const r=a.r,p=palette[a.colour??({acorn:3,bubble:4,tickle:5}[type]||0)],walk=a.walk??time*8,recoil=a.recoil||0;
    c.save();c.translate(a.x,a.y);oval(c,0,r*.15,r*1.65,r*.62,'rgba(68,43,14,.18)');c.rotate(a.angle??(a.dir<0?Math.PI:0));c.translate(0,Math.sin(walk*2)*r*.035);c.scale(1+recoil*.08,1-recoil*.14);
    // Alternating tripod gait: every leg has a hip, a knee and a planted foot.
    for(const side of [-1,1])for(let i=0;i<3;i++){
      const hip=(-.65+i*.56)*r,stride=Math.sin(walk+i*Math.PI*.8+(side===1?Math.PI:0))*r*.32,kneeX=hip-r*.18+stride*.45,kneeY=side*r*.77,footX=hip+stride,footY=side*r*1.13;
      c.lineCap='round';c.lineJoin='round';c.beginPath();c.moveTo(hip,side*r*.23);c.lineTo(kneeX,kneeY);c.lineTo(footX,footY);c.strokeStyle=p[2];c.lineWidth=r*.2;c.stroke();c.strokeStyle=p[1];c.lineWidth=r*.12;c.stroke();oval(c,footX,footY,r*.11,r*.075,p[2]);
    }
    shine(c,-r*.83,0,r*.88,r*.72,'#fff9cc',p[1],p[2]);shine(c,-r*.02,0,r*.51,r*.51,'#fff9dd',p[1],p[2]);
    if(a.armoured||boss&&type==='acorn'&&stage==='shield'){
      const g=c.createLinearGradient(-r,-r,r,r);g.addColorStop(0,'#c0e874');g.addColorStop(.45,'#81b93d');g.addColorStop(1,'#356d2c');oval(c,-r*.55,0,r*.99,r*.79,g,'#385e26',r*.06);
      c.strokeStyle='#d7f090';c.lineWidth=r*.045;c.beginPath();c.moveTo(-r*1.44,0);c.quadraticCurveTo(-r*.45,-r*.2,r*.32,0);c.stroke();
      for(const y of [-.35,.35]){c.beginPath();c.moveTo(-r*.85,0);c.lineTo(-r*.55,y*r);c.moveTo(-r*.4,0);c.lineTo(-r*.12,y*r);c.stroke();}
      c.strokeStyle='#9b6230';c.lineWidth=r*.14;c.beginPath();c.moveTo(-r*.55,-r*.77);c.lineTo(-r*.55,r*.77);c.stroke();
      if(!boss)for(const y of [-.48,.48])shine(c,-r*.55,y*r,r*.13,r*.16,'#fff3aa','#e9b143','#996120');
      if(!boss&&a.hp<a.maxHp){c.strokeStyle='#fff1b4';c.lineWidth=r*.075;c.beginPath();c.moveTo(-r*1.2,-r*.3);c.lineTo(-r*.9,-r*.08);c.lineTo(-r*1.03,r*.15);c.lineTo(-r*.66,r*.42);c.stroke();if(a.maxHp-a.hp>1){c.beginPath();c.moveTo(-r*.1,-r*.6);c.lineTo(-r*.3,-r*.27);c.lineTo(-r*.08,-r*.03);c.stroke();}}
    }
    shine(c,r*.87,0,r*.7,r*.63,'#fff9dc',p[1],p[2]);
    c.lineCap='round';c.strokeStyle=p[2];c.lineWidth=r*.085;
    for(const side of [-1,1]){c.beginPath();c.moveTo(r*1.17,side*r*.37);c.quadraticCurveTo(r*1.53,side*r*.84,r*1.83,side*r*.65);c.stroke();shine(c,r*1.83,side*r*.65,r*.075,r*.075,'#ffffff',p[1],p[2]);}
    const blinking=Math.sin(time*1.15+(a.id==='boss'?2:Number(a.id)))>.991;
    for(const side of [-1,1]){const x=r*1.01,y=side*r*.24;if(blinking){c.strokeStyle=p[2];c.lineWidth=r*.07;c.beginPath();c.moveTo(x-r*.13,y);c.quadraticCurveTo(x,y-r*.07,x+r*.13,y);c.stroke();}else{oval(c,x,y,r*.205,r*.18,'#fffdf2',p[2],r*.035);oval(c,x+r*.055,y,r*.105,r*.125,'#38281f');oval(c,x+r*.09,y-r*.045,r*.036,r*.036,'#ffffff');}}
    c.strokeStyle='#653324';c.lineWidth=r*.055;c.beginPath();c.moveTo(r*1.4,-r*.11);c.quadraticCurveTo(r*1.65,0,r*1.4,r*.13);c.stroke();
    c.save();c.globalAlpha=.5;oval(c,r*1.23,-r*.4,r*.13,r*.075,'#ffbaa7');oval(c,r*1.23,r*.4,r*.13,r*.075,'#ffbaa7');c.restore();
    if(boss){
      if(type==='acorn'){c.save();c.translate(r*.75,-r*.52);c.rotate(-.18);oval(c,0,0,r*.48,r*.22,'#b67d37','#805027',r*.04);for(let i=-2;i<=2;i++){c.strokeStyle='#e5b86b';c.lineWidth=r*.035;c.beginPath();c.moveTo(i*r*.14,-r*.14);c.lineTo(i*r*.14+r*.12,r*.08);c.stroke();}c.strokeStyle='#805027';c.lineWidth=r*.09;c.beginPath();c.moveTo(-r*.12,-r*.15);c.lineTo(-r*.22,-r*.37);c.stroke();c.restore();}
      if(type==='tickle'&&stage==='shield'){const pulse=1+Math.sin(time*5)*.045;oval(c,-r*.2,0,r*.75*pulse,r*.63*pulse,'#ffcf9d','#e48249',r*.055);c.strokeStyle='#fff8d4';c.lineWidth=r*.05;for(const x of [-.42,0,.42]){c.beginPath();c.arc((- .2+x)*r,0,r*.12,-1,1);c.stroke();}}
    }
    if(!boss&&a.armoured){for(let i=0;i<a.maxHp;i++)oval(c,(-a.maxHp*.14+i*.28)*r,-r*1.4,r*.085,r*.085,i<a.hp?'#fff4b1':'#9c8b66','#745129',r*.025);}
    if(a.crumb)shine(c,r*1.65,0,r*.22,r*.16,'#fff8cc','#efc87a','#b67f32');
    c.restore();
  }
  function acorn(c,p,time,maxHp){
    const r=p.r,pulse=1+Math.sin(time*4+p.index)*.045;c.save();c.translate(p.x,p.y);c.scale(pulse,pulse);c.shadowColor='#fff59b';c.shadowBlur=12;oval(c,0,0,r*.95,r*.95,'rgba(255,242,156,.24)');c.shadowBlur=0;shine(c,0,r*.09,r*.62,r*.73,'#fff4ac',p.hp===maxHp?'#e5b34b':'#eccc6b','#a46c2d');oval(c,0,-r*.4,r*.74,r*.3,'#b77f34','#80562a',2);c.strokeStyle='#e7c378';c.lineWidth=2;for(let i=-1;i<=1;i++){c.beginPath();c.moveTo(i*r*.28-r*.1,-r*.52);c.lineTo(i*r*.28+r*.12,-r*.24);c.stroke();}c.strokeStyle='#80562a';c.lineWidth=5;c.lineCap='round';c.beginPath();c.moveTo(0,-r*.62);c.lineTo(r*.14,-r*.84);c.stroke();if(p.hp<maxHp){c.strokeStyle='#fff8d4';c.lineWidth=3;c.beginPath();c.moveTo(-r*.2,0);c.lineTo(r*.1,r*.17);c.lineTo(-r*.05,r*.44);c.stroke();}c.restore();
  }
  function bubble(c,p,time){const r=p.r*(1+Math.sin(time*2+p.index)*.035);c.save();c.translate(p.x,p.y);const g=c.createRadialGradient(-r*.3,-r*.4,r*.05,0,0,r);g.addColorStop(0,'rgba(255,255,255,.7)');g.addColorStop(.24,'rgba(232,247,255,.08)');g.addColorStop(.76,'rgba(183,213,255,.18)');g.addColorStop(1,'rgba(255,188,226,.72)');oval(c,0,0,r,r,g,'#fff9ef',2.7);c.lineWidth=3;c.strokeStyle='#b7e6ff';c.beginPath();c.arc(0,0,r*.9,.2,2.5);c.stroke();c.strokeStyle='#fffef4';c.lineWidth=4.5;c.lineCap='round';c.beginPath();c.arc(-r*.05,-r*.04,r*.69,3.65,4.62);c.stroke();oval(c,r*.37,-r*.47,r*.13,r*.08,'#fffdf9');if(p.hp>1)oval(c,0,0,r*.68,r*.68,'rgba(255,255,255,.02)','rgba(255,255,255,.55)',1.5);c.restore();}
  function splat(c,p){
    c.save();c.translate(p.x,p.y);c.rotate(p.rotation);c.globalAlpha=Math.min(1,p.life/1.7)*.9;
    if(p.big){for(let i=0;i<6;i++){const a=i*Math.PI/3;c.save();c.rotate(a);oval(c,p.r*.48,0,p.r*.8,p.r*.27,palette[i][1],palette[i][2],1.5);c.restore();}oval(c,0,0,p.r*.32,p.r*.32,'#fff39c');}
    else{const seed=p.seed; c.beginPath();for(let i=0;i<40;i++){const a=i*Math.PI/20,r=p.r*(.67+.18*Math.sin(i*2.3+seed)+.12*Math.cos(i*1.7+seed));i?c.lineTo(Math.cos(a)*r,Math.sin(a)*r*.7):c.moveTo(Math.cos(a)*r,Math.sin(a)*r*.7);}c.closePath();c.fillStyle=palette[p.colour][1];c.fill();c.strokeStyle=palette[p.colour][2];c.lineWidth=1.5;c.stroke();c.globalAlpha*=.6;oval(c,-p.r*.15,-p.r*.13,p.r*.3,p.r*.07,'#fffce8');}c.restore();
  }
  function draw(c,game,{food}={}){
    c.clearRect(0,0,game.width,game.height);if(food){const f=game.food,w=f.r*2.65,h=w*food.height/food.width;c.save();c.translate(f.x,f.y);c.rotate(Math.sin(game.elapsed*14)*game.foodWiggle*.035);c.drawImage(food,-w/2,-h/2,w,h);c.restore();}for(const p of game.splats)splat(c,p);for(const a of game.ants)ant(c,a,game.elapsed);
    if(game.boss&&game.boss.stage!=='splash'){
      const b=game.boss;c.save();c.globalAlpha=.15+Math.sin(game.elapsed*3)*.025;oval(c,b.x,b.y,b.r*1.9,b.r*1.35,'#fff6b7');c.restore();ant(c,{...b,colour:{acorn:3,bubble:4,tickle:5}[b.type]},game.elapsed,{boss:true,type:b.type,stage:b.stage});
      for(const p of game.parts())b.type==='acorn'?acorn(c,p,game.elapsed,b.maxPartHp):bubble(c,p,game.elapsed);
      if(b.type==='tickle'&&b.stage==='shield'){const progress=b.tickle/b.tickleGoal;c.strokeStyle='rgba(107,75,40,.45)';c.lineWidth=10;c.lineCap='round';c.beginPath();c.arc(b.x-b.r*.2,b.y,b.r*.79,-Math.PI/2,Math.PI*1.5);c.stroke();if(progress>0){c.strokeStyle='#fff59a';c.beginPath();c.arc(b.x-b.r*.2,b.y,b.r*.79,-Math.PI/2,-Math.PI/2+Math.PI*2*progress);c.stroke();}}
    }
    for(const p of game.particles){c.save();c.globalAlpha=Math.min(1,p.life*2.8);if(p.star)star(c,p.x,p.y,p.r*1.45,'#fff39b',p.angle);else oval(c,p.x,p.y,p.r,p.r*.8,palette[p.colour][1]);c.restore();}
  }
  globalThis.meadowBugPicnicPaint={draw};
})();
