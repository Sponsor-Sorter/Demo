const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'../meadow-market-littles/assets/audio');
const cues=[
['find-rhys-sheep','Let’s find the little lambs! Look behind the leaves, hay and baskets. Move a hiding place, then tap the lamb you find.'],
['find-rhys-goat','Let’s find the little goats! Look behind the leaves, hay and baskets. Move a hiding place, then tap the goat you find.'],
['find-rhys-cow','Let’s find the little cows! Look behind the leaves, hay and baskets. Move a hiding place, then tap the cow you find.'],
['find-rhys-clue','Let’s listen carefully. A farm friend is hiding here.'],
['find-rhys-gate','You found everyone! Open the gate, then follow the little path with your finger to guide your friends home.'],
['find-rhys-feed','Everyone is safely home. Drag the feed scoop over the trough. Move it gently to scatter their food.'],
['find-rhys-done','What lovely helping! Your friends are home and enjoying their snack. Shall we find some more?'],
['find-rhys-butterfly','A little butterfly! Let’s try another hiding place.']];
const source=process.argv[2],ffmpeg=process.argv[3];if(!source||!ffmpeg)throw Error('Supply the exported Studio batch MP3 and ffmpeg executable.');
const scan=cp.spawnSync(ffmpeg,['-hide_banner','-i',source,'-af','silencedetect=noise=-40dB:d=1.8','-f','null','-'],{encoding:'utf8'});if(scan.status!==0)throw Error(scan.stderr);
const gaps=[...scan.stderr.matchAll(/silence_start: ([\d.]+)[\s\S]*?silence_end: ([\d.]+)/g)].map(m=>[+m[1],+m[2]]);if(gaps.length!==cues.length-1)throw Error('Expected seven two-second separators; inspect the batch before importing.');
const files=[];for(let i=0;i<cues.length;i++){const [id,text]=cues[i],start=i?gaps[i-1][1]-.12:0,end=i<gaps.length?gaps[i][0]+.12:null,args=['-y','-v','error','-ss',String(start),'-i',source];if(end!==null)args.push('-t',String(end-start));args.push('-af','atempo=0.88,loudnorm=I=-18:TP=-2:LRA=7','-ar','44100','-ac','1','-b:a','96k',path.join(root,id+'.mp3'));const out=cp.spawnSync(ffmpeg,args,{encoding:'utf8'});if(out.status!==0)throw Error(out.stderr);files.push({id,text,farmer:'rhys',voice:'Noah - YA Audiobooks Narrator',sourceStart:start,sourceEnd:end,bytes:fs.statSync(path.join(root,id+'.mp3')).size});}
fs.writeFileSync(path.join(root,'find-generation.json'),JSON.stringify({provider:'ElevenLabs',model:'Eleven Multilingual v2',generated:'2026-11-06',files},null,2)+'\n');console.log('Imported eight approved Farmer Rhys prompts.');
