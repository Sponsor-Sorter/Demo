'use strict';
// Import exactly the four owner-auditioned provider takes, without altering their delivery.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const [mappingFile,technicalFile]=process.argv.slice(2);
if(!mappingFile||!technicalFile)throw Error('Supply the user-approved source mapping and technical receipt JSON files');
const root=path.resolve(__dirname,'../meadow-market-littles'),dir=path.join(root,'assets/audio');
const plan=JSON.parse(fs.readFileSync(path.join(__dirname,'littles-local/writing101-audio-plan.json'),'utf8'));
const mapping=JSON.parse(fs.readFileSync(mappingFile,'utf8')),technical=JSON.parse(fs.readFileSync(technicalFile,'utf8'));
const proof=JSON.parse(fs.readFileSync(mapping.providerEvidence,'utf8')),manifest=path.join(dir,'writing101-rhys-generation.json');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
assert.equal(mapping.voice,plan.approvedVoice);assert.equal(mapping.model,plan.model);
assert.equal(proof.voice,plan.approvedVoice);assert.equal(proof.model,plan.model);
for(const [key,value]of Object.entries(plan.settings))assert.equal(proof.settings[key],value,'Provider setting '+key);
assert.equal(mapping.listened,true);assert.equal(mapping.listeningReview?.reviewer,'user');
assert(mapping.listeningReview.quote&&mapping.listeningReview.reviewedAt,'Concrete user listening approval required');
assert(!fs.existsSync(manifest),'Existing approved cohort will not be overwritten');
const prepared=plan.cues.map(cue=>{
 const source=mapping.files?.[cue.id],record=technical.files.find(f=>f.id===cue.id),target=path.join(dir,cue.id+'.mp3');
 assert(source&&fs.statSync(source).isFile(),'Missing source '+cue.id);assert(record&&record.text===cue.text);
 const bytes=fs.readFileSync(source);assert.equal(bytes.length,record.bytes);assert.equal(sha(bytes),record.sha256);
 assert(record.originalDownloadMatches&&record.allFileBytesAccountedFor,'Provider file integrity '+cue.id);
 assert(record.durationSeconds>.2&&record.durationSeconds<30);assert(!fs.existsSync(target),'Existing clip '+cue.id);
 return {source,target,bytes,entry:{...cue,farmer:plan.farmer,voice:plan.approvedVoice,provider:'ElevenLabs authenticated web Text to Speech',model:plan.model,settings:plan.settings,selectedVariation:1,sourceFilename:path.basename(source),sourceSha256:sha(bytes),processing:'Original user-approved provider MP3, copied byte-for-byte; delivery and loudness unchanged',bytes:bytes.length,sha256:sha(bytes),durationSeconds:record.durationSeconds,listened:true,listeningReview:mapping.listeningReview}};
});
const written=[];
try{
 for(const file of prepared){fs.copyFileSync(file.source,file.target,fs.constants.COPYFILE_EXCL);written.push(file);}
 fs.writeFileSync(manifest,JSON.stringify({generatedAt:new Date().toISOString(),authorisation:'User requested approved farmer narration and auditioned all four takes',files:prepared.map(f=>f.entry)},null,2)+'\n',{flag:'wx'});
}catch(error){for(const file of written)if(fs.existsSync(file.target)&&sha(fs.readFileSync(file.target))===file.entry.sha256)fs.unlinkSync(file.target);throw error;}
console.log(JSON.stringify(prepared.map(({entry:{id,bytes,durationSeconds}})=>({id,bytes,durationSeconds}))));
