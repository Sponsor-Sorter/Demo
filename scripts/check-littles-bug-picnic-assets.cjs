'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../meadow-market-littles'),read=f=>fs.readFileSync(path.join(root,f),'utf8'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const index=read('index.html'),sw=read('sw.js'),voices={window:{}};vm.runInNewContext(read('approved-voices.js'),voices);
const audio=JSON.parse(read('assets/audio/bug99-rhys-generation.json'));
assert.equal(audio.files.length,3);
for(const clip of audio.files){
 const bytes=fs.readFileSync(path.join(root,'assets/audio',clip.id+'.mp3'));
 assert.equal(bytes.length,clip.bytes);assert.equal(sha(bytes),clip.sha256);assert.equal(clip.voice,voices.window.meadowApprovedVoices.cast.rhys);
 assert.equal(clip.farmer,'rhys');assert.equal(clip.model,'Eleven Multilingual v2');assert.equal(voices.window.meadowApprovedVoices.clips[clip.id].farmer,'rhys');
 assert(clip.durationSeconds>2&&clip.durationSeconds<12);assert(sw.includes('./assets/audio/'+clip.id+'.mp3?v=56'));
}
for(const file of ['bug-picnic-core.js','bug-picnic-paint.js','bug-picnic.js','bug-picnic.css']){assert(index.includes(file+'?v=1'));assert(sw.includes('./'+file+'?v=1'));}
for(const name of ['ground','food','preview']){const file='assets/generated/bug-picnic/'+name+'.webp';assert(fs.statSync(path.join(root,file)).size>10000);assert(sw.includes('./'+file));}
const fixture=fs.readFileSync(path.resolve(root,'../tools/littles-local/bug-picnic-qa.html'),'utf8');
for(const css of index.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g))assert(fixture.includes(css[0]));
assert(read('bug-picnic.js').includes('n>=99'));assert(read('app.js').includes('n>=96'));
assert(read('bug-picnic.css').includes('.bsm-dialog.bsm-picnic .bsm-field{margin-top:0}'));
assert(!read('bug-picnic.css').includes('garden-portrait'));
console.log('Picnic assets: three exact approved Noah clips, complete new image/code/audio cache requests, all-production-stylesheet fixture and separate legacy/private routing passed.');
