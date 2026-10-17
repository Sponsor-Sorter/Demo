import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const source = readFileSync(new URL('../js/settings.js', import.meta.url), 'utf8');
const start = source.indexOf('  async function callFn(name){');
const end = source.indexOf('\n  // Only call stats functions', start);
const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
function harness({jwt='fixture-token', response={ok:true,json:async()=>({success:true})}, timeout=false}={}) {
  const calls=[];
  const run = new AsyncFunction('jwt','headers','aff_functionsBase','fetch','AbortController','setTimeout','clearTimeout','name',source.slice(start,end)+'\nreturn callFn(name);');
  return {calls, run:(name)=>run(jwt,{},()=> 'https://fixture.invalid/functions/v1',async(url,options)=>{calls.push({url,...options});return response;},AbortController,timeout ? (fn)=>setTimeout(fn,1) : setTimeout,clearTimeout,name)};
}
test('TikTok uses GET and accepts v27 success envelope',async()=>{const h=harness();await h.run('get-tiktok-stats');assert.equal(h.calls[0].method,'GET');assert.equal(h.calls.length,1);});
for(const [name,days] of [['get-instagram-stats',7],['get-facebook-page-insights',28]]) test(name+' sends its period',async()=>{const h=harness();await h.run(name);assert.equal(h.calls[0].method,'POST');assert.deepEqual(JSON.parse(h.calls[0].body),{period_days:days});});
for(const data of [{success:false,error:'not_connected'},{ok:false},{error:'failure'},null,[]]) test('reject application failure '+JSON.stringify(data),async()=>{const h=harness({response:{ok:true,json:async()=>data}});await assert.rejects(h.run('get-tiktok-stats'));assert.equal(h.calls.length,1);});
test('missing session makes no request',async()=>{const h=harness({jwt:null});await assert.rejects(h.run('get-tiktok-stats'));assert.equal(h.calls.length,0);});
test('HTTP failure does not retry with another method',async()=>{const h=harness({response:{ok:false,status:503}});await assert.rejects(h.run('get-youtube-stats'),/503/);assert.equal(h.calls.length,1);});
test('deadline covers stalled JSON body and aborts',async()=>{const h=harness({timeout:true,response:{ok:true,json:()=>new Promise(()=>{})}});await assert.rejects(h.run('get-tiktok-stats'),/timed out/);assert.equal(h.calls[0].signal.aborted,true);});
test('malformed JSON fails without retry',async()=>{const h=harness({response:{ok:true,json:async()=>{throw new SyntaxError('bad JSON')}}});await assert.rejects(h.run('get-tiktok-stats'));assert.equal(h.calls.length,1);});
