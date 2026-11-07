const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),root=path.resolve(__dirname,'../meadow-market-littles'),scope={window:{}};
vm.runInNewContext(fs.readFileSync(root+'/word-search.js','utf8'),scope);
const words=[...new Set(scope.window.meadowWordSearch.topics.flatMap(t=>t.words.map(w=>w[0])).filter(w=>w.length<=5))].sort(),letters=[...new Set(words.map(w=>w[0]))].sort(),out=path.resolve(__dirname,'../.artifacts/littles-word-audio');fs.mkdirSync(out,{recursive:true});
// Separate letter names avoid TTS treating spellings such as C-A-T as a word.
// Phonetic generation text also keeps A distinct from the unstressed article.
const names=['Ay','Bee','See','Dee','Ee','Eff','Jee','Aitch','Eye','Jay','Kay','Ell','Em','En','Oh','Pee','Cue','Ar','Ess','Tee','You','Vee','Double you','Ex','Why','Zed'];
const alphabet=names.map((name,i)=>({id:'ws-letter-'+String.fromCharCode(97+i),farmer:'rhys',text:name+'.',letter:String.fromCharCode(65+i),pronunciation:name}));
const guide=[{id:'ws-clue-start',farmer:'rhys',text:'We’re trying to find the letter...'},{id:'ws-clue-next',farmer:'rhys',text:'to start the word. What’s the next letter?'}];
const spokenWords=words.map(word=>({id:'ws-word-'+word,farmer:'rhys',text:word[0].toUpperCase()+word.slice(1)+'.',word}));
// Keep requests short: many SSML breaks in one request can accelerate or
// distort speech. Four cues need only three breaks and can be checked exactly.
const intro={id:'ws-rhys-intro',farmer:'rhys',text:'Tap a word and I’ll spell it for you. Tap again for a first-letter clue. Then slide your finger across the letters on the board. Take your time!'};
const all=[...alphabet,...guide,...spokenWords,intro],batches=[];for(let i=0;i<all.length;i+=4)batches.push({name:'word-audio-'+String(1+Math.floor(i/4)).padStart(3,'0'),cues:all.slice(i,i+4)});
for(const b of batches)fs.writeFileSync(path.join(out,b.name+'.json'),JSON.stringify(b.cues,null,2));fs.writeFileSync(path.join(out,'batches.json'),JSON.stringify(batches,null,2));console.log(JSON.stringify(batches.map(b=>({name:b.name,count:b.cues.length}))));
