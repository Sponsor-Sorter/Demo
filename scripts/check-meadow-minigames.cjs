const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../meadow-and-market'),source=fs.readFileSync(root+'/minigames.js','utf8');
const elements=new Map(),el=id=>{if(!elements.has(id))elements.set(id,{children:[],style:{},focus(){},classList:{add(){},remove(){},toggle(){}},append(){},remove(){},setAttribute(){},addEventListener(){},querySelector:s=>el(s),querySelectorAll:()=>[],showModal(){this.open=true},close(){this.open=false}});return elements.get(id)};
let state={},gold=0,goods=0,saves=0,frames=0;const dialog=el('dialog'),scope={window:{},document:{hidden:false,createElement:()=>dialog,body:{append(){}},querySelector:el,addEventListener(){}},performance:{now:()=>0},requestAnimationFrame:()=>++frames,cancelAnimationFrame(){},setTimeout(){},Date,Math};
vm.runInNewContext(source.replace('  window.meadowMinigames=', '  window.test={finish,tick,start,intro,pause,setRun:r=>run=r,getRun:()=>run};\n  window.meadowMinigames='),scope);
const game=scope.window.meadowMinigames,t=scope.window.test;game.attach({state:()=>state,canPlay:()=>true,notify(){},save:()=>saves++,reward:(item,n,g)=>{goods+=n;gold+=g}});
assert.equal(game.games.length,6);assert.equal(new Set(game.games.map(g=>g.id)).size,6);
for(const g of game.games){assert(fs.existsSync(root+'/assets/generated/minigames/'+g.scene+'.webp'));assert(fs.statSync(root+'/assets/audio/minigame-'+g.id+'.mp3').size>1000);assert(g.text&&g.goal>0&&g.time>0)}
const eggs=game.games[0];for(let i=0;i<5;i++){t.setRun({game:eggs,score:12,elapsed:20});t.finish(true)}assert.equal(goods,9);assert.equal(gold,75);assert.equal(state.minigames.records.eggs.wins,5);assert.equal(state.minigames.records.eggs.best,25);assert.equal(saves,5);
t.setRun({game:eggs,score:2,misses:3,elapsed:10});t.finish(false);assert.equal(gold,75);assert(dialog.innerHTML.includes('Retry'));assert(dialog.innerHTML.includes('No thanks'));
const paused={game:eggs,score:0,elapsed:5,last:0,spawn:0,paused:true,actors:[]};t.setRun(paused);t.tick(500);assert.equal(paused.elapsed,5,'Pause does not consume time');scope.document.hidden=true;paused.paused=false;t.tick(1000);assert.equal(paused.elapsed,5,'Background does not consume time');scope.document.hidden=false;
const failure={game:eggs,score:0,misses:2,elapsed:4,last:0,spawn:0,paused:false,actors:[{dead:false,y:92,velocity:1,x:20,el:el('egg')}]};t.setRun(failure);t.tick(50);assert.equal(t.getRun(),null);assert(dialog.innerHTML.includes('Retry'));assert.equal(gold,75);
assert(source.includes("if(a.found)return"),'Found animals cannot be counted twice');assert(source.includes('r.elapsed-r.lastMilk<.45'),'Milking rejects rapid repeated squeezes');assert(source.includes("dialog.addEventListener('close',cleanup)"));
console.log('Six mini-games: assets, reward cap, wins, loss/retry, pause/background timing, egg break limit and cleanup passed.');

