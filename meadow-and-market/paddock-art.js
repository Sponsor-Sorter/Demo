(() => {
 'use strict';
 const R=window.meadowRotations,Y=window.meadowYards,previous=Y.art;let serial=0;
 const canonical=(x,y,w,h,r)=>{const p=R.turnPoint(x-.5,y-.5,w,h,r);return {x:p.x+.5,y:p.y+.5}};
 function residents(o,fp,ctx){
  const [w,h]=Y.baseSize(o),r=R.angle(o),sum=fp.w+fp.h,animals=(ctx.residents||[]).filter(a=>['cow','sheep','goat','alpaca'].includes(a.type)),seats=[],candidates=[];
  for(let y=.65;y<h-.4;y+=.8)for(let x=.65;x<w-.4;x+=.8)if(!o.tier||x>1.3||y>1.05)candidates.push({x,y});
  for(let i=0;i<animals.length;i++){let chosen=null,best=-Infinity;for(const p of candidates){if(seats.includes(p))continue;const spread=seats.length?Math.min(...seats.map(q=>(p.x-q.x)**2+(p.y-q.y)**2)):0,score=spread-.05*((p.x-w*.58)**2+(p.y-h*.6)**2);if(score>best){best=score;chosen=p}}seats.push(chosen||{x:w*.6,y:h*.6})}
  return animals.map((a,i)=>{const p=canonical(seats[i].x,seats[i].y,w,h,r),f=R.frame({...a,rotation:(r+i%2)%4}),src=f?.file||ctx.animalImage?.(a)||'assets/generated/'+a.type+'.webp',width=160/sum,height=240/sum;return {depth:p.x+p.y,html:'<img class="yard-animal" src="'+src+'" alt="" style="left:'+((fp.h+p.x-p.y)/sum*100-width/2)+'%;top:'+((p.x+p.y)/sum*100-height*.94)+'%;width:'+width+'%;height:'+height+'%">'}}).sort((a,b)=>a.depth-b.depth).map(a=>a.html).join('');
 }
 function foreground(o,fp,f){
  const key='paddock-fence-'+(++serial),p=R.projection(f,fp),[l,b,r]=[f.left,f.front,f.right],height=f.fenceHeight||f.width*.15,margin=8,band=[[l[0],l[1]-height],[b[0],b[1]-height],[r[0],r[1]-height],[r[0],r[1]+margin],[b[0],b[1]+margin],[l[0],l[1]+margin]].map(v=>v.join(',')).join(' ');
  return '<span class="directional-art paddock-front"><svg viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true"><defs><clipPath id="'+key+'-band"><polygon points="'+band+'"/></clipPath>'+['left','right'].map(side=>'<clipPath id="'+key+'-'+side+'"><rect x="'+(side==='left'?0:f.front[0]-.3)+'" y="0" width="'+(side==='left'?f.front[0]+.3:f.width-f.front[0]+.3)+'" height="'+f.height+'"/></clipPath>').join('')+'</defs>'+['left','right'].map(side=>'<g transform="matrix('+p[side].join(' ')+')"><g clip-path="url(#'+key+'-'+side+')"><image href="'+f.file+'" width="'+f.width+'" height="'+f.height+'" clip-path="url(#'+key+'-band)"/></g></g>').join('')+'</svg></span>';
 }
 function art(o,fp,ctx={}){
  if(o.type!=='paddock')return previous(o,fp,ctx);
  const frame=R.frame(o);if(!frame)return '';
  return '<span class="direction-yard painted-paddock">'+R.art(o,fp,{...ctx,spriteOnly:true})+'<span class="yard-residents">'+residents(o,fp,ctx)+'</span>'+foreground(o,fp,frame)+'</span>';
 }
 Y.art=art;window.meadowPaddockArt={art,canonical,residents};
})();
