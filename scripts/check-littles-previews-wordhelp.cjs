const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../meadow-market-littles'),read=f=>fs.readFileSync(root+'/'+f,'utf8');
const previews={window:{}};vm.runInNewContext(read('game-previews.js'),previews);const registry=previews.window.meadowGamePreviews;
assert.equal(Object.keys(registry).length,69);for(const id of ['eggs','milk'])assert(!registry[id],'Original two previews stay intact');
const manifest=JSON.parse(read('assets/generated/game-previews/generation.json')),hashes=new Set();assert.equal(manifest.files.length,69);
const cache=JSON.parse(read('sw.js').match(/FILES=(\[[\s\S]*?\]);/)[1]);
for(const item of manifest.files){const file=registry[item.id],bytes=fs.readFileSync(root+'/'+file),hash=crypto.createHash('sha256').update(bytes).digest('hex');assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');assert.equal(hash,item.sha256);assert.equal(bytes.length,item.bytes);assert(!hashes.has(hash),'Every illustrated preview is distinct');hashes.add(hash);assert.equal(item.width,640);assert.equal(item.height,420);assert(cache.includes('./'+file));}
assert(cache.includes('./game-previews.js?v=2'));
const word={window:{},document:{},console};vm.runInNewContext(read('word-search.js'),word);const api=word.window.meadowWordSearch;
assert(api,'Word search exports its helpers');
assert.deepEqual(Array.from(api.wordPrompt('CAT',0).cue),['ws-letter-c','ws-letter-a','ws-letter-t','ws-word-cat']);
assert.deepEqual(Array.from(api.wordPrompt('CAT',1).cue),['ws-clue-start','ws-letter-c','ws-clue-next']);
assert.deepEqual(Array.from(api.wordPrompt('CAT',2).cue),Array.from(api.wordPrompt('CAT',0).cue));
assert.equal(api.wordPrompt('SHEEP',0).cue.filter(x=>x==='ws-letter-e').length,2);
const approved={window:{}};vm.runInNewContext(read('approved-voices.js'),approved);const clips=approved.window.meadowApprovedVoices.clips;
const vocabulary=new Set(api.topics.flatMap(t=>t.words.map(w=>w[0])).filter(w=>w.length<=5));assert.equal(vocabulary.size,136);for(const word of vocabulary)assert(clips['ws-word-'+word],'Every playable word has approved spoken help: '+word);
const generated=fs.readdirSync(root+'/assets/audio').filter(x=>/^word-audio-\d+-generation\.json$/.test(x)).flatMap(x=>JSON.parse(read('assets/audio/'+x)).files);assert.equal(generated.length,165);
assert.equal(new Set(generated.map(x=>x.id)).size,165);
for(const c of generated){assert.equal(clips[c.id]?.voice,'Noah - YA Audiobooks Narrator');assert.equal(clips[c.id]?.farmer,'rhys');assert.equal(fs.statSync(root+'/assets/audio/'+c.id+'.mp3').size,c.bytes);assert(cache.includes('./assets/audio/'+c.id+'.mp3?v=56'));}
console.log('Littles: 69 distinct illustrated previews, original two retained, 165 approved word-help clips, alternating prompts and repeated letters passed.');
