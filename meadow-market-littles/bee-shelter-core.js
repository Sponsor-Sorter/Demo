/* Fixed scenery; only the child's ink and the bees are dynamic bodies. */
(() => {
  'use strict';
  const W=600,H=600,INK=12,TERRAIN=1,LINE=2,BEE=4,FRIEND=8;
  const block=(x,y,w,h,kind='rock')=>({x,y,w,h,kind});
  const map=(name,x,terrain,hives,hint,help,shape,cue)=>({name,friend:{x,y:454,r:30},floor:500,
    terrain:[block(300,550,620,100,'ground'),...terrain],hives:hives.map(([x,y])=>({x,y})),
    hint:hint.map(([x,y])=>({x,y})),help,shape,cue,ink:850,bees:24,seconds:8});
  const levels=[
    map('The little cave',240,[block(140,400,60,200),block(245,310,260,35,'ledge'),block(355,485,100,30),block(365,360,20,65),block(410,455,20,90)],[[530,350]],
      [[390,335],[390,460],[335,460]],'Draw a little door, then turn onto the low rock.','left-door'),
    map('The other side',360,[block(470,400,60,200),block(350,310,280,35,'ledge'),block(245,485,100,30),block(220,360,20,65),block(175,455,20,90)],[[70,350]],
      [[195,335],[195,460],[260,460]],'Draw the door on the left. Give it a foot on the rock.','right-door'),
    map('The roof gap',300,[block(130,400,60,200),block(470,400,60,200),block(200,310,180,30,'ledge'),block(420,310,180,30,'ledge')],[[310,160]],
      [[265,280],[270,260],[350,260],[355,280]],'Cap the roof gap with a small curve.','roof-cap'),
    map('The shelf notch',300,[block(150,400,80,200),block(450,400,80,200),block(220,350,100,30,'ledge'),block(380,350,100,30,'ledge')],[[300,180]],
      [[245,305],[245,325],[355,325],[355,305]],'Rest a cup shape in the shelf notch.','notch'),
    map('The rock window',300,[block(130,400,60,200),block(300,310,400,30,'ledge'),block(470,360,40,70),block(470,490,40,20)],[[550,435]],
      [[500,380],[520,380],[520,490],[500,490]],'Close the side window with three sides of a box.','side-window'),
    map('The roof hook',300,[block(300,350,70,50,'ledge')],[[85,220],[515,220]],
      [[220,485],[220,310],[380,310],[380,485]],'Hook a big upside-down cup over the little ledge.','hooked-arch'),
    map('One cosy shelf',300,[block(125,400,60,200),block(200,375,90,30,'ledge')],[[350,160],[520,300]],
      [[170,345],[390,345],[390,485]],'Draw across the shelf, then turn down.','shelf-canopy'),
    map('The meadow steps',300,[block(150,400,60,200),block(245,320,240,40,'ledge'),block(450,450,100,100)],[[520,230]],
      [[330,285],[380,285],[380,385],[450,385]],'Step from the high ledge to the low rock.','steps'),
    map('The garden bowl',300,[block(210,465,80,70),block(390,465,80,70)],[[300,160],[520,230]],
      [[190,415],[245,355],[355,355],[410,415]],'Rest a rainbow roof on the stone rim.','bowl'),
    map('The low tunnel',260,[block(150,435,60,130),block(265,370,280,35,'ledge'),block(375,485,100,30),block(395,415,20,55),block(440,480,20,40)],[[520,390]],
      [[420,400],[420,460],[350,460]],'Draw a short door and a foot on the low rock.','low-door'),
    map('The apple-tree hook',250,[block(250,350,120,50,'ledge')],[[85,200],[510,230]],
      [[175,485],[175,320],[250,285],[325,320],[325,485]],'Draw a pointy roof over the little ledge.','pointed-hook',5),
    map('The side chimney',370,[block(170,400,60,200),block(500,400,60,200),block(245,300,210,30,'ledge'),block(470,300,120,30,'ledge')],[[390,160]],
      [[320,270],[330,245],[430,245],[440,270]],'Cap the little chimney on the right.','offset-chimney',2),
    map('The wide garden cradle',280,[block(160,460,100,80),block(400,460,100,80)],[[280,170],[520,240]],
      [[125,405],[205,340],[355,340],[435,405]],'Rest a broad rainbow roof on the low rocks.','wide-cradle',8),
    map('The left hatch',300,[block(480,400,60,200),block(300,300,420,30,'ledge'),block(130,325,40,70),block(130,455,40,90),block(70,470,40,60)],[[45,380]],
      [[100,345],[80,345],[80,425],[100,425]],'Close the left-hand window with a little box.','left-hatch',4),
    map('The right-hand shelf',300,[block(470,400,60,200),block(400,375,80,30,'ledge')],[[70,180],[130,300]],
      [[430,345],[210,345],[210,485]],'Start at the right shelf. Draw across and down.','right-canopy',6),
    map('The descending ledges',300,[block(480,400,60,200),block(385,300,250,40,'ledge'),block(150,440,100,120)],[[70,230]],
      [[295,265],[220,265],[220,365],[150,365]],'Draw from the high ledge down to the low rock.','descending-step',7),
    map('The deep roof notch',300,[block(130,400,60,200),block(470,400,60,200),block(160,330,140,40,'ledge'),block(440,330,140,40,'ledge'),block(250,380,60,30,'ledge'),block(370,380,60,30,'ledge')],[[300,170]],
      [[255,335],[255,355],[365,355],[365,335]],'Fit a little cup between the roof shelves.','deep-pocket',3),
    map('The stepped bowl',295,[block(160,460,120,80),block(420,475,100,50)],[[300,160],[520,230]],
      [[130,405],[200,345],[350,345],[450,435]],'Rest each end of your roof on a different step.','uneven-rim',8),
    map('The little gate',330,[block(440,420,60,160),block(340,350,260,30,'ledge'),block(220,485,100,30),block(220,395,20,60),block(175,480,20,40)],[[80,400]],
      [[195,375],[195,460],[255,460]],'Give the low opening a door with a little foot.','low-left-gate',1),
    map('The long cosy corner',300,[block(140,400,60,200),block(250,350,60,30,'ledge'),block(470,450,60,100)],[[520,180]],
      [[220,315],[420,315],[420,485]],'Rest your corner on the little shelf.','long-corner',6)
  ];
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  function legalPoint(p,level){return Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=8&&p.x<=592&&p.y>=45&&p.y<level.floor-4&&distance(p,level.friend)>level.friend.r+INK/2+3&&!level.terrain.some(t=>p.x>t.x-t.w/2-2&&p.x<t.x+t.w/2+2&&p.y>t.y-t.h/2-2&&p.y<t.y+t.h/2+2);}
  function legalSegment(a,b,level){const n=Math.max(1,Math.ceil(distance(a,b)/4));for(let i=0;i<=n;i++)if(!legalPoint({x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n},level))return false;return true;}
  function append(points,p,remaining,level){if(!legalPoint(p,level))return {accepted:false,used:0,blocked:true};if(!points.length){points.push({...p});return {accepted:true,used:0};}const a=points.at(-1),d=distance(a,p);if(d<2)return {accepted:false,used:0};const used=Math.min(d,Math.max(0,remaining)),next={x:a.x+(p.x-a.x)*used/d,y:a.y+(p.y-a.y)*used/d};if(!used||!legalSegment(a,next,level))return {accepted:false,used:0,blocked:true};points.push(next);return {accepted:true,used,exhausted:used<d||remaining-used<2};}
  function simplify(points,tolerance=2){if(points.length<=2)return points.slice();const a=points[0],b=points.at(-1),dx=b.x-a.x,dy=b.y-a.y,len=dx*dx+dy*dy;let far=0,index=0;for(let i=1;i<points.length-1;i++){const p=points[i],t=len?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/len)):0,d=Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);if(d>far){far=d;index=i;}}return far>tolerance?[...simplify(points.slice(0,index+1),tolerance).slice(0,-1),...simplify(points.slice(index),tolerance)]:[a,b];}
  function create(levelIndex=0,random=Math.random){
    const M=window.Matter,level=levels[levelIndex%levels.length],engine=M.Engine.create({enableSleeping:false});engine.gravity.y=1;engine.gravity.scale=.00065;engine.positionIterations=8;engine.velocityIterations=8;
    const terrain=level.terrain.map(t=>M.Bodies.rectangle(t.x,t.y,t.w,t.h,{isStatic:true,label:'terrain',friction:.8,collisionFilter:{group:0,category:TERRAIN,mask:LINE|BEE}}));
    const friend=M.Bodies.circle(level.friend.x,level.friend.y,level.friend.r,{isStatic:true,isSensor:true,label:'friend',collisionFilter:{group:0,category:FRIEND,mask:BEE}});M.Composite.add(engine.world,[...terrain,friend]);
    const strokes=[],bees=[];let elapsed=0,spawned=0,state='draw',contacts=0;
    M.Events.on(engine,'collisionStart',event=>{for(const pair of event.pairs){const a=pair.bodyA.parent,b=pair.bodyB.parent;if((a.label==='friend'&&b.label==='bee')||(b.label==='friend'&&a.label==='bee'))contacts++;}});
    function addStroke(points){const clean=simplify(points);if(clean.length<2||clean.reduce((sum,p,i)=>sum+(i?distance(clean[i-1],p):0),0)<12)return null;const parts=[];for(let i=1;i<clean.length;i++){const a=clean[i-1],b=clean[i],length=distance(a,b);if(length<1)continue;parts.push(M.Bodies.rectangle((a.x+b.x)/2,(a.y+b.y)/2,length+4,INK,{angle:Math.atan2(b.y-a.y,b.x-a.x)}));}for(const p of clean)parts.push(M.Bodies.circle(p.x,p.y,INK/2,{},10));const body=M.Body.create({parts,label:'ink',density:.0018,friction:.9,frictionStatic:1.5,frictionAir:.015,restitution:.03,collisionFilter:{group:0,category:LINE,mask:TERRAIN|BEE|LINE}});const stroke={body,points:clean.map(p=>({x:p.x-body.position.x,y:p.y-body.position.y})),length:points.reduce((n,p,i)=>n+(i?distance(points[i-1],p):0),0)};M.Body.setStatic(body,true);M.Composite.add(engine.world,body);strokes.push(stroke);return stroke;}
    function undo(){if(state!=='draw'||!strokes.length)return null;const stroke=strokes.pop();M.Composite.remove(engine.world,stroke.body);return stroke;}
    function launch(){if(state!=='draw'||!strokes.length)return false;state='swarm';for(const s of strokes)M.Body.setStatic(s.body,false);return true;}
    function step(dt=1000/120){if(state!=='swarm')return state;elapsed+=dt;while(spawned<level.bees&&elapsed>=spawned*100){const hive=level.hives[spawned%level.hives.length],angle=random()*Math.PI*2,body=M.Bodies.circle(hive.x+Math.cos(angle)*12,hive.y+Math.sin(angle)*12,8,{label:'bee',density:.003,friction:.03,frictionAir:.02,restitution:.2,collisionFilter:{group:0,category:BEE,mask:TERRAIN|LINE|FRIEND|BEE}});body.beePhase=random()*Math.PI*2;bees.push(body);M.Composite.add(engine.world,body);spawned++;}
      for(const bee of bees){const dx=level.friend.x-bee.position.x,dy=level.friend.y-bee.position.y,d=Math.max(1,Math.hypot(dx,dy)),wave=Math.sin(elapsed/230+bee.beePhase);const target={x:dx/d*2.6+Math.cos(bee.beePhase+elapsed/600)*.9,y:dy/d*2.6+wave*.8};M.Body.setVelocity(bee,{x:bee.velocity.x*.94+target.x*.06,y:bee.velocity.y*.94+target.y*.06});M.Body.applyForce(bee,bee.position,{x:0,y:-bee.mass*engine.gravity.y*engine.gravity.scale});}
      M.Engine.update(engine,dt);if(contacts)state='retry';else if(elapsed>=level.seconds*1000)state='win';return state;}
    function dispose(){M.Events.off(engine);M.Composite.clear(engine.world,false);M.Engine.clear(engine);state='closed';}
    return {level,engine,terrain,friend,strokes,bees,addStroke,undo,launch,step,dispose,get state(){return state;},get elapsed(){return elapsed;},get contacts(){return contacts;}};
  }
  window.meadowBeeCore={levels,create,rules:{legalPoint,legalSegment,append,simplify,distance},INK,W,H};
})();
