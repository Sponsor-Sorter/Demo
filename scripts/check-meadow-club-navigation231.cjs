const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('meadow-and-market/farm-club.js','utf8');

// Exercise the real view-preservation code with a replaced account panel.
const fields={
 'club-body':{scrollTop:1240},'club-item':{tagName:'SELECT',value:'milk',options:[{value:'carrot'},{value:'milk'}]},
 'club-quantity':{tagName:'INPUT',value:'12'},
 'club-speed-target':{tagName:'SELECT',value:'plot-2',options:[{value:''},{value:'plot-1'},{value:'plot-2'}]},
 'club-vip-details':{open:true},'club-speed':{disabled:false}
};
const viewContext={tab:'shop',dialog:{dataset:{tab:'shop',owner:'farm-a'}},api:{user:()=>({id:'farm-a'})},$:s=>fields[s.slice(1)]};
vm.createContext(viewContext);
vm.runInContext(source.slice(source.indexOf(' function captureView()'),source.indexOf(' function draw(){'))+';this.capture=captureView;this.restore=restoreView;',viewContext);
const saved=viewContext.capture();
fields['club-body'].scrollTop=0;fields['club-item'].value='carrot';fields['club-quantity'].value='1';fields['club-speed-target'].value='plot-1';fields['club-vip-details'].open=false;
viewContext.restore(saved);
assert.equal(fields['club-body'].scrollTop,1240);assert.equal(fields['club-item'].value,'milk');assert.equal(fields['club-quantity'].value,'12');assert(fields['club-vip-details'].open);
fields['club-speed-target'].options=[{value:''},{value:'plot-1'}];viewContext.restore(saved);
assert.equal(fields['club-speed-target'].value,'','A completed target must not silently select a different crop');assert(fields['club-speed'].disabled);
viewContext.dialog.dataset.owner='farm-b';assert.equal(viewContext.capture(),null,'Another account cannot inherit the previous panel selection');
viewContext.dialog.dataset.owner='farm-a';viewContext.tab='missions';assert.equal(viewContext.capture(),null,'A different tab starts with its own controls');

// Resolve real leaderboard requests out of order, then click the rendered prize.
(async()=>{
 const settle=()=>new Promise(setImmediate),requests=[],claims=[];let claim=null,html='',text='';
 const target={attributes:{},setAttribute(k,v){this.attributes[k]=v},get innerHTML(){return html},set innerHTML(v){html=v;text='';claim=v.includes('club-week-claim')?{addEventListener:(_,fn)=>claim.click=fn}:null},get textContent(){return text},set textContent(v){text=v;html='';claim=null}};
 const button={disabled:false},ctx={tab:'boards',boardVersion:0,board:null,game:'eggs',scope:'global',period:'previous',dialog:{open:true},$:s=>s==='#club-board'?target:s==='#club-board-refresh'?button:claim,esc:String,flushQueue:async()=>{},rpc:(action,data)=>new Promise((resolve,reject)=>requests.push({action,data,resolve,reject})),transact:(...args)=>claims.push(args)};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf(' async function loadBoard()'),source.indexOf(' function drawMissions()'))+';this.load=loadBoard;',ctx);
 const first=ctx.load();await settle();ctx.game='word_search';const second=ctx.load();await settle();
 assert(button.disabled);assert.equal(target.attributes['aria-busy'],'true');assert.equal(claim,null);
 requests[1].resolve({week:'2026-11-02',rows:[]});await second;const winningBoard=ctx.board;
 requests[0].resolve({week:'2026-10-26',rows:[]});await first;
 assert.equal(ctx.board,winningBoard,'An old response cannot overwrite the active board');assert(html.includes('2026-11-02'));assert(!html.includes('2026-10-26'));assert.equal(button.disabled,false);
 ctx.game='memory';claim.click();assert.equal(claims[0][1].game,'word_search');assert.equal(claims[0][1].week,'2026-11-02','Prize targets the game/week actually displayed');
 const failed=ctx.load();await settle();assert.equal(claim,null,'Changing filters immediately removes the old claim control');requests[2].reject(Error('Connect online'));await failed;assert.equal(text,'Connect online');assert.equal(button.disabled,false);assert.equal(target.attributes['aria-busy'],'false');
 const closed=ctx.load();await settle();ctx.dialog.open=false;requests[3].resolve({week:'2026-11-09',rows:[]});await closed;assert(!html.includes('2026-11-09'),'A closed panel ignores late data');
 console.log('Farm club navigation: retained scroll/forms/disclosures, safe missing speed target, account isolation, out-of-order boards, exact displayed prize and retry/close guards passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
