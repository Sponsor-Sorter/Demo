import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadCampaignRecap, validateCampaignRecap } from '../js/campaignRecapClient.mjs';
import { isCompletedForRecap, listCompletedRecapOffers, renderRecapChoices } from '../js/recaps.js';
const id='00000000-0000-4000-8000-000000000001';
const actor='00000000-0000-4000-8000-000000000002';
const pdf='%PDF-1.4\nfixture\n%%EOF';
const valid=(changes={})=>({url:'data:application/pdf;base64,'+btoa(pdf),error:null,documentType:'campaign-recap',documentId:'campaign-recap:'+id+':v1',generated_at:'2026-10-18T03:00:00Z',metrics_source:'stored_unverified_observations',provider_refreshed:false,financial_evidence:false,...changes});
const client=(invoke=async()=>({data:valid()}))=>({auth:{getSession:async()=>({data:{session:{user:{id:actor},access_token:'fixture-token'}}})},functions:{invoke}});

test('real session and exact offer body reach SDK once, never act_as',async()=>{
 let calls=0;
 const result=await loadCampaignRecap(client(async(name,options)=>{
  calls++;assert.equal(name,'generate_campaign_recap');assert.deepEqual(options.body,{offer_id:id});assert.equal(options.headers.Authorization,'Bearer fixture-token');assert.ok(options.signal instanceof AbortSignal);return {data:valid()};
 }),id);
 assert.equal(calls,1);assert.equal(new TextDecoder().decode(result.bytes),pdf);
});
test('anonymous and invalid IDs never invoke generation',async()=>{
 const api=client(()=>assert.fail('no request'));
 for(const value of [1,'123',null,'',id+'?x=1'])await assert.rejects(loadCampaignRecap(api,value));
 api.auth.getSession=async()=>({data:{session:null}});await assert.rejects(loadCampaignRecap(api,id),/Sign in/);
});
test('non-success HTTP, SDK error, thrown provider details and malformed replies fail safely',async()=>{
 for(const reply of [{data:valid(),response:{ok:false}},{data:valid(),error:Error('private')},{data:null},null]) await assert.rejects(loadCampaignRecap(client(async()=>reply),id),error=>!error.message.includes('private'));
 await assert.rejects(loadCampaignRecap(client(async()=>{throw Error('private credential');}),id),error=>!error.message.includes('credential'));
});
test('strict metadata rejects stale contracts and claims of refreshed or financial evidence',()=>{
 for(const patch of [{error:'bad'},{documentType:'invoice'},{documentId:''},{generated_at:'bad'},{metrics_source:'provider_verified'},{provider_refreshed:true},{financial_evidence:true}])assert.throws(()=>validateCampaignRecap(valid(patch)));
});
test('only bounded base64 PDF is accepted, never arbitrary navigation or HTML',()=>{
 for(const url of ['https://example.com/a.pdf','javascript:alert(1)','data:text/html;base64,'+btoa('<html>'),'data:application/pdf;base64,%%%','data:application/pdf;base64,'+btoa('not PDF'),'data:application/pdf;base64,'+btoa('%PDF-1.4 missing end'),'data:application/pdf;base64,'+'A'.repeat(4194308)])assert.throws(()=>validateCampaignRecap(valid({url})));
});
test('deadline covers stalled auth or SDK and aborts without retry',async()=>{
 const original=globalThis.setTimeout;globalThis.setTimeout=(fn,ms)=>original(fn,ms===25000?5:ms);
 try {
  let calls=0,signal;
  await assert.rejects(loadCampaignRecap({auth:{getSession:()=>new Promise(()=>{})}},id));
  await assert.rejects(loadCampaignRecap(client((_name,options)=>{calls++;signal=options.signal;return new Promise(()=>{});}),id));
  assert.equal(calls,1);assert.equal(signal.aborted,true);
 } finally {globalThis.setTimeout=original;}
});
test('modal cancellation aborts in-flight request',async()=>{
 const controller=new AbortController();let seen;
 const pending=loadCampaignRecap(client((_name,options)=>{seen=options.signal;return new Promise(()=>{});}),id,{signal:controller.signal});
 await new Promise(resolve=>setImmediate(resolve));controller.abort();await assert.rejects(pending);assert.equal(seen.aborted,true);
});
test('completion eligibility preserves existing completed statuses only',()=>{
 for(const offer of [{stage:5},{stage:'5'},{status:'completed'},{status:'REVIEW_COMPLETED'},{status:'review-completed'}])assert.equal(isCompletedForRecap(offer),true);
 for(const offer of [{stage:2,status:'accepted'},{status:'not completed'},{status:'Offer Cancelled'}])assert.equal(isCompletedForRecap(offer),false);
});
test('offer list deduplicates identities and propagates query failures',async()=>{
 const chain={select(){return this;},in:async()=>({data:[{id,stage:5}]}),eq:async()=>({data:[{id,stage:5},{id:actor,stage:1}]})};
 assert.equal((await listCompletedRecapOffers({from:()=>chain},{id:actor,user_id:actor,email:'fixture@example.test'})).length,1);
 chain.in=async()=>({error:Error('private')});await assert.rejects(listCompletedRecapOffers({from:()=>chain},{id:actor}),/Offers could not/);
});

class Element {
 constructor(tag){this.tag=tag;this.children=[];this.handlers={};this.attributes={};this._text='';}
 append(...values){this.children.push(...values);}
 replaceChildren(...values){this.children=[];this._text='';this.append(...values);}
 set textContent(value){this._text=String(value);this.children=[];}
 get textContent(){return this._text+this.children.map(child=>child.textContent||'').join('');}
 setAttribute(name,value){this.attributes[name]=value;}
 addEventListener(name,callback){this.handlers[name]=callback;}
 contains(value){return this===value||this.children.some(child=>child.contains?.(value));}
}
function descendants(node,tag){return node.children.flatMap(child=>[...(child.tag===tag?[child]:[]),...descendants(child,tag)]);}
test('safe DOM, per-row other party, PDF link and button guard work without popup',async()=>{
 const original=globalThis.document,create=URL.createObjectURL,revoke=URL.revokeObjectURL;
 globalThis.document={createElement:tag=>new Element(tag)};let requests=0;URL.createObjectURL=()=> 'blob:fixture';URL.revokeObjectURL=()=>{};
 try {
  const host=new Element('div');let resolve;
  renderRecapChoices(host,[{id,stage:5,sponsor_id:actor,sponsee_username:'<img onerror=bad>',offer_title:'<script>bad</script>',offer_amount:0},{id:actor,stage:5,sponsee_id:actor,sponsor_username:'Other sponsor',offer_amount:null}],{user_id:actor},{generate:()=>{requests++;return new Promise(done=>{resolve=done;});}});
  assert.match(host.textContent,/<script>bad/);assert.equal(descendants(host,'img').length,0);assert.match(host.textContent,/Other sponsor/);assert.match(host.textContent,/\$0.00/);assert.match(host.textContent,/Unknown/);
  const button=descendants(host,'button')[0];const pending=button.handlers.click();await button.handlers.click();assert.equal(requests,1);
  resolve(validateCampaignRecap(valid()));await pending;
  const link=descendants(host,'a')[0];assert.equal(link.href,'blob:fixture');assert.equal(link.rel,'noopener noreferrer');assert.equal(button.disabled,false);
 }finally{globalThis.document=original;URL.createObjectURL=create;URL.revokeObjectURL=revoke;}
});
test('recap production source has no arbitrary actor, raw HTML, popup or invoice edits',()=>{
 const source=readFileSync(new URL('../js/recaps.js',import.meta.url),'utf8');assert.doesNotMatch(source,/act_as|innerHTML|window.open|generate_invoice_pdf/);assert.match(source,/revokeObjectURL/);assert.match(source,/controller\?\.abort/);
});

test('document identity is bound to requested campaign and UTC offset timestamps are valid',()=>{
 assert.throws(()=>validateCampaignRecap(valid(),actor));
 assert.ok(validateCampaignRecap(valid({generated_at:'2026-10-18T03:00:00.000000+00:00'}),id));
});
