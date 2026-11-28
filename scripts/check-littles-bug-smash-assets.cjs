'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../meadow-market-littles'),read=p=>fs.readFileSync(path.join(root,p),'utf8'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const index=read('index.html'),sw=read('sw.js'),voiceCtx={window:{}};vm.runInNewContext(read('approved-voices.js'),voiceCtx);
const manifest=JSON.parse(read('assets/audio/bug-rhys-generation.json')),approved=voiceCtx.window.meadowApprovedVoices;
assert.equal(manifest.files.length,7);
for(const name of ['intro','armour','acorn','bubble','tickle','tummy','done']){
 const id='bug-rhys-'+name,record=manifest.files.find(x=>x.id===id);assert(record,'Instruction has provenance: '+id);
 const file=fs.readFileSync(path.join(root,'assets/audio',id+'.mp3'));assert.equal(file.length,record.bytes);assert.equal(sha(file),record.sha256);
 assert.equal(record.farmer,'rhys');assert.equal(record.voice,approved.cast.rhys);assert.equal(record.model,'Eleven Multilingual v2');assert.equal(approved.clips[id]?.farmer,'rhys');
 assert(sw.includes('./assets/audio/'+id+'.mp3?v=56'),'Exact runtime audio request is cached: '+id);
 assert(record.durationSeconds>1&&record.durationSeconds<20,'Instruction duration is bounded: '+id);
}
for(const [file,version] of [['bug-smash-core.js',1],['bug-smash-paint.js',1],['bug-smash.js',2],['bug-smash.css',3],['celebration.js',2]]){assert(index.includes(file+'?v='+version));assert(sw.includes('./'+file+'?v='+version));}
for(const file of ['garden.webp','garden-portrait.webp','preview.webp']){assert(fs.statSync(path.join(root,'assets/generated/bug-smash',file)).size>10000);assert(sw.includes('./assets/generated/bug-smash/'+file));}
assert(index.includes('weekly-fair.js?v=4')&&sw.includes('./weekly-fair.js?v=4'));
const voiceScript=index.match(/src="(approved-voices\.js\?v=(\d+))"/);
assert(voiceScript&&Number(voiceScript[2])>=20&&sw.includes('./'+voiceScript[1]),'Current approved voice registry is cached with the same version');
// Both activities are loaded together in production; their component classes must not overlap.
const classes=css=>new Set([...css.matchAll(/\.([a-z][a-z0-9]*-[\w-]+)/g)].map(m=>m[1]));
const beeClasses=classes(read('bee-shelter.css'));
assert.deepEqual([...classes(read('bug-smash.css'))].filter(name=>beeClasses.has(name)),[],'Bug Smash must not inherit Bee Shelter component rules');
const fixture=fs.readFileSync(path.resolve(root,'../tools/littles-local/bug-smash-qa.html'),'utf8');
for(const match of index.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g))assert(fixture.includes(match[0]),'The local QA page must exercise every production stylesheet: '+match[0]);
console.log('Bug Smash assets: all7 approved Rhys recordings have exact byte/hash provenance; complete scene/code/audio offline request closure and version agreement passed.');
