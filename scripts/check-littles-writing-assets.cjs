'use strict';
require('../tools/littles-local/qa-network.cjs');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict'),root=path.resolve(__dirname,'../meadow-market-littles'),scope={window:{}},read=f=>fs.readFileSync(path.join(root,f),'utf8'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
vm.runInNewContext(read('sticker-words.js'),scope);vm.runInNewContext(read('approved-voices.js'),scope);
const words=scope.window.meadowStickerWords,clips=scope.window.meadowApprovedVoices.clips;
for(const w of words){const cue=w.audio||'ws-word-'+w.word;assert(fs.statSync(path.join(root,w.image||w.sheet)).size>1000,'Actual picture for '+w.word);assert(clips[cue]?.farmer==='rhys','Approved word voice '+w.word);assert(fs.statSync(path.join(root,'assets/audio/'+cue+'.mp3')).size>1000);}
const manifest=JSON.parse(read('assets/audio/writing101-rhys-generation.json'));assert.equal(manifest.files.length,4);
for(const file of manifest.files){const bytes=fs.readFileSync(path.join(root,'assets/audio/'+file.id+'.mp3'));assert.equal(bytes.length,file.bytes);assert.equal(sha(bytes),file.sha256);assert.equal(file.voice,'Noah - YA Audiobooks Narrator');assert.equal(file.farmer,'rhys');assert(file.listened===true);assert(file.durationSeconds>.2&&file.durationSeconds<30);assert(clips[file.id]);}
const index=read('index.html');for(const name of ['tracing-core','sticker-words','writing-trace'])assert(index.includes(name+'.js?v=1'));
assert(index.indexOf('writing-game.js')<index.indexOf('writing-trace.js'));assert(index.includes('writing-trace.css?v=1'));
const traceModule=read('writing-trace.js');assert(!traceModule.includes('speechSynthesis'));assert(traceModule.includes('>=101'));assert(traceModule.includes('legacy.open(which)'));assert(traceModule.includes("gameId()"));
const art=JSON.parse(read('assets/generated/writing/sticker-writing-generation.json'));assert.equal(art.assets.length,3);for(const asset of art.assets){const data=fs.readFileSync(path.join(root,'assets/generated/writing',asset.file));assert.equal(sha(data),asset.sha256);}
console.log(JSON.stringify({pass:true,pictureWords:words.length,newApprovedClips:manifest.files.length,artwork:art.assets.length,privateGate101:true,legacyPreserved:true}));
