const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),cp=require('child_process'),root=path.resolve(__dirname,'../meadow-market-littles');
const read=f=>fs.readFileSync(root+'/'+f,'utf8');for(const f of fs.readdirSync(root).filter(f=>f.endsWith('.js')))new vm.Script(read(f),{filename:f});
const sandbox={window:{addEventListener(){}},document:{addEventListener(){}},console};for(const f of ['play-levels.js','tractor-repair.js','art-scenes.js','art-core.js','art-studio.js','next-games.js','minigames.js','animal-care.js'])vm.runInNewContext(read(f),sandbox,{filename:f});
const games=sandbox.window.meadowMinigames.games;assert.equal(games.length,27);const memoryCode=read('minigames.js');assert(memoryCode.includes("board.dataset.deck!==r.deck.join(',')"),'Memory cards are created once and updated in place');assert(memoryCode.includes('drawMemory(r);layoutScene()'),'Memory grid sizing runs only after its board exists');assert.equal(sandbox.window.meadowNextGames.games.length,12);for(const g of games){assert(fs.existsSync(root+'/assets/generated/minigames/'+g.scene+'.webp'),'Missing card '+g.id)}for(const g of sandbox.window.meadowNextGames.games){assert(g.text&&g.voice&&g.kind,'Game has its own loop brief and audio: '+g.id);assert(fs.existsSync(root+'/assets/generated/minigames/'+g.scene+'.webp'),'Missing full-screen scene '+g.id);assert(fs.existsSync(root+'/assets/audio/'+g.voice+'.mp3'),'Missing Farmer guide audio '+g.voice)}
const scenes=sandbox.window.meadowArtScenes;assert.equal(scenes.length,48);assert.equal(scenes.filter(s=>s.detailed).length,27);assert.equal(scenes.filter(s=>s.vector).length,0);for(const s of scenes){const dir=s.vector?'art-vector':s.detailed?'art-scenes':'art-simple',data=JSON.parse(read('assets/generated/'+dir+'/'+s.id+'.json'));if(s.vector){for(const ext of ['-line.svg','-preview.svg','-mask.svg'])assert(fs.existsSync(root+'/assets/generated/'+dir+'/'+s.id+ext));assert(data.regions.length>=8,`Scene has enough fill regions: ${s.id}`)}else for(const ext of ['-line.webp','-preview.webp','-thumb.webp','-mask.png'])assert(fs.existsSync(root+'/assets/generated/'+dir+'/'+s.id+ext));for(const r of data.regions)assert(r.paint<data.palette.length)}
const noColour={mask:new Uint8Array(512*512),data:{regions:[{id:1,paint:0}]},paint:new Uint8ClampedArray(512*512*4),mode:'matchpainting',tool:'bucket',color:null,changed:false};noColour.mask[20*512+20]=1;sandbox.window.meadowArtCore.stamp(noColour,20,20);assert.equal(noColour.paint[(20*512+20)*4+3],0,'Bucket does not paint before a palette colour is chosen');assert.equal(noColour.message,'Choose a colour first.');
for(const g of games.filter(g=>!g.artist)){const level=sandbox.window.meadowPlayLevels.levelGame(g,12);assert(level.goal>=g.goal)}const deck=sandbox.window.meadowPlayLevels.deck(18);assert.equal(deck.length,36);for(const id of new Set(deck))assert.equal(deck.filter(v=>v===id).length,2);
const animal=sandbox.window.meadowAnimalCare;for(const type of ['chicken','cow','sheep','goat','alpaca'])for(const action of ['feed','brush','play']){const p=animal.plan({type},action,true);assert(p.voice&&Object.keys(p.tasks).length);assert(fs.existsSync(root+'/assets/audio/'+p.voice+'.mp3'))}
vm.runInNewContext(read('world-play.js'),sandbox,{filename:'world-play.js'});const worldGames=sandbox.window.meadowWorldPlay.games;assert.equal(worldGames.length,20,'the ten established farm worlds plus ten new activities are listed');const addedWorldGames=[['kindness_meadow','kindness'],['windmill_workshop','windmill'],['little_bridge_builders','bridge'],['haystack_tower','haystack'],['nest_builder','nest'],['rainy_day_clothesline','clothesline'],['pond_balance','balance'],['orchard_seasons','seasons'],['barnyard_action_parade','parade'],['farm_post_office','postoffice']];for(const [id,kind] of addedWorldGames){const g=worldGames.find(x=>x.id===id);assert(g&&g.kind===kind,'new game is in the full-screen farm catalogue: '+id);assert(g.voice&&fs.existsSync(root+'/assets/audio/'+g.voice+'.mp3'),'new game has a reusable guide recording: '+id);assert(fs.existsSync(root+'/assets/generated/minigames/'+g.scene+'.webp'),'new game has a full-screen farm scene: '+id)}const worldCode=read('world-play.js');for(const [,kind] of addedWorldGames){assert(worldCode.includes("case'"+kind+"':"+kind+'();'),'new game renderer is connected: '+kind);assert(worldCode.includes('function '+kind+'(){'),'new game has its own playable loop: '+kind)}assert(read('world-play.css').includes('@media(prefers-reduced-motion:reduce)'),'new activity animations respect reduced-motion preference');
const missing=new Set;for(const f of fs.readdirSync(root).filter(f=>/\.(?:html|css|js)$/.test(f)))for(const m of read(f).matchAll(/assets\/[\w/.-]+\.(?:webp|png|svg|mp3)/g))if(!fs.existsSync(root+'/'+m[0]))missing.add(m[0]);assert.equal([...missing].join('\n'),'','Missing static assets');
const writing=read('writing-game.js'),writingIndex=read('index.html'),writingCards=['letter_tracing','name_tracing','balloon_letters'];for(const id of writingCards)assert(read('app.js').includes("id:'"+id+"'"),'Writing activity appears in the game library: '+id);assert(writingIndex.includes('writing-game.js?v=6')&&writingIndex.includes('writing-game.css?v=5'),'Writing assets are loaded by the app');assert(writing.includes('name is used just for this game and is not saved or sent anywhere'),'A child name stays session-only');assert(writing.includes('traceFontSize(box)')&&writing.includes('traceFontSize({ width: w, height: h })'),'Visible guide and touch mask share the same scale');const letterManifest=JSON.parse(read('assets/audio/letters-generation.json'));assert.equal(letterManifest.files.length,79);for(const letter of 'abcdefghijklmnopqrstuvwxyz'){for(const kind of ['find','trace']){const id='letter-'+kind+'-'+letter,clip=letterManifest.files.find(x=>x.id===id);assert(clip&&clip.farmer===['jade','rhys','jay'][(letter.charCodeAt(0)-97)%3]);assert(fs.statSync(root+'/assets/audio/'+id+'.mp3').size===clip.bytes);}}assert(!writing.includes('speechSynthesis'),'Letter games use the recorded Farmer voices');
assert(!read('index.html').includes(' src="game.js?v='));assert(!read('app.js').includes('meadow-market-save'));assert(read('audio.js').includes('meadow-littles-audio'));assert(read('art-studio.js').includes('meadow-littles-art'));const release=JSON.parse(read('release.json')),appBuild=read('app.js').match(/\bbuild=(\d+),/),controlBuild=read('littles-cloud.js').match(/controlsState=\{[^}]*build:(\d+)\}/);assert.equal(Number(appBuild?.[1]),release.build,'app.js build agrees with release marker');const controlEdge=fs.readFileSync(path.resolve(__dirname,'../supabase/functions/meadow-littles-fairplay/index.ts'),'utf8'),controlVersion=Number(controlEdge.match(/const BUILD = (\d+)/)?.[1]);assert.equal(Number(controlBuild?.[1]),controlVersion,'Client fallback agrees with the active control consumer, independently of web content releases');assert(controlEdge.includes("CONSUMER_VERSION = 'littles-"+controlVersion+"'"));assert(read('sw.js').includes('meadow-littles-v'+release.build));
console.log('Littles: 27 games including twelve new full-scene activities, 48 art pages, care plans, level progression, shuffled pairs, isolated saves and static asset closure passed.');

require("./check-littles-art.cjs");


require("./check-littles-together.cjs");

require("./check-littles-state.cjs");
require("./check-littles-recovery.cjs");
require("./check-littles-accounts.cjs");

const nextGames=fs.readFileSync(root+'/next-games.js','utf8'),nextCss=fs.readFileSync(root+'/next-games.css','utf8');assert(nextGames.includes("board.classList.add('next-memory-board')"));assert(nextCss.includes('.next-memory-board .next-choice{height:100%'));

require("./check-pip-day.cjs");
require("./check-littles-find.cjs");

require("./check-littles-coop-audio.cjs");

require("./check-littles-previews-wordhelp.cjs");

require("./check-littles-adventures.cjs");
require("./check-littles-creative-scenes.cjs");
require('./check-littles-journeys.cjs');
require('./check-littles-journey-audio.cjs');
require('./check-littles-sliding.cjs');
require('./check-littles-neighbours.cjs');
require('./check-littles-bees.cjs');
require('./check-littles-harvest-slice.cjs');
require('./check-littles-harvest-input.cjs');
require('./check-littles-access.cjs');
require('./check-littles-commerce.cjs');
require('./check-littles-learning.cjs');

require('./check-littles-harvest58.cjs');
