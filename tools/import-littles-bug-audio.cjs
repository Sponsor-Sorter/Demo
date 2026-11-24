'use strict';
// Import only these seven user-authorised recordings from the approved Rhys UI voice.
// Supply Downloads directory and an existing ffmpeg binary; no credentials/provider calls.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const [downloads,ffmpeg]=process.argv.slice(2),out=path.resolve(__dirname,'../meadow-market-littles/assets/audio');
if(!downloads||!ffmpeg||!fs.existsSync(ffmpeg))throw Error('Supply Downloads directory and existing ffmpeg binary');
const voice='Noah - YA Audiobooks Narrator',sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const clips=[
 ['intro','05_10_44',"Let's make a rainbow! Tap the colourful ants to make a paint splash. Big armoured ants need a few taps. Take your time!"],
 ['armour','05_14_00','This ant has a strong shell. Tap it a few times to crack it open!'],
 ['acorn','05_18_01','Captain Acorn is here! Tap the three shiny acorns to open his shell. Then tap his tummy!'],
 ['bubble','05_18_44',"It's the Bubble Boss! Pop the bubbles with your finger. Then tap that big tummy!"],
 ['tickle','05_28_39','Here comes Tickle Tank! Rub your finger back and forth over his glowing tummy. Make him wiggle!'],
 ['tummy','05_38_05','The shell is open! Tap that big tummy for a rainbow splash!'],
 ['done','05_38_34','Wow, look at those colours! You finished the bug parade. Brilliant splashing!']
];
const manifest=path.join(out,'bug-rhys-generation.json');if(fs.existsSync(manifest))throw Error('Existing cohort will not be overwritten');
for(const [id,time]of clips){const source=path.join(downloads,'ElevenLabs_2026-11-24T'+time+'_'+voice+'_pvc_s50_m2.mp3');if(!fs.existsSync(source))throw Error('Missing approved download: '+source);if(fs.existsSync(path.join(out,'bug-rhys-'+id+'.mp3')))throw Error('Existing recording will not be overwritten: '+id);}
const files=[];
for(const [name,time,text]of clips){
 const id='bug-rhys-'+name,sourceFilename='ElevenLabs_2026-11-24T'+time+'_'+voice+'_pvc_s50_m2.mp3',source=path.join(downloads,sourceFilename),target=path.join(out,id+'.mp3');
 const args=['-hide_banner','-n','-i',source,'-af','loudnorm=I=-18:TP=-2:LRA=7','-ar','44100','-ac','1','-b:a','96k','-threads','1',target],result=cp.spawnSync(ffmpeg,args,{encoding:'utf8',windowsHide:true});if(result.status!==0)throw Error(result.stderr);
 const probe=cp.spawnSync(ffmpeg,['-hide_banner','-i',target],{encoding:'utf8',windowsHide:true}),duration=probe.stderr.match(/Duration:\s*(\d+):(\d+):([\d.]+)/);if(!duration)throw Error('No audio duration: '+id);
 const bytes=fs.readFileSync(target);files.push({id,farmer:'rhys',voice,provider:'ElevenLabs authenticated web Text to Speech',model:'Eleven Multilingual v2',settings:{speed:0.9,stability:0.5,similarity:0.75,style:0,speakerBoost:true},selectedVariation:1,text,sourceFilename,sourceSha256:sha(fs.readFileSync(source)),processing:'loudnorm I=-18 TP=-2 LRA=7; mono44100Hz MP396kbps; no pitch/speed/trim changes',bytes:bytes.length,sha256:sha(bytes),durationSeconds:Number(duration[1])*3600+Number(duration[2])*60+Number(duration[3])});
}
fs.writeFileSync(manifest,JSON.stringify({generatedAt:'2026-11-24',authorisation:'User requested new approved farmer instructions as needed; approved Rhys/Noah cast only',files},null,2)+'\n');
console.log(JSON.stringify(files.map(({id,bytes,durationSeconds})=>({id,bytes,durationSeconds})),null,2));
