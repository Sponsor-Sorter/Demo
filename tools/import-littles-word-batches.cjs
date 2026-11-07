const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),root=path.resolve(__dirname,'..'),dir=root+'/.artifacts/littles-word-audio',ffmpeg=path.resolve(root,'../node_modules/ffmpeg-static/ffmpeg.exe');
const batches=JSON.parse(fs.readFileSync(dir+'/batches.json'));let imported=0,missing=0;
for(const b of batches){if(!fs.existsSync(dir+'/'+b.name+'.mp3')){missing++;continue;}if(fs.existsSync(root+'/meadow-market-littles/assets/audio/'+b.name+'-generation.json'))continue;
const result=cp.spawnSync(process.execPath,[__dirname+'/import-littles-approved-audio.cjs',dir+'/'+b.name+'.json',dir+'/'+b.name+'.mp3',ffmpeg,b.name],{encoding:'utf8',env:{...process.env,LITTLES_TEMPO:'1',LITTLES_PEAK_NORMALIZE:'1'}});if(result.status!==0)throw Error(b.name+': '+result.stderr);imported++;}
console.log(JSON.stringify({batchesImported:imported,remaining:missing}));
