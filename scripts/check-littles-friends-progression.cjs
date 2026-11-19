'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const C=require('../meadow-market-littles/friends-core.js'),root=path.resolve(__dirname,'../meadow-market-littles');
const rng=n=>()=>((n=(n*1664525+1013904223)>>>0)/4294967296);
const make=(id,level=1,seed=7)=>C.create(id,level,rng(seed),0,{progressive:true});
const tick=(s,t)=>{for(let i=0;i<Math.ceil(t*20);i++)C.tick(s,.05);};
function drag(s,target,to,from={x:.5,y:.86}){assert(C.start(s,from,target));for(let i=1;i<=20;i++)C.move(s,{x:from.x+(to.x-from.x)*i/20,y:from.y+(to.y-from.y)*i/20});C.end(s,to);}
function pack(s){while(s.phase==='watch'){C.continueWatch(s,.1);tick(s,.15);}}
function pairs(s){for(const id of new Set(s.deck))for(let i=0;i<s.deck.length;i++)if(s.deck[i]===id)C.card(s,i);tick(s,1.7);assert.equal(s.phase,'home');}
function complete(s){
 if(s.id==='meadowpairs'){pairs(s);[...new Set(s.deck)].forEach((id,i,a)=>drag(s,id,C.pos(i,a.length,.76),C.pos(i,a.length,.3)));}
 if(s.id==='paddockchange')for(let n=0;n<3;n++){C.ready(s);drag(s,s.friends[s.missing],C.pos(s.missing,3,.42));tick(s,1.3);}
 if(s.id==='farmerpattern')for(let n=0;n<3;n++){tick(s,4);assert.equal(s.watchIndex,0,'Audio must pace each watch phase');pack(s);for(const [i,id]of s.pattern.entries())drag(s,id,C.wagonPoint(s,i));tick(s,1.8);}
 if(s.id==='barnyardlisten')for(let n=0;n<3;n++){assert(C.doorIds(s).includes(s.target));drag(s,s.target,{x:.65,y:.35},{x:.4,y:.35});assert.equal(s.phase,'pet');for(let j=0;j<4&&s.phase==='pet';j++)drag(s,'pet',{x:.6,y:.46},{x:.4,y:.46});tick(s,1.2);}
 if(s.id==='gentleharvest'){for(let i=0;i<s.harvestGoal;i++){const item=s.produce.find(v=>v.id===s.target);drag(s,String(item.key),{x:.5,y:.87},item);}assert.equal(s.phase,'deliver');drag(s,'basket',{x:.8,y:.38},{x:.35,y:.8});}
 if(s.id==='farmpicture')for(const piece of s.pieces)drag(s,String(piece),C.slotPoint(s,piece));
 assert(s.done,s.id+' completes');assert.equal(s.score,s.goal);const score=s.score;assert.equal(C.hint(s),false);assert.equal(C.start(s,{x:.5,y:.5},'anything'),false);C.tick(s,.05);assert.equal(s.score,score,'No second completion');
}
for(const id of C.ids)test(id+': three selectable stages and complete seeded rounds',()=>{
 const profiles=[1,4,9].map(n=>C.profile(id,n));
 const strength=p=>({meadowpairs:p.pairs,paddockchange:p.friendChoices,farmerpattern:p.patternLength,barnyardlisten:p.doors,gentleharvest:p.harvestChoices,farmpicture:p.columns*p.rows})[id];
 assert(strength(profiles[0])<strength(profiles[1])&&strength(profiles[1])<strength(profiles[2]));
 assert.equal(C.challenge(id,1,-1),1);assert.equal(C.challenge(id,1,1),4);assert.equal(C.challenge(id,4,1),9);assert.equal(C.challenge(id,99,-1),4);assert.equal(C.challenge(id,99,1),99);
 assert.equal(C.profile(id,Infinity).level,1);assert.equal(C.profile(id,-5).level,1);
 for(const level of [1,4,9,99])for(let seed=1;seed<=12;seed++)complete(make(id,level,seed));
});
const progress=s=>JSON.stringify([s.score,s.round,s.phase,s.caught,s.open,s.matched,s.homes,s.loaded,s.placed,s.target,s.pattern,s.friends]);
function exercise(s,wrong,correct){
 const before=progress(s);assert.equal(C.hint(s),false);wrong();assert.equal(s.misses,1);assert.equal(s.hintReady,false);wrong();assert.equal(s.misses,2);assert.equal(s.hintReady,true);
 const after=progress(s),time=s.time;assert.equal(C.hint(s),true);assert(s.hints.length>0);assert.equal(progress(s),after,'Highlight cannot answer, reveal cards or award progress');assert.equal(s.time,time);assert.equal(C.hint(s),true);assert.equal(progress(s),after,'Repeated request is idempotent for progress');
 correct();assert.equal(s.misses,0);assert.equal(s.hintReady,false);assert.deepEqual(s.hints,[]);assert.notEqual(progress(s),before);
}
test('Memory: two mismatches, highlight only, then correct pair resets; duplicate/locked taps are free',()=>{
 const s=make('meadowpairs',9),a=0,b=s.deck.findIndex(id=>id!==s.deck[a]);
 const wrong=()=>{C.card(s,a);C.card(s,b);assert.equal(C.card(s,b),false);tick(s,1);};
 exercise(s,wrong,()=>{C.card(s,a);C.card(s,s.deck.findIndex((id,i)=>i!==a&&id===s.deck[a]));});
 assert.equal(C.card(s,a),false);assert.equal(s.misses,0);
});
test('Memory homes: correct animal must reach its nearest matching home',()=>{
 const s=make('meadowpairs',9);pairs(s);const ids=[...new Set(s.deck)],from=C.pos(0,ids.length,.3);
 exercise(s,()=>drag(s,ids[0],C.pos(1,ids.length,.76),from),()=>drag(s,ids[0],C.pos(0,ids.length,.76),from));
});
test('Missing friend: hints survive Look again; three friends keep the approved narration accurate',()=>{
 const s=make('paddockchange',9);C.ready(s);assert.equal(s.friends.length,3);const missing=s.friends[s.missing],wrong=s.friendOptions.find(id=>id!==missing),to=C.pos(s.missing,3,.42);
 exercise(s,()=>{drag(s,wrong,to);C.lookAgain(s);C.ready(s);},()=>drag(s,missing,to));
});
test('Pattern: wrong food and wrong adjacent wagon count, replay preserves current-step misses',()=>{
 const s=make('farmerpattern',9);pack(s);const id=s.pattern[0],wrong=s.options.find(x=>x!==id);
 drag(s,wrong,C.wagonPoint(s,0));assert.equal(s.misses,1);C.replay(s);pack(s);assert.equal(s.misses,1);
 drag(s,id,C.wagonPoint(s,1));assert.equal(s.loaded.length,0,'Nearby wagon cannot accept current food');assert.equal(s.misses,2);const before=progress(s);assert(C.hint(s));assert.equal(progress(s),before);assert.deepEqual(s.hints,[id,'wagon0']);drag(s,id,C.wagonPoint(s,0));assert.equal(s.misses,0);assert.equal(s.loaded.length,1);
});
test('Listening: two wrong door pulls offer a hint without opening the answer',()=>{
 const s=make('barnyardlisten',9),wrong=C.doorIds(s).find(id=>id!==s.target);
 exercise(s,()=>drag(s,wrong,{x:.7,y:.35},{x:.4,y:.35}),()=>drag(s,s.target,{x:.7,y:.35},{x:.4,y:.35}));
});
test('Harvest: hint highlights requested moving food and basket, then resets on the next request',()=>{
 const s=make('gentleharvest',9),wrong=s.produce.find(v=>v.id!==s.target),right=s.produce.find(v=>v.id===s.target);
 exercise(s,()=>drag(s,String(wrong.key),{x:.5,y:.87},wrong),()=>drag(s,String(right.key),{x:.5,y:.87},right));
 assert.equal(s.caught,1);
});
test('Delivery: cancelled carry is free; two committed wrong drops only highlight the cart',()=>{
 const s=make('gentleharvest',1);for(let i=0;i<s.harvestGoal;i++){const v=s.produce.find(v=>v.id===s.target);drag(s,String(v.key),{x:.5,y:.87},v);}const to={x:.1,y:.3};
 C.start(s,{x:.35,y:.8},'basket');C.move(s,to);C.cancel(s);C.end(s,to);assert.equal(s.misses,0);
 exercise(s,()=>drag(s,'basket',to,{x:.35,y:.8}),()=>drag(s,'basket',{x:.8,y:.38},{x:.35,y:.8}));
});
test('Picture: only the closest correct slot accepts a piece, hint never places it',()=>{
 const s=make('farmpicture',9);assert.equal(s.pieces.length,8);const piece=s.pieces[0],other=s.pieces.find(i=>i!==piece);
 exercise(s,()=>drag(s,String(piece),C.slotPoint(s,other)),()=>drag(s,String(piece),C.slotPoint(s,piece)));
});
test('Cancelled, stale, stationary and unselected gestures never unlock hints',()=>{
 for(const id of C.ids.filter(id=>id!=='meadowpairs')){
  const s=make(id,9);if(id==='paddockchange')C.ready(s);if(id==='farmerpattern')pack(s);
  const target=({paddockchange:s.friends[s.missing],farmerpattern:s.pattern[0],barnyardlisten:s.target,gentleharvest:'0',farmpicture:'0'})[id],from={x:.5,y:.8};
  for(let i=0;i<3;i++){C.start(s,from,target);C.move(s,{x:.1,y:.1});C.cancel(s);C.end(s,{x:.1,y:.1});C.start(s,from,target);C.end(s,from);}
  assert.equal(s.misses,0,id);assert.equal(s.hintReady,false,id);assert.equal(C.hint(s),false,id);
 }
 const puzzle=make('farmpicture',9);drag(puzzle,'',C.slotPoint(puzzle,0));assert.equal(puzzle.score,0);assert.equal(puzzle.misses,0,'Unselected background drag is free');
 const stale=make('paddockchange',9);C.start(stale,{x:.5,y:.8},stale.friends[stale.missing]);C.ready(stale);C.end(stale,C.pos(stale.missing,3,.42));assert.equal(stale.score,0);assert.equal(stale.misses,0,'An old-phase gesture cannot answer the new phase');
});
test('Quality88 stays on legacy mechanics;89 selection is session-only, with approved recordings unchanged',()=>{
 let quality=88;const view={window:{meadowFriendsCore:C,meadowWeeklyFair:{getQualityBuild:()=>quality}}};
 vm.runInNewContext(fs.readFileSync(root+'/friends-play.js','utf8'),view);
 vm.runInNewContext(fs.readFileSync(root+'/approved-voices.js','utf8'),view);
 const ui=view.window.meadowFriends;
 for(const id of C.ids){assert.equal(ui.progressive(id),false);const g={id,level:12},legacy=ui.prepare(g);assert.equal(legacy.goal,C.create(id,12).goal);assert.equal(ui.resetIntro(g),g);}
 quality=89;for(const id of C.ids){assert.equal(ui.progressive(id),true);const g=Object.freeze({id,level:99,friendLevel:1}),p=ui.prepare(g);assert.equal(p.level,1);assert.equal(g.level,99);assert.equal(p.goal,make(id,1).goal);assert.equal(ui.resetIntro(g).friendLevel,undefined);}
 for(const value of [undefined,null,NaN,88,'89']){quality=value;for(const id of C.ids)assert.equal(ui.progressive(id),false);}
 const manifest=JSON.parse(fs.readFileSync(root+'/assets/audio/friends66-generation.json','utf8'));
 for(const clip of manifest.files){const approved=view.window.meadowApprovedVoices.clips[clip.id];assert.equal(approved.farmer,clip.farmer);assert.equal(approved.voice,clip.voice);assert.equal(fs.statSync(root+'/assets/audio/'+clip.id+'.mp3').size,clip.bytes);}
 assert(manifest.files.find(c=>c.id==='friends66-rhys-paddockchange-look').text.includes('three farm friends'));
 assert.equal(JSON.parse(fs.readFileSync(root+'/release.json','utf8')).build,88,'Source-only batch does not advance the release');
});

// Exercise the real shared menu/intro/start and real difficulty controls against
// disposable in-memory elements. No account, storage, network or completed round.
class Element{
 constructor(){this.nodes=new Map();this.children=[];this.dataset={};this.style={setProperty(){}};this.classList={add(){},remove(){},toggle(){}};this.clientWidth=800;this.clientHeight=480;}
 set innerHTML(s){this.html=s;this.nodes.clear();this.children=[];}
 get innerHTML(){return this.html||'';}
 querySelector(s){if(!this.nodes.has(s))this.nodes.set(s,new Element());return this.nodes.get(s);}
 querySelectorAll(s){if(s!=='[data-game]')return[];return[...this.innerHTML.matchAll(/data-game="([^"]+)"/g)].map((m,i)=>{const n=this.querySelector('game'+i);n.dataset.game=m[1];return n;});}
 append(n){this.children.push(n);}
 insertBefore(){}addEventListener(){}setAttribute(){}showModal(){this.open=true;}
 getBoundingClientRect(){return{top:0,bottom:80,left:0,right:800,width:800,height:480};}
}
function controls(quality,denied=false){
 let dialog,selected,starts=0,writes=0;const state={stars:42,minigames:{records:Object.fromEntries(C.ids.map(id=>[id,{level:99,wins:7,marker:'keep'}])),rewards:{keep:2}},future:{keep:true}},before=JSON.stringify(state),audio=[];
 const document={body:new Element(),createElement(tag){const e=new Element();if(tag==='dialog')dialog=e;return e;},querySelector(){return new Element();},addEventListener(){}};
 const scope={window:{addEventListener(){},meadowFriendsCore:C,meadowWeeklyFair:{getQualityBuild:()=>quality},meadowAudio:{speak:id=>audio.push(id),play(){},stopVoice(){}},meadowLittlesAccess:{begin(){starts++;return!denied;}},meadowNextGames:{games:C.ids.map(id=>({id,name:id,person:'jade',label:'Farmer',scene:'meadow',goal:3,time:0,relaxed:true})),handles:()=>false}},document,performance:{now:()=>0},requestAnimationFrame:()=>1,cancelAnimationFrame(){},clearTimeout(){}};
 for(const name of ['play-levels.js','friends-play.js','minigames.js'])vm.runInNewContext(fs.readFileSync(root+'/'+name,'utf8'),scope,{filename:name});
 scope.window.meadowFriends.mount=run=>{selected=JSON.parse(JSON.stringify(run.game));return true;};
 const mini=scope.window.meadowMinigames;mini.attach({state:()=>state,canPlay:()=>true,save(){writes++;}});
 return{open(id){mini.open();dialog.querySelectorAll('[data-game]').find(n=>n.dataset.game===id).onclick();return dialog.querySelector('.mini-instructions').children[0];},start(){dialog.querySelector('#mini-start').onclick();},get selected(){return selected;},get dialog(){return dialog;},get starts(){return starts;},get writes(){return writes;},audio,unchanged(){assert.equal(JSON.stringify(state),before);assert.equal(writes,0);}};
}
test('Actual menu/intro/start carries Easier selection into all six mounts without rewriting records',()=>{
 for(const id of C.ids){const h=controls(89),chooser=h.open(id);assert(chooser);assert.equal(chooser.querySelector('[data-fr-level]').textContent,'Level 99');chooser.querySelector('[data-fr-easier]').onclick();chooser.querySelector('[data-fr-easier]').onclick();assert.equal(chooser.querySelector('[data-fr-level]').textContent,'Level 1');h.unchanged();h.start();assert.equal(h.selected.level,1,id);assert.equal(h.selected.friendLevel,1);assert(h.dialog.innerHTML.includes('id="mini-hint"'));h.unchanged();assert.equal(h.starts,1);const again=h.open(id);assert.equal(again.querySelector('[data-fr-level]').textContent,'Level 99','Reopening returns to the saved record, not a stale selection');h.unchanged();}
});
test('Actual quality88 route adds no difficulty UI/hint; denied play never mounts or writes',()=>{
 for(const id of C.ids){const legacy=controls(88);assert.equal(legacy.open(id),undefined);legacy.start();assert.equal(legacy.selected.level,99);assert(!legacy.dialog.innerHTML.includes('id="mini-hint"'));legacy.unchanged();const denied=controls(89,true);denied.open(id);denied.start();assert.equal(denied.selected,undefined);assert.equal(denied.starts,1);denied.unchanged();}
});
test('Actual picture scene renders two-row trays for every progressive stage and preserves legacy columns',()=>{
 const source=fs.readFileSync(root+'/friends-play.js','utf8'),anchor='window.meadowFriends={';assert.equal(source.split(anchor).length,2);
 // Expose the actual private scene function only in this disposable VM copy.
 // This checks emitted markup, not a browser layout or installed-app acceptance.
 const scope={window:{meadowFriendsCore:C,meadowWeeklyFair:{getQualityBuild:()=>89}},Promise};
 vm.createContext(scope);vm.runInContext(source.replace(anchor,'window.__testScene=scene;'+anchor),scope,{filename:'friends-play.js'});
 for(const [progressive,stages]of [[true,[[1,2,4],[4,3,6],[9,4,8],[99,4,8]]],[false,[[1,2,4],[4,2,4],[9,3,6],[99,3,6]]]])for(const [level,columns,pieces]of stages){
  const field={dataset:{},style:{setProperty(){}},classList:{add(){},remove(){}},innerHTML:'',querySelector:s=>s==='.cc-listen'?{}:null,querySelectorAll:()=>[],getBoundingClientRect:()=>({x:0,y:0,width:390,height:600})};
  const s=C.create('farmpicture',level,rng(7),0,{progressive}),before=progress(s);
  scope.window.__testScene({s,field,caption:{},voiceToken:0,run:{},pointer:null,dragNode:null});
  const tray=field.innerHTML.match(/class="fr-picture-tray" style="--cols:(\d+);--rows:(\d+)"/);assert(tray,'Actual picture scene emits tray geometry');
  assert.equal(Number(tray[1]),columns,(progressive?'progressive':'legacy')+' level'+level+' tray columns');assert.equal(Number(tray[2]),2);
  const renderedPieces=(field.innerHTML.match(/class="fr-picture-piece"/g)||[]).length;assert.equal(renderedPieces,pieces);assert.equal(Math.ceil(renderedPieces/Number(tray[1])),2,'Promised two-row tray must be reflected by the actual pieces and columns');
  assert.equal(progress(s),before,'Rendering must not place a piece or award progress');
 }
});
