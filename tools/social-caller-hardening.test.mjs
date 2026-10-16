import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
 readSocialSession, requestSocialMetrics, socialRequestFailureText,
 instagramSnapshotMetrics, observedSocialMetric
} from '../js/socialMetricsRequest.mjs';
import { facebookPostSnapshotMetrics } from '../js/socialSnapshotMetrics.mjs';
import { setSupabaseForTest } from '../js/supabaseClient.js';
import { statsnapSaveAfterSuccess } from '../js/statsnap.js';

const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
const source = Object.fromEntries(['sponsor','sponsee'].map(role=>[role,readFileSync(new URL('../js/'+role+'Offers.js',import.meta.url),'utf8').replaceAll('\r\n','\n')]));
const response = (data,status=200)=>({ok:status>=200&&status<300,status,json:async()=>data});
function extractFunction(text,name) {
 const start=text.indexOf('function '+name+'(');
 assert.ok(start>=0);
 const brace=text.indexOf('{',start);
 let depth=1;
 for(let i=brace+1;i<text.length;i++){
  if(text[i]==='{')depth++;
  if(text[i]==='}')depth--;
  if(depth===0)return new Function(text.slice(start,i+1)+';return '+name)();
 }
 throw Error('Cannot extract '+name);
}
async function flow(role,platform,{session={token:'synthetic-jwt'},data,status=200,fetchImpl,cache=null,persist=false}={}) {
 const text=source[role];
 const marker='// === '+(platform==='instagram'?'Instagram':'Facebook')+' ===';
 const start=text.indexOf(marker);
 const end=platform==='instagram'?text.indexOf('// === Facebook ===',start):text.indexOf('// Unknown / unsupported link',start);
 const block=text.slice(start,end);
 // Use delimiters rather than parsing template text in the surrounding handler.
 const catchStart=role==='sponsor'?text.indexOf('// Any unexpected error',end):-1;
 const catchEnd=role==='sponsor'?text.indexOf('\n        }\n      }',catchStart):-1;
 const catchBody=role==='sponsor'?text.slice(catchStart,catchEnd):'';
 const blocks=[],saved=[],calls=[],writes=[];
 if(persist)setSupabaseForTest({
  auth:{getSession:async()=>({data:{session:{user:{id:'synthetic-actor'}}}})},
  rpc:async()=>({data:null,error:null}),
  from(table){assert.equal(table,'stats_snapshot');return {
   select(){return this;},eq(){return this;},maybeSingle:async()=>({data:null,error:null}),
   upsert(payload){writes.push(payload);return {select:()=>({maybeSingle:async()=>({data:payload,error:null})})};}
  };}
 });
 const env={
  socialSession:session,liveUrl:'https://'+(platform==='instagram'?'instagram.com/p/test':'facebook.com/test/posts/1'),
  sponseeUserId:'creator-fixture',offerId:'offer-fixture',date:null,dateBadge:'',blocks,resultsNode:{innerHTML:''},
  isInstagramUrl:u=>/instagram\.com/.test(u),isFacebookUrl:u=>/facebook\.com/.test(u),
  requestSocialMetrics:(s,url,body)=>requestSocialMetrics(s,url,body,{timeoutMs:12,fetchImpl:async(u,o)=>{
   calls.push({url:u,options:o});return fetchImpl?fetchImpl(u,o):response(data,status);
  }}),
  instagramSnapshotMetrics,facebookPostSnapshotMetrics,socialRequestFailureText,
  statsnapSaveAfterSuccess:async p=>{saved.push(p);if(persist)await statsnapSaveAfterSuccess(p);},
  statsnapFallback:async()=>cache,
  renderSnapshotBlock:(p,l,m,d,label)=>label,
  renderFacebookPostCard:(p,m)=>JSON.stringify(m),
  fmtNum:extractFunction(text,'fmtNum'),pick:extractFunction(text,'pick'),readMetric:extractFunction(text,'readMetric'),
  container:x=>x,addBlock:x=>blocks.push(x),wrapRow:(l,v)=>l+' '+v,
  detectPlatformFromURL:()=>platform
 };
 env.link=env.liveUrl;
 const declarations='const {'+Object.keys(env).join(',')+'}=env;';
 const script=declarations+'for (const item of [1]) {'+
  (role==='sponsor'?'try {':'')+block+
  (role==='sponsor'?'} catch(error) {'+catchBody+'}':'')+'}';
 await new AsyncFunction('env',script)(env);
 return {blocks,saved,calls,writes};
}
for(const role of ['sponsor','sponsee'])for(const platform of ['instagram','facebook']){
 const label=role+' '+platform;
 test(label+' blocks missing and failed session before fetch and preserves cached auth label',async()=>{
  const failed=await readSocialSession({auth:{getSession:async()=>{throw Error('session unavailable');}}});
  for(const session of [{token:null},failed]) {
  const result=await flow(role,platform,{session,cache:{metrics:{likes:1}}});
  assert.equal(result.calls.length,0);assert.equal(result.saved.length,0);
  assert.match(result.blocks.join(' '),/cached stats/);assert.match(result.blocks.join(' '),/session could not be verified/);
  assert.doesNotMatch(result.blocks.join(' '),/Couldn.t match/);
  }
 });
 test(label+' exact payload, success contract and unknown snapshot projection',async()=>{
  const data=platform==='instagram'?{ok:true,found:true,media:{},insights:{}}:{ok:true,post:{},insights:{}};
  const result=await flow(role,platform,{data,persist:true});
  assert.equal(result.calls.length,1);assert.equal(result.saved.length,1);assert.equal(result.writes.length,1);
  const body={url:result.calls[0].url.includes('instagram')?'https://instagram.com/p/test':'https://facebook.com/test/posts/1'};
  if(role==='sponsor'){body.userId='creator-fixture';if(platform==='facebook')body.for_user_id='creator-fixture';body.offerId='offer-fixture';}
  assert.deepEqual(JSON.parse(result.calls[0].options.body),body);
  assert.equal(result.calls[0].options.headers.Authorization,'Bearer synthetic-jwt');
  assert.equal(result.calls[0].options.method,'POST');
  assert.ok(Object.values(result.saved[0].liveMetrics).every(v=>v===null));
  assert.ok(Object.values(result.writes[0].last_stats.metrics).every(v=>v===null));
  if(platform==='instagram')assert.match(result.blocks.join(' '),/Likes:[\s\S]*?-|Likes:<\/b><br>-/);
 });
 test(label+' explicit zero survives display and snapshot',async()=>{
  const data=platform==='instagram'?{ok:true,found:true,media:{like_count:0,comments_count:'0',video_views:0},insights:{impressions:0,reach:'0',saved:0,engagement:0}}:
   {success:true,data:{reaction_count:0,comment_count:'0',share_count:0},insights:{impressions:0,reach:0,engaged_users:0,post_media_view:0,post_total_media_view_unique:0}};
  const result=await flow(role,platform,{data,persist:true});
  const key=platform==='instagram'?'likes':'reactions';
  assert.equal(result.saved[0].liveMetrics[key],0);assert.equal(result.writes[0].last_stats.metrics[key],0);
  assert.match(result.blocks.join(' '),/0/);
 });
 test(label+' HTTP auth failure never renders a proven miss',async()=>{
  for(const status of [401,403]) {
  const result=await flow(role,platform,{data:{ok:true,found:false},status});
  assert.match(result.blocks.join(' '),/session could not be verified/);
  assert.doesNotMatch(result.blocks.join(' '),/Couldn.t match/);
  }
 });
 test(label+' timeout aborts once and retains cache label',async()=>{
  let signal;
  const result=await flow(role,platform,{fetchImpl:async(u,o)=>{signal=o.signal;return new Promise(()=>{});},cache:{metrics:{}}});
  assert.equal(result.calls.length,1);assert.equal(signal.aborted,true);
  assert.match(result.blocks.join(' '),/cached stats/);assert.match(result.blocks.join(' '),/timed out/);
 });
 test(label+' invalid JSON has clear failure and no success snapshot',async()=>{
  const result=await flow(role,platform,{fetchImpl:async()=>({ok:true,status:200,json:async()=>{throw Error('secret response');}})});
  assert.equal(result.saved.length,0);assert.match(result.blocks.join(' '),/unreadable response/);
  assert.doesNotMatch(result.blocks.join(' '),/secret response/);
 });
}
test('failed, rejected and hanging session reads never provide a token',async()=>{
 for(const getSession of [async()=>({error:Error('bad'),data:{session:{access_token:'old'}}}),async()=>{throw Error('failure');},async()=>new Promise(()=>{}),async()=>({data:{session:null}})]){
  assert.deepEqual(await readSocialSession({auth:{getSession}},{timeoutMs:8}),{token:null});
 }
});
test('response body read has the same bounded deadline',async()=>{
 let signal;
 await assert.rejects(requestSocialMetrics({token:'t'},'synthetic',{},{
  timeoutMs:8,fetchImpl:async(u,o)=>{signal=o.signal;return {status:200,ok:true,json:async()=>new Promise(()=>{})};}
 }),e=>e.code==='SOCIAL_TIMEOUT');
 assert.equal(signal.aborted,true);
});
test('network rejection is clear, does not retry and aborts the controller',async()=>{
 assert.equal(socialRequestFailureText({code:'constructor'}),'');
 let calls=0,signal;
 await assert.rejects(requestSocialMetrics({token:'t'},'synthetic',{}, {fetchImpl:async(u,o)=>{
  calls++;signal=o.signal;throw Error('private network detail');
 }}),error=>error.code==='SOCIAL_NETWORK'&&socialRequestFailureText(error).includes('could not be reached'));
 assert.equal(calls,1);assert.equal(signal.aborted,true);
});
test('successful read clears deadline and retains JSON response compatibility',async()=>{
 let signal;
 const result=await requestSocialMetrics({token:'t'},'synthetic',{url:'same'},{
 timeoutMs:10,fetchImpl:async(u,o)=>{signal=o.signal;return response({ok:true,found:false});}});
 assert.deepEqual(await result.json(),{ok:true,found:false});assert.equal(signal.aborted,true);
});
test('empty, malformed and absent Instagram values stay null; zero is observed',()=>{
 for(const value of [undefined,null,'','  ',false,{},-1,Infinity,'NaN'])assert.equal(observedSocialMetric(value),null);
 assert.equal(observedSocialMetric(0),0);assert.equal(observedSocialMetric('0'),0);
 assert.ok(Object.values(instagramSnapshotMetrics()).every(v=>v===null));
});
test('proven Instagram miss retains the existing match and cached labels',async()=>{
 for(const role of ['sponsor','sponsee']){
  const result=await flow(role,'instagram',{data:{ok:true,found:false}});
  assert.match(result.blocks.join(' '),/Couldn.t match/);assert.doesNotMatch(result.blocks.join(' '),/session could not/);
  const cached=await flow(role,'instagram',{data:{ok:true,found:false},cache:{metrics:{}}});
  assert.match(cached.blocks.join(' '),/cached stats/);
 }
});
