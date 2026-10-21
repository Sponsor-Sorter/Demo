const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),cp=require('child_process'),root=path.resolve(__dirname,'../meadow-market-littles');
const read=f=>fs.readFileSync(root+'/'+f,'utf8');for(const f of fs.readdirSync(root).filter(f=>f.endsWith('.js')))new vm.Script(read(f),{filename:f});
const sandbox={window:{addEventListener(){}},document:{addEventListener(){}},console};for(const f of ['play-levels.js','tractor-repair.js','art-scenes.js','art-core.js','art-studio.js','minigames.js','animal-care.js'])vm.runInNewContext(read(f),sandbox,{filename:f});
const games=sandbox.window.meadowMinigames.games;assert.equal(games.length,14);for(const g of games){assert(fs.existsSync(root+'/assets/generated/minigames/'+g.scene+'.webp'),'Missing card '+g.id)}
const scenes=sandbox.window.meadowArtScenes;assert.equal(scenes.length,38);assert.equal(scenes.filter(s=>s.detailed).length,27);for(const s of scenes){const dir=s.detailed?'art-scenes':'art-simple',data=JSON.parse(read('assets/generated/'+dir+'/'+s.id+'.json'));for(const ext of ['-line.webp','-preview.webp','-thumb.webp','-mask.png'])assert(fs.existsSync(root+'/assets/generated/'+dir+'/'+s.id+ext));for(const r of data.regions)assert(r.paint<data.palette.length)}
for(const g of games.filter(g=>!g.artist)){const level=sandbox.window.meadowPlayLevels.levelGame(g,12);assert(level.goal>=g.goal)}const deck=sandbox.window.meadowPlayLevels.deck(18);assert.equal(deck.length,36);for(const id of new Set(deck))assert.equal(deck.filter(v=>v===id).length,2);
const animal=sandbox.window.meadowAnimalCare;for(const type of ['chicken','cow','sheep','goat','alpaca'])for(const action of ['feed','brush','play']){const p=animal.plan({type},action,true);assert(p.voice&&Object.keys(p.tasks).length);assert(fs.existsSync(root+'/assets/audio/'+p.voice+'.mp3'))}
const missing=new Set;for(const f of fs.readdirSync(root).filter(f=>/\.(?:html|css|js)$/.test(f)))for(const m of read(f).matchAll(/assets\/[\w/.-]+\.(?:webp|png|svg|mp3)/g))if(!fs.existsSync(root+'/'+m[0]))missing.add(m[0]);assert.equal([...missing].join('\n'),'','Missing static assets');
assert(!read('index.html').includes('game.js?v='));assert(!read('app.js').includes('meadow-market-save'));assert(read('audio.js').includes('meadow-littles-audio'));assert(read('art-studio.js').includes('meadow-littles-art'));assert(read('sw.js').includes('meadow-littles-v'+JSON.parse(read('release.json')).build));
console.log('Littles: 14 games, 38 art pages, care plans, level progression, shuffled pairs, isolated saves and static asset closure passed.');

require("./check-littles-art.cjs");


require("./check-littles-together.cjs");
