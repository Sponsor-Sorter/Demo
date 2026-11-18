const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const club=fs.readFileSync('meadow-and-market/farm-club.js','utf8'),bee=fs.readFileSync('meadow-and-market/bee-challenge.js','utf8');
const context={esc:v=>String(v).replaceAll('<','&lt;')};vm.createContext(context);
vm.runInContext(club.slice(club.indexOf(' function weeklyPrizeMarkup('),club.indexOf(' function drawMissions()'))+';this.markup=weeklyPrizeMarkup;',context);
const selection={game:'eggs',scope:'friends',period:'previous'},prize={version:251,verified:true,game:'eggs',week:'2026-11-09',rank:2,gems:100,gold:300,status:'eligible',eligible:true,claimed:false};
const render=p=>context.markup({week:'2026-11-09',rows:[{self:true,place:1}],weekly_prize:p},selection);
assert(render(prize).includes('global rank: #2'));assert(render(prize).includes('club-week-claim'));
for(const p of [undefined,{...prize,verified:false},{...prize,game:'milk'},{...prize,week:'2026-11-02'},{...prize,rank:11},{...prize,gems:-1},{...prize,status:'outside_top_ten',eligible:false,rank:11},{...prize,status:'no_score',eligible:false,rank:null},{...prize,claimed:true}])assert(!render(p).includes('club-week-claim'),'Only matching verified global eligibility may expose a claim');
assert(render({...prize,claimed:true}).includes('has been collected'));
assert(render({...prize,status:'no_score',eligible:false}).includes('No verified score'));
assert(!context.markup({week:'2026-11-09',weekly_prize:prize},{...selection,period:'current'}).includes('club-week-claim'));

(async()=>{
 const timers=new Map(),pictures=[],nodes=new Map();let timerId=0,captured=null;
 const node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',disabled:false,hidden:false,setAttribute(){},append(){},focus(){},getContext:()=>({setTransform(){}})});return nodes.get(id)};
 const dialog={open:true,dataset:{},querySelector:node,querySelectorAll:()=>[],close(){this.open=false}};
 const canvas={getBoundingClientRect:()=>({left:0,top:0,width:600,height:600}),getContext:()=>({setTransform(){}}),setPointerCapture:id=>captured=id,hasPointerCapture:id=>id===captured,releasePointerCapture:()=>{captured=null},dataset:{}};nodes.set('.bs-field canvas',canvas);
 const Matter=require('../meadow-and-market/vendor/matter-0.20.0.min.js'),w={Matter,meadowAudio:{speak(){},stopVoice(){}}};
 vm.runInNewContext(fs.readFileSync('meadow-and-market/bee-challenge-core.js','utf8'),{window:w});
 w.meadowBeeChallengeProgress={load:()=>({last:0,maps:{}}),write(){},score(){},record(){}};
 const source=bee.replace('window.meadowBeeChallenge={','window.__beeTest={down,move,up,cancel,keyDraw,loadImages,start,showMaps,setup(s,c,d){sim=s;canvas=c;dialog=d;spent=0;draft=[];finger=null;draftStartSpent=0;owner="test";api={owner:()=>"test"};},snapshot(){return {spent,finger,lines:sim?.strokes.length,ready,images:Object.keys(images)};}};window.meadowBeeChallenge={');
 class Image{constructor(){pictures.push(this)}set src(v){this.url=v}decode(){return Promise.resolve()}}
 const scope={window:w,document:{addEventListener(){},createElement:()=>node('retry')},Image,localStorage:{getItem:()=>null,setItem(){}},setTimeout:fn=>{timers.set(++timerId,fn);return timerId},clearTimeout:id=>timers.delete(id),requestAnimationFrame:()=>1,cancelAnimationFrame(){},console};
 vm.runInNewContext(source,scope);const b=w.__beeTest,sim=w.meadowBeeChallengeCore.create(0);
 b.setup(sim,canvas,dialog);
 const event=(pointerId,x,y,extra={})=>({pointerId,clientX:x,clientY:y,button:0,isPrimary:true,preventDefault(){},...extra});
 b.down(event(1,40,80));b.move(event(1,100,80));const spent=b.snapshot().spent;assert(spent>0);
 b.down(event(2,120,80,{isPrimary:false}));b.move(event(2,160,80));b.up(event(2,160,80));assert.equal(b.snapshot().spent,spent);assert.equal(b.snapshot().finger,1);
 b.cancel(event(1,100,80));assert.equal(b.snapshot().spent,0);assert.equal(b.snapshot().lines,0);assert.equal(captured,null);assert(node('[data-bs-note]').textContent.includes('Ink returned'));
 b.down(event(3,40,80,{isPrimary:false}));assert.equal(b.snapshot().finger,null);
 b.down(event(4,40,80));b.move(event(4,100,80));b.up(event(4,100,80));assert.equal(b.snapshot().lines,1);b.cancel(event(4,100,80));assert.equal(b.snapshot().lines,1,'Lost capture after release cannot refund committed ink');
 // A failed loading attempt cannot install partial art or poison the next retry.
 let attempt=b.loadImages();assert.equal(pictures.length,6);pictures[0].onerror();await assert.rejects(attempt);assert.equal(b.snapshot().ready,false);assert.equal(b.snapshot().images.length,0);
 const failed=pictures.slice();attempt=b.loadImages();const retry=pictures.slice(6);assert.equal(retry.length,6);for(const image of failed.slice(1))await image.onload();for(const image of retry)await image.onload();await attempt;assert.equal(b.snapshot().ready,true);assert.equal(b.snapshot().images.length,6);assert.equal(timers.size,0);
 // Exercise actual start() bindings, not a second copy of Undo's implementation.
 await b.start(0);b.down(event(5,40,80));b.move(event(5,100,80));b.up(event(5,100,80));assert(b.snapshot().spent>0);node('[data-bs-note]').textContent='Ink used.';node('[data-bs-undo]').onclick();assert(node('[data-bs-note]').textContent.includes('Ink returned'));assert.equal(b.snapshot().lines,0);assert.equal(b.snapshot().spent,0);
 const timedWindow={...w};vm.runInNewContext(source,{...scope,window:timedWindow});const timed=timedWindow.__beeTest,timeoutAttempt=timed.loadImages();for(const fn of [...timers.values()])fn();await assert.rejects(timeoutAttempt);assert.equal(timed.snapshot().ready,false);assert.equal(timers.size,0,'Stalled loads have a bounded deadline and release timers');
 const decodeWindow={...w};vm.runInNewContext(source,{...scope,window:decodeWindow,Image:class extends Image{decode(){return Promise.reject(Error('Decode failed'))}}});const decode=decodeWindow.__beeTest,first=pictures.length,decodeAttempt=decode.loadImages();for(const image of pictures.slice(first))await image.onload();await assert.rejects(decodeAttempt);assert.equal(decode.snapshot().ready,false);assert.equal(timers.size,0);
 console.log('Polish251: server-bound weekly prize states, friends/global distinction, stale metadata, primary/multiple/cancelled pointers, exact ink refunds, committed strokes, failed artwork retry and actual Undo status passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
