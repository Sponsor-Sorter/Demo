import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {refreshBrowserBuild,refreshBrowserBuilds} from '../js/gamesCatalogue.mjs';

const target=(name='meadow-and-market',build=74)=>({dataset:{releaseManifest:`./${name}/release.json`},textContent:`Browser build ${build}`});
const response=build=>({ok:true,json:async()=>({build})});
function fallbackRuntime(fetchImpl) {
  const timers=[],cleared=[];
  return {AbortSignal:{},AbortController,fetch:fetchImpl,timers,cleared,
    setTimeout(callback,ms){timers.push({callback,ms});return timers.length-1;},
    clearTimeout(id){cleared.push(id);}};
}

test('missing AbortSignal.timeout refreshes both entries and clears fallback timers',async()=>{
  const entries=[target(),target('meadow-market-littles',5)],calls=[];
  const runtime=fallbackRuntime(async(url,options)=>{calls.push({url,options});return response(url.includes('littles')?22:171);});
  await refreshBrowserBuilds(entries,runtime);
  assert.deepEqual(entries.map(e=>e.textContent),['Browser build 171','Browser build 22']);
  assert.equal(calls.length,2);
  assert.ok(calls.every(c=>c.options.cache==='no-store'&&c.options.signal instanceof AbortSignal));
  assert.deepEqual(runtime.timers.map(t=>t.ms),[8000,8000]);
  assert.deepEqual(runtime.cleared,[0,1]);
});

test('absent AbortSignal object uses AbortController fallback',async()=>{
  const entry=target(),runtime=fallbackRuntime(async()=>response(171));
  delete runtime.AbortSignal;
  await refreshBrowserBuild(entry,runtime);
  assert.equal(entry.textContent,'Browser build 171');
  assert.deepEqual(runtime.cleared,[0]);
});

test('synchronous first-entry fetch failure does not block second entry',async()=>{
  const entries=[target(),target('meadow-market-littles',5)];
  const runtime=fallbackRuntime(url=>{if(!url.includes('littles'))throw TypeError('fixture failure');return Promise.resolve(response(22));});
  await refreshBrowserBuilds(entries,runtime);
  assert.deepEqual(entries.map(e=>e.textContent),['Browser build 74','Browser build 22']);
  assert.deepEqual(runtime.cleared,[0,1]);
});

test('supported native timeout updates labels without allocating fallback timers',async()=>{
  const entries=[target(),target('meadow-market-littles',5)],signals=[],durations=[];
  const runtime=fallbackRuntime(async(url,options)=>{signals.push(options.signal);return response(url.includes('littles')?22:171);});
  const signal=new AbortController().signal;
  runtime.AbortSignal={timeout(ms){durations.push(ms);return signal;}};
  await refreshBrowserBuilds(entries,runtime);
  assert.deepEqual(entries.map(e=>e.textContent),['Browser build 171','Browser build 22']);
  assert.deepEqual(durations,[8000,8000]);
  assert.deepEqual(signals,[signal,signal]);
  assert.deepEqual(runtime.timers,[]);
  assert.deepEqual(runtime.cleared,[]);
});

test('fallback timeout aborts request, preserves snapshot and cleans timer',async()=>{
  const entry=target();
  const runtime=fallbackRuntime((url,{signal})=>new Promise((resolve,reject)=>{
    signal.addEventListener('abort',()=>reject(Error('fixture abort')),{once:true});
  }));
  const pending=refreshBrowserBuild(entry,runtime);
  runtime.timers[0].callback();
  await pending;
  assert.equal(entry.textContent,'Browser build 74');
  assert.deepEqual(runtime.cleared,[0]);
});

test('rejected JSON and HTTP failure preserve snapshots and clean timers',async()=>{
  for(const result of [{ok:true,json:async()=>{throw SyntaxError('fixture JSON');}},{ok:false,json:async()=>{throw Error('must not parse');}}]){
    const entry=target(),runtime=fallbackRuntime(async()=>result);
    await refreshBrowserBuild(entry,runtime);
    assert.equal(entry.textContent,'Browser build 74');
    assert.deepEqual(runtime.cleared,[0]);
  }
});

test('invalid manifests and invalid builds never replace snapshot labels',async()=>{
  let calls=0;
  const runtime=fallbackRuntime(async()=>{calls++;return response('171');});
  const invalid=target('../outside');
  await refreshBrowserBuild(invalid,runtime);
  assert.equal(calls,0);
  assert.deepEqual(runtime.timers,[]);
  const entry=target();
  await refreshBrowserBuild(entry,runtime);
  assert.equal(entry.textContent,'Browser build 74');
  assert.deepEqual(runtime.cleared,[0]);
});

test('legacy browser without abort APIs can still refresh manifest',async()=>{
  const entry=target(),runtime={fetch:async()=>response(171)};
  await refreshBrowserBuild(entry,runtime);
  assert.equal(entry.textContent,'Browser build 171');
});

test('actual module bootstrap survives absent timeout support',async()=>{
  const entries=[target(),target('meadow-market-littles',5)],calls=[];
  const runtime=fallbackRuntime(async(url)=>{calls.push(url);return response(url.includes('littles')?22:171);});
  const source=readFileSync(new URL('../js/gamesCatalogue.mjs',import.meta.url),'utf8').replace(/^export /gm,'');
  vm.runInNewContext(source,{...runtime,document:{querySelectorAll:()=>entries}},{timeout:1000});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(calls.length,2);
  assert.deepEqual(entries.map(e=>e.textContent),['Browser build 171','Browser build 22']);
  assert.deepEqual(runtime.cleared,[0,1]);
});
