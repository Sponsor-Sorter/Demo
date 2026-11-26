import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {applyFarmCommands, FarmActionError} from '../supabase/functions/_shared/meadow-farm-actions204.ts';
import {createFarmBaseline} from '../supabase/functions/_shared/meadow-farm-origin212.ts';

// Actual consumer → command UI → durable transport → authoritative reducer.
// Only the document/storage/HTTP boundary is simulated; no real accounts/network.
const now=Date.parse('2026-11-26T04:00:00Z'),copy=(v:any)=>JSON.parse(JSON.stringify(v));
function check(value:unknown,message:string){if(!value)throw Error(message);}
function harness(chapter=2){
  let state:any=createFarmBaseline(now,{friend_code:'STORY266',display_name:'Story regression'}).save;
  state._cloudRevision=1;state.view='farm';state.mode='tend';state.xp=0;
  state.homestead={stats:{craft:4,water:1},claimed:chapter===0?['beds','campaign238-seed']:['kitchen']};
  let server=copy(state),revision=1,owner='story-owner',html='',open=false,localAwards=0,drifts=0,serial=0,rejectOnce=false,hold:any=null;
  let nodes=new Map<string,any>(),listeners=new Map<string,(event:any)=>void>();
  const messages:string[]=[],commands:any[]=[],storage=new Map<string,string>();
  const node=(key:string)=>{if(!nodes.has(key))nodes.set(key,{dataset:{},disabled:false,isConnected:true,classList:{toggle(){}},setAttribute(){},append(){},insertAdjacentHTML(){},addEventListener:(event:string,cb:any)=>listeners.set(key+':'+event,cb)});return nodes.get(key);};
  const document={hidden:false,querySelector(selector:string){
    if(selector==='#modal-dialog')return{close(){open=false;}};
    if(selector==='#modal-dialog[open] .story-guided')return open?{dataset:{storyIndex:html.match(/data-story-index="(\d+)"/)?.[1]}}:null;
    if(selector==='.story-guided .campaign-content')return node(selector);
    if(selector.startsWith('#')&&!html.includes('id="'+selector.slice(1)+'"'))return null;
    return node(selector);
  },createElement:()=>node('new')};
  const scope:any={window:{},document,localStorage:{getItem:()=>null,setItem(){}},setTimeout,clearTimeout,console};
  vm.createContext(scope);
  for(const f of ['farm-commands.js','farm-command-ui.js','story-campaign.js','story.js','story-guidance.js'])vm.runInContext(readFileSync('meadow-and-market/'+f,'utf8'),scope,{filename:f});
  const reply=(body:any)=>{commands.push(copy(body.commands));check(body.expected_revision===revision,'Transport uses current canonical revision');
    if(rejectOnce){rejectOnce=false;return{status:422,data:{error:'QA_REJECTED',message:'This action is no longer available.'}};}
    try{const result:any=applyFarmCommands(server,body.commands,now);server=result.save;revision++;
      return{status:200,data:{ok:true,request_id:body.request_id,accepted_revision:body.expected_revision+1,revision,save_data:copy(server),summary:result.summary}};
    }catch(e){if(!(e instanceof FarmActionError))throw e;return{status:422,data:{error:e.code,message:e.message}};}
  };
  const ui=scope.window.meadowCommandUI.attach({protocol:4,canonical:copy(server),revision,owner:()=>owner,state:()=>state,
    storage:{getItem:(k:string)=>storage.get(k)||null,setItem:(k:string,v:string)=>storage.set(k,v),removeItem:(k:string)=>storage.delete(k)},uuid:()=>`story266-${++serial}`,
    screen:()=>state.view,persist(){},apply:(s:any)=>state=s,render(){},notify:(text:string)=>messages.push(text),onDrift:()=>drifts++,
    send:(body:any)=>hold?new Promise(resolve=>{hold.release=()=>resolve(reply(body));}):Promise.resolve(reply(body))});
  scope.window.meadowStory.attach({state:()=>state,user:()=>({id:owner}),modal:(text:string)=>{for(const n of nodes.values())n.isConnected=false;nodes=new Map();listeners=new Map();html=text;open=true;},
    earn:(n:number)=>{localAwards++;state.coins+=n;},xp:(n:number)=>{localAwards++;state.xp+=n;},save:()=>ui.saveUI(),go(){},find(){}});
  scope.window.meadowStory.show(chapter);
  const tap=()=>{const button=node('#story-guided-action');check(!button.disabled,'Story action is retryable');listeners.get('#story-guided-action:click')?.({currentTarget:button});return button;};
  const turns=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
  return{scope,ui,messages,commands,tap,turns,state:()=>state,server:()=>server,html:()=>html,open:()=>open,localAwards:()=>localAwards,drifts:()=>drifts,
    owner:(v:string)=>owner=v,reject(){rejectOnce=true;},hold(){hold={release:null};return hold;},release(){const held=hold;hold=null;held.release();},
    async observe(change:(s:any)=>void){change(server);revision++;await ui.observe(copy(server),revision);},
    async settle(){await ui.flush();await turns();}};
}

Deno.test('Story266: background canonical replacement still sends the real verified claim once',async()=>{
  const h=harness(),rendered=h.state();await h.ui.run([{type:'shop.check',map:'willow'}],{quiet:true});
  check(h.state()!==rendered&&!h.scope.window.meadowCommandUI.stateIs(rendered),'Actual canonical response replaced identity');
  const before=h.state().coins;h.tap();await h.settle();
  check(h.commands.at(-1)[0].type==='story.claim'&&h.commands.at(-1)[0].target==='batches','Correct real command contract');
  check(h.state().homestead.claimed.filter((id:string)=>id==='batches').length===1,'One canonical story reward');
  check(h.state().coins===before+160&&h.state().xp===30,'Only authoritative reward values');
  check(!h.localAwards()&&!h.drifts()&&!h.messages.some(m=>m.includes('updated game')),'No local awards or drift rollback');
  check(h.html().includes('Open for business'),'Same chapter advances after canonical receipt');
});
Deno.test('Story266: another receipt already claimed the goal before the tap',async()=>{
  const h=harness();await h.observe(s=>{const result:any=applyFarmCommands(s,[{type:'story.claim',target:'batches',map:'willow',data:{}}],now);Object.assign(s,result.save);});
  h.tap();await h.turns();check(h.commands.length===0&&!h.localAwards(),'Stale ready button cannot replay a claimed goal');
  check(h.html().includes('Open for business'),'Refreshes to the current next step');
});
Deno.test('Story266: progress and campaign eligibility are rechecked at the tap',async()=>{
  const progress=harness();await progress.observe(s=>s.homestead.stats.craft=0);progress.tap();await progress.turns();
  check(!progress.commands.length&&!progress.localAwards()&&progress.html().includes('Show me where'),'No stale ready claim after canonical correction');
  const ordered=harness(0);await ordered.observe(s=>s.homestead.claimed=[]);ordered.tap();await ordered.turns();
  check(!ordered.commands.length&&!ordered.localAwards(),'Earlier campaign requirements remain authoritative');
});
Deno.test('Story266: account change or required/waiting verification never permits local awards',async()=>{
  const account=harness();account.owner('another-owner');account.tap();await account.turns();
  check(!account.commands.length&&!account.localAwards()&&!account.open(),'Old account button closes without acting');
  const waiting=harness();waiting.scope.window.meadowCommandUI.stop();waiting.scope.window.meadowCommandUI.setWaiting(true);waiting.tap();await waiting.turns();
  check(!waiting.commands.length&&!waiting.localAwards(),'Waiting online farm never uses the legacy award path');
});
Deno.test('Story266: busy mapper refusal leaves the button retryable after background work',async()=>{
  const h=harness();h.hold();const pending=h.ui.run([{type:'shop.check',map:'willow'}],{quiet:true});await h.turns();
  const button=h.tap();await h.turns();check(button.disabled===false&&!h.localAwards()&&h.commands.length===0,'Busy rejection reenables without a local claim');
  h.release();await pending;h.tap();await h.settle();check(h.state().homestead.claimed.includes('batches'),'Normal retry succeeds on the current state');
});
Deno.test('Story266: actual transport rejection reenables the action for an explicit retry',async()=>{
  const h=harness();h.reject();const button=h.tap();try{await h.settle();}catch{}await h.turns();
  check(button.disabled===false&&!h.localAwards()&&!h.state().homestead.claimed.includes('batches'),'Rejected claim does not mint or strand the button');
  h.tap();await h.settle();check(h.state().homestead.claimed.includes('batches')&&!h.drifts(),'A fresh explicit retry uses the same verified path');
});
