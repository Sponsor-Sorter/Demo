'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
function fixture({available=true}={}){
 class Node{constructor(tag){this.tag=tag;this.children=[];this.attrs={};this.hidden=false;this.disabled=false;this.textContent='';}setAttribute(k,v){this.attrs[k]=v;}append(...ns){for(const n of ns){n.parent=this;this.children.push(n);}}remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}find(attr){return Object.hasOwn(this.attrs,attr)?this:this.children.map(n=>n.find(attr)).find(Boolean);}}
 const env={document:{createElement:tag=>new Node(tag)}};env.window=env;vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../meadow-market-littles/internal-ad-testing.js'),'utf8'),env);
 let live=true,sequence=0,generation=0,hold=null;const calls={sample:0,timing:0,refresh:0,cancel:0},container=new Node('main');
 const adapter={cancelDiagnostic:()=>{calls.cancel++;},refreshDiagnostics:async()=>{calls.refresh++;},diagnosticsAvailable:()=>available,diagnosticAdAvailable:()=>available,diagnosticAd:async(...args)=>{assert.equal(args.length,0);calls.sample++;if(hold)await hold;generation++;return{closed:true,diagnosticKind:'demo',diagnosticGeneration:generation};},diagnostics:async request=>{calls.timing++;return{contract:'littles-ad-timing-v1',request,sequence:++sequence,generation,kind:generation?'demo':'none',terminal:generation>0,sampledMs:generation?4000:0,events:generation?[{code:'shown',ms:100},{code:'dismissed',ms:4000}]:[]};}};
 const mount=options=>env.meadowLittlesAdTesting.mount(container,adapter,{entry:true,active:()=>live,...options});
 return{container,adapter,calls,mount,setLive:v=>live=v,holdSample:p=>hold=p};
}
test('Web/no diagnostic capability creates no Settings entry or sample controls',async()=>{for(const available of [false]){const f=fixture({available}),dispose=f.mount();await dispose.ready;assert.equal(f.container.children.length,0);assert.deepEqual(f.calls,{sample:0,timing:0,refresh:1,cancel:0});}});
test('Grown-up entry expands only on tap; a sample cannot claim or add a game round',async()=>{
 const f=fixture(),dispose=f.mount();await dispose.ready;const entry=f.container.find('data-internal-ad-testing-entry');assert(entry);const controls=entry.parent.children[1];assert(controls.hidden);entry.onclick();assert(!controls.hidden);assert.equal(entry.attrs['aria-expanded'],'true');
 const sample=f.container.find('data-sample-ad');await sample.onclick();assert.equal(f.calls.sample,1);assert.match(f.container.find('data-ad-timing').textContent,/No game round was added/);await f.container.find('data-sample-ad-timing').onclick();assert.match(f.container.find('data-ad-timing').textContent,/generation 1; kind demo/);dispose();assert.equal(f.container.children.length,0);
});
test('Timing display rejects wrong request, repeated snapshot, inconsistent generation and duplicate events',async()=>{
 const f=fixture(),dispose=f.mount();await dispose.ready;const button=f.container.find('data-sample-ad-timing'),output=f.container.find('data-ad-timing');await button.onclick();assert.match(output.textContent,/generation 0; kind none/);
 for(const change of [v=>({...v,request:v.request-1}),v=>({...v,sequence:1}),v=>({...v,kind:'none',generation:1}),v=>({...v,kind:'demo',generation:1,events:[{code:'shown',ms:0},{code:'shown',ms:0}]})]){f.adapter.diagnostics=async request=>change({contract:'littles-ad-timing-v1',request,sequence:50,generation:0,kind:'none',sampledMs:0,terminal:false,events:[]});await button.onclick();assert.equal(output.textContent,'Timing unavailable.');}
});
test('Close/account-change during discovery or sample discards late UI results and repeat taps',async()=>{
 const a=fixture();let ready;a.adapter.refreshDiagnostics=()=>new Promise(r=>ready=r);const disposed=a.mount();disposed();ready();await disposed.ready;assert.equal(a.container.children.length,0);
 const f=fixture();let release;f.holdSample(new Promise(r=>release=r));const dispose=f.mount();await dispose.ready;const sample=f.container.find('data-sample-ad'),output=f.container.find('data-ad-timing'),pending=sample.onclick();await sample.onclick();assert.equal(f.calls.sample,1);f.setLive(false);dispose();assert.equal(f.calls.cancel,1);release();await pending;assert.equal(output.textContent,'Loading official sample…');assert.equal(f.container.children.length,0);
});
test('Settings integration is behind the normal parent gate and both views dispose their shared panel',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../meadow-market-littles/commerce.js'),'utf8');assert(source.includes('open:()=>gate(parents)'));assert(source.includes('entry:true,active:()=>token===epoch&&diagnosticStamp===authEpoch&&dialog.open'));assert(source.includes('disposed=true;timingUnmount?.()'));
 const java=fs.readFileSync(path.join(__dirname,'../tools/meadow-littles-android/android/app/src/main/java/com/meadowmarket/littles/LittlesAdsPlugin.java'),'utf8');assert(java.includes('showRewardedUnit(call,"ca-app-pub-3940256099942544/5354046379",null)'));assert(java.includes('if(!BuildConfig.LITTLES_AD_DIAGNOSTICS)'));
});
