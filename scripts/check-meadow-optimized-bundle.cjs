// Inspect the actual optimized AAB: plugin and method annotations must survive R8.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../tools/meadow-android/android');
const archive=fs.readFileSync(path.join(root,'app/build/outputs/bundle/playRelease/app-play-release.aab')),files=new Map();
let end=archive.length-22;while(end>=0&&archive.readUInt32LE(end)!==0x06054b50)end--;assert(end>=0);
let entry=archive.readUInt32LE(end+16);for(let i=0;i<archive.readUInt16LE(end+10);i++){
 assert.equal(archive.readUInt32LE(entry),0x02014b50);const name=archive.toString('utf8',entry+46,entry+46+archive.readUInt16LE(entry+28)),local=archive.readUInt32LE(entry+42),offset=local+30+archive.readUInt16LE(local+26)+archive.readUInt16LE(local+28);
 if(/base\/dex\/classes\d*\.dex$|obfuscation\/proguard.map$/.test(name)){const bytes=archive.subarray(offset,offset+archive.readUInt32LE(entry+20));files.set(name,archive.readUInt16LE(entry+10)===8?zlib.inflateRawSync(bytes):bytes);}
 entry+=46+archive.readUInt16LE(entry+28)+archive.readUInt16LE(entry+30)+archive.readUInt16LE(entry+32);
}
const mapping=files.get('BUNDLE-METADATA/com.android.tools.build.obfuscation/proguard.map');assert(mapping?.length>1000,'R8 mapping missing');
const plugins=new Map(),seen={};for(const flavor of ['main','play'])for(const name of fs.readdirSync(path.join(root,'app/src',flavor,'java/com/meadowandmarket/game'))){if(!name.endsWith('.java'))continue;const source=fs.readFileSync(path.join(root,'app/src',flavor,'java/com/meadowandmarket/game',name),'utf8');if(source.includes('@CapacitorPlugin('))plugins.set('Lcom/meadowandmarket/game/'+name.slice(0,-5)+';',Array.from(source.matchAll(/@PluginMethod\s+public\s+void\s+(\w+)/g),m=>m[1]));}
assert.equal(plugins.size,4,'All four expected native plugin sources must be inspected');
assert([...plugins.values()].reduce((n,methods)=>n+methods.length,0)>=13,'The current bridge contract has at least thirteen JS entry points');
for(const [name,data]of files){if(!name.endsWith('.dex'))continue;const u32=o=>data.readUInt32LE(o),uleb=o=>{let n=0,s=0,b;do{b=data[o++];n|=(b&127)<<s;s+=7;}while(b&128);return[n,o]},strings=[];
 for(let i=0;i<u32(56);i++){const [,o]=uleb(u32(u32(60)+i*4));strings.push(data.toString('utf8',o,data.indexOf(0,o)));}
 const types=Array.from({length:u32(64)},(_,i)=>strings[u32(u32(68)+i*4)]),annotations=o=>!o?[]:Array.from({length:u32(o)},(_,i)=>types[uleb(u32(o+4+i*4)+1)[0]]);
 for(let i=0;i<u32(96);i++){const offset=u32(100)+i*32,owner=types[u32(offset)];if(!plugins.has(owner))continue;const directory=u32(offset+20);assert(directory,owner+' lost annotations');assert(annotations(u32(directory)).includes('Lcom/getcapacitor/annotation/CapacitorPlugin;'),owner+' lost plugin annotation');const methods=[];
  for(let j=0;j<u32(directory+8);j++){const slot=directory+16+u32(directory+4)*8+j*8,method=u32(92)+u32(slot)*8;if(annotations(u32(slot+4)).includes('Lcom/getcapacitor/PluginMethod;'))methods.push(strings[u32(method+4)]);}
  for(const method of plugins.get(owner))assert(methods.includes(method),owner+' lost JS method '+method);seen[owner]=methods.sort();
 }
}
for(const owner of plugins.keys())assert(seen[owner],owner+' removed or renamed');
console.log(JSON.stringify({bundleBytes:archive.length,mappingBytes:mapping.length,plugins:seen},null,2));
