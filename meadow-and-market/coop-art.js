(() => {
 'use strict';
 const R=window.meadowRotations,Y=window.meadowYards,previous=Y.art;let serial=0;
 const ratio=1.864,capacity=[1,3,5,7],homeSizes=[[.44,.44],[.85,.45],[1.5,.78],[2.25,1.15]];
 const turn=(x,y,w,h,r)=>{const p=R.turnPoint(x-.5,y-.5,w,h,r);return{x:p.x+.5,y:p.y+.5}};
 const project=(p,fp,z=0)=>[(fp.h+p.x-p.y)*1000/(fp.w+fp.h),(p.x+p.y-z*ratio)*1000/(fp.w+fp.h)];
 const tier=o=>Math.max(0,Math.min(3,Math.floor(Number(o.tier)||0)));
 function geometry(o,fp){
  const [w,h]=Y.baseSize(o),r=R.angle(o),margin=.075,home={x:.12,y:.12,w:homeSizes[tier(o)][0],h:homeSizes[tier(o)][1]},box=Y.turnBox(home,w,h,r),water=turn(w-.27,.28,w,h,r),panels=[],posts=new Map();
  const add=(a,b)=>{const near=Math.abs(a.x-(fp.w-margin))<1e-8&&Math.abs(b.x-(fp.w-margin))<1e-8||Math.abs(a.y-(fp.h-margin))<1e-8&&Math.abs(b.y-(fp.h-margin))<1e-8;panels.push({a,b,near});for(const p of [a,b]){const key=p.x.toFixed(6)+','+p.y.toFixed(6),old=posts.get(key);posts.set(key,{...p,near:near||old?.near||false})}};
  // Tile units and both ground axes match setIsoBox; artwork cannot change this perimeter.
  for(let x=0;x<fp.w;x++){const a=margin+x*(fp.w-2*margin)/fp.w,b=margin+(x+1)*(fp.w-2*margin)/fp.w;add({x:a,y:margin},{x:b,y:margin});add({x:a,y:fp.h-margin},{x:b,y:fp.h-margin})}
  for(let y=0;y<fp.h;y++){const a=margin+y*(fp.h-2*margin)/fp.h,b=margin+(y+1)*(fp.h-2*margin)/fp.h;add({x:margin,y:a},{x:margin,y:b});add({x:fp.w-margin,y:a},{x:fp.w-margin,y:b})}
  return {w,h,r,home,box,water,panels,posts:[...posts.values()],corners:[{x:0,y:0},{x:fp.w,y:0},{x:fp.w,y:fp.h},{x:0,y:fp.h}]};
 }
 function residents(o,fp,ctx={}){
  const g=geometry(o,fp),animals=(ctx.residents||[]).filter(a=>a.type==='chicken').slice(0,capacity[tier(o)]),choices=[],used=[];
  for(let y=.25;y<g.h-.16;y+=.18)for(let x=.25;x<g.w-.16;x+=.18){if(x<g.home.x+g.home.w+.12&&y<g.home.y+g.home.h+.12)continue;if(Math.hypot(x-(g.w-.27),y-.28)<.28)continue;choices.push({x,y})}
  for(let i=0;i<animals.length;i++){let choice,best=-Infinity;for(const p of choices){if(used.includes(p))continue;const spread=used.length?Math.min(...used.map(q=>Math.hypot(p.x-q.x,p.y-q.y))):0,turned=turn(p.x,p.y,g.w,g.h,g.r),sum=fp.w+fp.h,sx=(fp.h+turned.x-turned.y)/sum,hx=(fp.h+g.box.x+g.box.w/2-g.box.y-g.box.h/2)/sum,half=(g.box.w+g.box.h)/sum/2,birdHalf=.18/sum,overlap=turned.x+turned.y<g.box.x+g.box.y+(g.box.w+g.box.h)/2?Math.max(0,Math.min(sx+birdHalf,hx+half)-Math.max(sx-birdHalf,hx-half)):0,score=spread-.03*Math.hypot(p.x-g.w*.67,p.y-g.h*.70)-overlap*100;if(score>best){choice=p;best=score}}used.push(choice||{x:g.w*.72,y:g.h*.73})}
  return animals.map((animal,i)=>{const p=turn(used[i].x,used[i].y,g.w,g.h,g.r),direction=(g.r+i%4)%4,rare=animal.breedTier?R.frame({...animal,rotation:direction}):null,frame=rare?{...rare,anchor:[rare.front[0]/rare.width,rare.front[1]/rare.height]}:window.meadowCoopAssets.hens[direction];return{animal,p,frame,direction,depth:p.x+p.y}}).sort((a,b)=>a.depth-b.depth);
 }
 const image=(f,x,y,width,height,extra='')=>'<image href="'+f.file+'" x="'+x+'" y="'+y+'" width="'+width+'" height="'+height+'" preserveAspectRatio="none" '+extra+'/>';
 function anchored(f,p,fp,{width,height,cls='',anchor}={}){
  const unit=1000/(fp.w+fp.h),point=project(p,fp),w=width?width*unit:height*unit*f.width/f.height,h=height?height*unit*ratio:w*f.height/f.width*ratio,a=anchor||f.anchor||[.5,1];
  return image(f,point[0]-w*a[0],point[1]-h*a[1],w,h,'class="'+cls+'"');
 }
 function panel(p,fp,f){
  const unit=1000/(fp.w+fp.h),a=project(p.a,fp,.06),b=project(p.b,fp,.06),sx=(b[0]-a[0])/f.width,sy=unit*.20*ratio/f.railSpan,shear=(b[1]-a[1]-sy*(f.bottom[1]-f.bottom[0]))/f.width,ty=a[1]-sy*f.bottom[0];
  return '<g class="coop-fence-panel" transform="matrix('+[sx,shear,0,sy,a[0],ty].join(' ')+')">'+image(f,0,0,f.width,f.height)+'</g>';
 }
 function art(o,fp,ctx={}){
  if(o.type!=='coop')return previous(o,fp,ctx);
  const assets=window.meadowCoopAssets,f=R.frame(o);if(!assets||!f)return previous(o,fp,ctx);
  const g=geometry(o,fp),id='coop-ground-'+(++serial),unit=1000/(fp.w+fp.h),floor='<defs><pattern id="'+id+'" width="1" height="1" patternUnits="userSpaceOnUse">'+image(assets.floor,0,0,1,1)+'</pattern></defs><g transform="matrix('+[unit,unit,-unit,unit,fp.h*unit,0].join(' ')+')"><rect class="coop-ground-plane" x="0" y="0" width="'+fp.w+'" height="'+fp.h+'" fill="url(#'+id+')"/></g>',fence=near=>{
   const pieces=g.panels.filter(p=>p.near===near).map(p=>({depth:Math.max(p.a.x+p.a.y,p.b.x+p.b.y)-.01,html:panel(p,fp,assets.rail)})).concat(g.posts.filter(p=>p.near===near).map(p=>({depth:p.x+p.y,html:anchored(assets.post,p,fp,{height:.34,cls:'coop-fence-post'})})));return '<g class="coop-fence-'+(near?'near':'far')+'">'+pieces.sort((a,b)=>a.depth-b.depth).map(p=>p.html).join('')+'</g>';
  },homePoint={x:g.box.x+g.box.w/2,y:g.box.y+g.box.h/2},entities=[{depth:homePoint.x+homePoint.y,html:anchored(f,homePoint,fp,{width:g.box.w+g.box.h,cls:'coop-house-sprite'})},{depth:g.water.x+g.water.y,html:anchored(assets.water,g.water,fp,{width:.40,cls:'coop-care-props'})}];
  for(const bird of residents(o,fp,ctx))entities.push({depth:bird.depth,html:anchored(bird.frame,bird.p,fp,{height:.38,cls:'yard-animal coop-hen',anchor:bird.frame.anchor})});
  return '<span class="direction-yard painted-coop coop-grid177"><svg class="coop-scene" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">'+floor+fence(false)+'<g class="coop-residents">'+entities.sort((a,b)=>a.depth-b.depth).map(p=>p.html).join('')+'</g>'+fence(true)+'</svg></span>';
 }
 Y.art=art;window.meadowCoopArt={art,residents,geometry,project,turn,ratio};
})();
