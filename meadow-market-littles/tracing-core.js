/* Shared centre-line guides. Every stroke, including dots and crossbars, counts. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.meadowTracing = api;
})(typeof globalThis === 'object' ? globalThis : this, () => {
  'use strict';
  const line = (...values) => values.reduce((a, n, i) => (i % 2 ? a[a.length - 1].y = n : a.push({ x: n, y: 0 }), a), []);
  const arc = (cx, cy, rx, ry, start = -90, end = 270) => {
    const count=Math.max(8,Math.ceil(Math.abs(end-start)/8));
    return Array.from({length:count+1},(_,i)=>{const angle=(start+(end-start)*i/count)*Math.PI/180;return {x:cx+rx*Math.cos(angle),y:cy+ry*Math.sin(angle)};});
  };
  const curve = (...values) => {
    const [x0, y0, x1, y1, x2, y2, x3, y3] = values;
    return Array.from({ length: 25 }, (_, i) => { const t = i / 24, u = 1 - t; return { x: u*u*u*x0+3*u*u*t*x1+3*u*t*t*x2+t*t*t*x3, y: u*u*u*y0+3*u*u*t*y1+3*u*t*t*y2+t*t*t*y3 }; });
  };
  const join = (...parts) => parts.flat();
  const g = {};
  const put = (letter, width, ...strokes) => g[letter] = { width, strokes };
  put('A', .82, line(.07,.9,.41,.12,.75,.9), line(.21,.59,.61,.59));
  put('B', .8, line(.12,.9,.12,.12), join(curve(.12,.12,.82,.03,.85,.54,.12,.5), curve(.12,.5,.91,.4,.9,1,.12,.9)));
  put('C', .83, arc(.44,.51,.35,.4,-45,-315));
  put('D', .84, line(.12,.9,.12,.12), curve(.12,.12,1.04,.07,1.04,.95,.12,.9));
  put('E', .74, line(.66,.12,.12,.12,.12,.9,.66,.9), line(.12,.51,.59,.51));
  put('F', .74, line(.12,.9,.12,.12,.66,.12), line(.12,.51,.59,.51));
  put('G', .88, join(arc(.45,.51,.36,.4,-45,-315), line(.7,.79,.77,.57,.47,.57)));
  put('H', .84, line(.12,.12,.12,.9), line(.72,.12,.72,.9), line(.12,.51,.72,.51));
  put('I', .48, line(.24,.12,.24,.9), line(.07,.12,.41,.12), line(.07,.9,.41,.9));
  put('J', .69, join(line(.57,.12,.57,.69), curve(.57,.69,.58,1,.1,1,.1,.72)));
  put('K', .8, line(.12,.12,.12,.9), line(.71,.12,.12,.57,.71,.9));
  put('L', .72, line(.12,.12,.12,.9,.64,.9));
  put('M', 1, line(.1,.9,.1,.12,.5,.63,.9,.12,.9,.9));
  put('N', .86, line(.12,.9,.12,.12,.74,.9,.74,.12));
  put('O', .86, arc(.43,.51,.33,.4));
  put('P', .8, line(.12,.9,.12,.12), curve(.12,.12,.97,-.03,.94,.66,.12,.55));
  put('Q', .9, arc(.43,.51,.33,.4), line(.51,.7,.83,.99));
  put('R', .84, line(.12,.9,.12,.12), curve(.12,.12,.99,-.03,.97,.65,.12,.54), line(.42,.54,.77,.9));
  put('S', .8, join(curve(.7,.21,.12,-.14,-.08,.5,.42,.51), curve(.42,.51,.99,.52,.74,1.16,.1,.8)));
  put('T', .82, line(.08,.12,.74,.12), line(.41,.12,.41,.9));
  put('U', .85, join(line(.12,.12,.12,.61), curve(.12,.61,.1,1.02,.73,1.02,.73,.61), line(.73,.61,.73,.12)));
  put('V', .84, line(.08,.12,.42,.9,.76,.12));
  put('W', 1.12, line(.08,.12,.3,.9,.56,.4,.82,.9,1.04,.12));
  put('X', .84, line(.1,.12,.74,.9), line(.74,.12,.1,.9));
  put('Y', .84, line(.08,.12,.42,.51,.76,.12), line(.42,.51,.42,.9));
  put('Z', .82, line(.1,.12,.72,.12,.1,.9,.72,.9));
  put('a', .7, arc(.32,.62,.23,.28,-40,-400), line(.55,.34,.55,.9));
  put('b', .7, line(.12,.12,.12,.9), arc(.35,.62,.23,.28,180,540));
  put('c', .66, arc(.35,.62,.25,.28,-45,-315));
  put('d', .7, arc(.32,.62,.23,.28,-40,-400), line(.55,.12,.55,.9));
  put('e', .68, join(line(.12,.6,.58,.6), curve(.58,.6,.59,.24,.1,.24,.1,.62), curve(.1,.62,.1,.97,.49,.97,.59,.8)));
  put('f', .57, join(curve(.52,.15,.2,-.01,.2,.35,.2,.45), line(.2,.45,.2,.9)), line(.06,.4,.49,.4));
  put('g', .7, arc(.32,.62,.23,.28,-40,-400), join(line(.55,.34,.55,.93), curve(.55,.93,.56,1.2,.2,1.2,.11,1.02)));
  put('h', .7, line(.12,.12,.12,.9), join(curve(.12,.56,.2,.24,.59,.25,.59,.55), line(.59,.55,.59,.9)));
  put('i', .32, line(.16,.39,.16,.9), line(.16,.16));
  put('j', .4, join(line(.27,.39,.27,.94), curve(.27,.94,.27,1.14,.08,1.17,.04,1.04)), line(.27,.16));
  put('k', .67, line(.12,.12,.12,.9), line(.58,.35,.12,.67,.61,.9));
  put('l', .34, line(.16,.12,.16,.9));
  put('m', 1.04, line(.11,.35,.11,.9), join(curve(.11,.56,.19,.24,.52,.25,.52,.54), line(.52,.54,.52,.9)), join(curve(.52,.56,.63,.24,.93,.25,.93,.54), line(.93,.54,.93,.9)));
  put('n', .71, line(.12,.35,.12,.9), join(curve(.12,.56,.21,.24,.59,.25,.59,.56), line(.59,.56,.59,.9)));
  put('o', .7, arc(.35,.62,.25,.28));
  put('p', .71, line(.12,.35,.12,1.1), arc(.36,.62,.24,.28,180,540));
  put('q', .71, arc(.34,.62,.24,.28), line(.58,.35,.58,1.1));
  put('r', .53, line(.12,.35,.12,.9), curve(.12,.56,.21,.28,.39,.29,.48,.4));
  put('s', .62, join(curve(.54,.42,.15,.14,-.04,.6,.31,.62), curve(.31,.62,.7,.65,.53,1.08,.09,.81)));
  put('t', .56, join(line(.25,.16,.25,.75), curve(.25,.75,.25,.96,.43,.94,.51,.84)), line(.07,.4,.49,.4));
  put('u', .71, join(line(.12,.35,.12,.7), curve(.12,.7,.12,1.02,.59,.96,.59,.66)), line(.59,.35,.59,.9));
  put('v', .7, line(.08,.35,.35,.9,.62,.35));
  put('w', .98, line(.07,.35,.26,.9,.49,.48,.72,.9,.91,.35));
  put('x', .68, line(.09,.35,.59,.9), line(.59,.35,.09,.9));
  put('y', .7, line(.08,.35,.35,.88), join(line(.61,.35,.3,1.04), curve(.3,1.04,.25,1.17,.11,1.18,.07,1.06)));
  put('z', .66, line(.09,.35,.57,.35,.09,.9,.57,.9));
  const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
  function resample(stroke, spacing=.025) {
    if(stroke.length===1)return stroke.map(p=>({...p}));
    const output=[{...stroke[0]}];let carry=0;
    for(let i=1;i<stroke.length;i++){
      let a=stroke[i-1],b=stroke[i],length=distance(a,b),offset=spacing-carry;
      while(offset<length){const t=offset/length;output.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});offset+=spacing;}
      carry=length-(offset-spacing);
    }
    if(distance(output.at(-1),stroke.at(-1))>.008)output.push({...stroke.at(-1)});
    return output;
  }
  function glyph(letter) {
    if(g[letter])return g[letter];
    const [base,...marks]=String(letter).normalize('NFD'),original=g[base];
    if(!original)return null;
    const strokes=original.strokes.map(s=>s.map(p=>({...p}))),cx=original.width/2;
    for(const mark of marks){
      if(mark==='\u0301')strokes.push(line(cx-.1,.01,cx+.1,-.13));
      else if(mark==='\u0300')strokes.push(line(cx-.1,-.13,cx+.1,.01));
      else if(mark==='\u0308')strokes.push(line(cx-.14,-.03),line(cx+.14,-.03));
      else if(mark==='\u0302')strokes.push(line(cx-.17,.01,cx,-.13,cx+.17,.01));
      else if(mark==='\u0303')strokes.push(curve(cx-.2,-.03,cx-.05,-.2,cx+.05,.1,cx+.2,-.06));
      else if(mark==='\u030a')strokes.push(arc(cx,-.04,.08,.08));
      else if(mark==='\u0327')strokes.push(line(cx,.91,cx+.07,1.03,cx-.08,1.1));
      else return null;
    }
    return {width:original.width,strokes};
  }
  function create(text,{relaxed=false}={}) {
    const letters=[],strokes=[];let cursor=0;
    for(const letter of [...String(text)]){
      const shape=glyph(letter);if(!shape)return null;
      const first=strokes.length;
      shape.strokes.forEach((stroke,part)=>strokes.push({letter,part,points:resample(stroke.map(p=>({x:p.x+cursor,y:p.y})))}));
      letters.push({letter,x:cursor,width:shape.width,first,count:strokes.length-first});cursor+=shape.width+.16;
    }
    if(!strokes.length)return null;
    const all=strokes.flatMap(s=>s.points),minY=Math.min(...all.map(p=>p.y)),maxY=Math.max(...all.map(p=>p.y));
    return {text,letters,strokes,width:cursor-.16,minY,maxY,coverage:relaxed===true?.87:.92,hits:strokes.map(s=>new Uint8Array(s.points.length))};
  }
  function segmentDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}
  function mark(model,path,radius=.082){
    if(!path.length)return;
    model.strokes.forEach((s,i)=>s.points.forEach((p,j)=>{if(model.hits[i][j])return;for(let k=0;k<path.length;k++){if(segmentDistance(p,path[Math.max(0,k-1)],path[k])<=radius){model.hits[i][j]=1;break;}}}));
  }
  function strokeDone(hits,coverage=.92){
    if(hits.length===1)return !!hits[0];
    if(!hits[0]||!hits.at(-1)||hits.reduce((a,b)=>a+b,0)/hits.length<coverage)return false;
    const chunk=Math.max(1,Math.ceil(hits.length/4));
    for(let start=0;start<hits.length;start+=chunk){const part=hits.slice(start,start+chunk);if(part.reduce((a,b)=>a+b,0)/part.length<.8)return false;}
    return true;
  }
  const completedLetters = model => model.letters.map(l=>model.hits.slice(l.first,l.first+l.count).every(h=>strokeDone(h,model.coverage)));
  const complete = model => !!model&&model.hits.every(h=>strokeDone(h,model.coverage));
  function near(model,p,radius=.11){return model.strokes.some(s=>s.points.some((b,i)=>segmentDistance(p,s.points[Math.max(0,i-1)],b)<=radius));}
  function layout(model,width,height,padding={x:14,y:12}){const scale=Math.min((width-padding.x*2)/(model.width+.12),(height-padding.y*2)/(model.maxY-model.minY+.2));return {scale,x:(width-model.width*scale)/2,y:(height-(model.maxY+model.minY)*scale)/2};}
  const reset=model=>model.hits.forEach(h=>h.fill(0));
  return {create,mark,complete,completedLetters,strokeDone,near,layout,reset,glyph,alphabet:'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'};
});
