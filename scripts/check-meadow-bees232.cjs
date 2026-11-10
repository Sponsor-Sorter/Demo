const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../meadow-and-market'),Matter=require(path.join(root,'vendor/matter-0.20.0.min.js')),scope={window:{Matter}};
for(const name of ['bee-challenge-core.js','bee-challenge-progress.js'])vm.runInNewContext(fs.readFileSync(path.join(root,name),'utf8'),scope);
const C=scope.window.meadowBeeChallengeCore,P=scope.window.meadowBeeChallengeProgress;
assert.equal(C.levels.length,20);assert.equal(new Set(C.levels.map(l=>JSON.stringify(l.terrain))).size,20);
const random=seed=>()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
function sampled(h){const points=[h[0]];for(let i=1;i<h.length;i++){const a=h[i-1],b=h[i],n=Math.max(Math.abs(b.x-a.x),Math.abs(b.y-a.y))/5;let x=a.x,y=a.y;for(let j=1;j<=n;j++){const nx=a.x+Math.round((b.x-a.x)*j/n/5)*5,ny=a.y+Math.round((b.y-a.y)*j/n/5)*5;if(nx!==x){x=nx;points.push({x,y});}if(ny!==y){y=ny;points.push({x,y});}}}return points;}
let rounds=0;
for(let i=0;i<20;i++){
  const level=C.levels[i];assert(level.bees>=32&&level.seconds>=10&&level.ink<850);assert(!C.rules.legalPoint(level.friend,level));
  assert(level.hint.every((p,n)=>!n||C.rules.legalSegment(level.hint[n-1],p,level)),'Map '+i+' has a legal solution');
  const length=level.hint.reduce((sum,p,n)=>sum+(n?C.rules.distance(level.hint[n-1],p):0),0);assert(length<level.ink);
  for(let seed=1;seed<=10;seed++){
    const sim=C.create(i,random(seed*435)),fixed=sim.terrain.map(body=>({...body.position})),points=seed>5?sampled(level.hint):level.hint;
    assert.equal(sim.launch(),false,'Blank drawings cannot launch');sim.addStroke(points);assert(sim.strokes[0].body.isStatic);assert(sim.launch());assert(!sim.strokes[0].body.isStatic,'Ink must become dynamic');
    for(let step=0;step<2200&&sim.state==='swarm';step++)sim.step();
    assert.equal(sim.state,'win','Complete supported adult round '+i+', seed '+seed);assert.equal(sim.bees.length,level.bees);
    sim.terrain.forEach((body,index)=>{assert(body.isStatic);assert.deepEqual(body.position,fixed[index]);});
    sim.dispose();assert.equal(sim.engine.world.bodies.length,0);assert.equal(sim.state,'closed');rounds++;
  }
  const sim=C.create(i,random(i+1));sim.addStroke([{x:40,y:80},{x:80,y:80}]);sim.launch();for(let n=0;n<2200&&sim.state==='swarm';n++)sim.step();assert.equal(sim.state,'retry','Irrelevant unsupported ink must fail on map '+i);sim.dispose();
}
const level=C.levels[0],points=[{x:40,y:80}],used=C.rules.append(points,{x:300,y:80},17,level);assert.equal(used.used,17);assert.equal(used.exhausted,true);assert.equal(points.at(-1).x,57);assert(!C.rules.legalSegment({x:90,y:400},{x:200,y:400},level),'Fast input cannot tunnel through rocks');
const undo=C.create();undo.addStroke(level.hint);const length=undo.strokes[0].length;assert(length>0);assert.equal(undo.undo().length,length);assert.equal(undo.strokes.length,0);assert(!undo.launch());undo.dispose();
const rows=new Map(),storage={getItem:key=>rows.get(key),setItem:(key,value)=>rows.set(key,value)};
const result=P.score(level,180,false);assert.equal(result.stars,3);assert(result.score>0);const recorded=P.record(storage,'farm-a',0,result);assert(recorded.saved);assert.equal(P.load(storage,'farm-a').maps[0].wins,1);assert.equal(P.load(storage,'farm-b').maps[0],undefined,'Accounts must not share personal practice records');
P.record(storage,'farm-a',0,P.score(level,220,true));assert.equal(P.load(storage,'farm-a').maps[0].ink,180);assert.equal(P.load(storage,'farm-a').maps[0].score,result.score);
assert.equal(P.record({getItem:()=>null,setItem(){throw Error('Full');}},'a',0,result).saved,false,'Storage failure is surfaced');
storage.setItem(P.key('bad'),'{oops');assert.equal(Object.keys(P.load(storage,'bad').maps).length,0);
const files=JSON.parse(fs.readFileSync(path.join(root,'sw.js'),'utf8').match(/const FILES=([^\n]+);/)[1]);
const proof=JSON.parse(fs.readFileSync(path.join(root,'assets/generated/bee-challenge/provenance.json')));
for(const file of proof.files){const name='assets/generated/bee-challenge/'+file.file;assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,name))).digest('hex'),file.sha256);assert(files.includes('./'+name));}
for(const id of proof.audio){assert(files.includes('./assets/audio/'+id+'.mp3?v=56'));const name=id.startsWith('bee51-')?'bee51-rhys-generation.json':'bee-rhys-generation.json',generation=JSON.parse(fs.readFileSync(path.join(root,'assets/audio',name)));assert.equal(generation.files.find(f=>f.id===id).voice,'Noah - YA Audiobooks Narrator');assert.equal(generation.files.find(f=>f.id===id).tempo,1);}
for(const name of ['bee-challenge-core.js?v=1','bee-challenge-progress.js?v=1','bee-challenge.js?v=1','bee-challenge.css?v=1','vendor/matter-0.20.0.min.js','vendor/matter-LICENSE.txt'])assert(files.includes('./'+name));
const source=fs.readFileSync(path.join(root,'bee-challenge.js'),'utf8');assert(!/api\.(reward|save)|meadowClub|finishRound/.test(source),'Practice callback never touches farm economy or ranked rounds');
console.log('Adult bees: '+rounds+' complete seeded rounds (100 sampled), twenty failures, ink, static terrain/dynamic drawings, undo/disposal, account-scoped practice records, offline assets and approved Rhys recordings passed.');
