const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),root=path.resolve(__dirname,'../meadow-market-littles'),read=f=>fs.readFileSync(root+'/'+f,'utf8'),scope={window:{},document:{addEventListener(){}},console};
for(const f of ['approved-voices.js','coop-build.js','world-play.js','next-games.js','together-core.js'])vm.runInNewContext(read(f),scope);
const {slots,fitPiece,paintCoverage,roofSamples}=scope.window.meadowCoopBuild,placed=new Set();
assert.equal(fitPiece('door',{x:362,y:395},slots[1],placed),null,'door cannot fill a window outline');
assert.equal(fitPiece('window',{x:362,y:395},slots[1],placed).id,'wall-0');placed.add('wall-0');assert.equal(fitPiece('window',{x:362,y:395},slots[1],placed),null,'used outline cannot accept another piece');
assert.equal(fitPiece('roof-left',{x:574,y:250},slots[2],new Set()),null,'roof sides must match');
const coverage=new Set();for(let n=0;n<100;n++)paintCoverage(coverage,{x:500,y:220},{x:500,y:220});assert.equal(coverage.size,0,'stationary contact cannot finish painting');
for(const y of [190,230,270])paintCoverage(coverage,{x:280,y},{x:720,y});assert(coverage.size>=roofSamples.length*.95,'large child-friendly strokes cover the roof');
assert(read('coop-build.js').includes('if(nail&&s.phase===3)'),'old nail targets cannot intercept painting');assert(read('coop-build.js').includes('s.time+=dt'),'completion and hen animation use paused game time');
const registry=scope.window.meadowApprovedVoices,resolve=id=>registry.aliases[id]||id;
function check(id,farmer){const actual=resolve(id),clip=registry.clips[actual];assert(clip,'missing approved recording: '+id);if(farmer)assert.equal(clip.farmer,farmer,id+' must use its displayed farmer');assert(fs.existsSync(root+'/assets/audio/'+actual+'.mp3'));}
for(const g of scope.window.meadowWorldPlay.games)check(g.voice,g.farmer);
for(const g of scope.window.meadowNextGames.games)check(g.voice,g.person);
for(const id of [...Object.keys(scope.window.meadowTogetherCore.games),'local'])check('together-'+id,'jay');
for(const cue of ['intro','floor','walls','roof','nails','paint','nests','done'])check('coop-rhys-'+cue,'rhys');
for(const id of ['ws-jade-intro','ws-jade-done',...Array.from({length:4},(_,i)=>'ws-jade-praise-'+i)])check(id,'jade');
for(const [id,farmer] of [['eggs','jay'],['milk','jade'],['flowers','jade'],['memory','jade'],['sorting','jay'],['drawing','rhys'],['colourbynumber','jade'],['matchpainting','jay'],['differences','rhys'],['tractorrepair','rhys']])check('minigame-'+id,farmer);
for(const c of Object.values(registry.clips))assert.equal(c.voice,registry.cast[c.farmer]);
for(const id of Object.keys(registry.aliases))check(id);
for(const f of fs.readdirSync(root).filter(f=>f.endsWith('.js'))){const s=read(f);assert(!/speechSynthesis|SpeechSynthesisUtterance/.test(s),'device speech is forbidden: '+f);for(const match of s.matchAll(/(?:\.speak|\bvoice)\('([a-z][a-z0-9-]+)'\)/g))if(!match[1].endsWith('-'))check(match[1]);}
const cache=JSON.parse(read('sw.js').match(/FILES=(\[[\s\S]*?\]);/)[1]);for(const id of Object.keys(registry.clips))assert(cache.includes('./assets/audio/'+id+'.mp3?v='+(id.startsWith('harvest58-')?'58':'56')),'approved audio must work offline: '+id);
console.log('Coop matching, paint coverage, paused-time scheduling and approved audio coverage for all game catalogues passed.');
