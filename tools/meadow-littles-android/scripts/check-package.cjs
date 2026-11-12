// Check compiled definitions, not source files or DEX string references.
// DEX layout: https://source.android.com/docs/core/runtime/dex-format
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),assert=require('node:assert/strict');
const file=process.argv[2];
assert(file&&/\.(aab|apk)$/i.test(file),'Pass the actual Littles AAB or APK');
const archive=fs.readFileSync(file),files=new Map();
let end=archive.length-22;
while(end>=Math.max(0,archive.length-65557)&&archive.readUInt32LE(end)!==0x06054b50)end--;
assert(end>=0&&archive.readUInt32LE(end)===0x06054b50,'ZIP directory missing');
let entry=archive.readUInt32LE(end+16);
for(let i=0;i<archive.readUInt16LE(end+10);i++){
  assert.equal(archive.readUInt32LE(entry),0x02014b50,'Invalid ZIP entry');
  const name=archive.toString('utf8',entry+46,entry+46+archive.readUInt16LE(entry+28));
  if(/^(?:base\/dex\/)?classes\d*\.dex$|^(?:base\/manifest\/)?AndroidManifest\.xml$/.test(name)){
    const local=archive.readUInt32LE(entry+42);
    assert.equal(archive.readUInt32LE(local),0x04034b50,'Invalid ZIP data');
    const offset=local+30+archive.readUInt16LE(local+26)+archive.readUInt16LE(local+28);
    const compressed=archive.subarray(offset,offset+archive.readUInt32LE(entry+20));
    const method=archive.readUInt16LE(entry+10);
    assert(method===0||method===8,'Unsupported ZIP compression');
    const data=method===8?zlib.inflateRawSync(compressed):compressed;
    assert.equal(data.length,archive.readUInt32LE(entry+24),'Truncated ZIP data');
    files.set(name,data);
  }
  entry+=46+archive.readUInt16LE(entry+28)+archive.readUInt16LE(entry+30)+archive.readUInt16LE(entry+32);
}
const classes=new Map();
for(const [name,data]of files){
  if(!name.endsWith('.dex'))continue;
  assert(/^dex\n0(?:35|37|38|39|40)\0$/.test(data.toString('ascii',0,8)),'Unsupported DEX header');
  const u32=o=>data.readUInt32LE(o),string=index=>{
    let offset=u32(u32(60)+index*4),count=0;
    while(data[offset++]&128)assert(++count<5,'Invalid DEX string length');
    const stop=data.indexOf(0,offset);assert(stop>=offset,'Unterminated DEX string');
    return data.toString('utf8',offset,stop);
  },type=index=>string(u32(u32(68)+index*4));
  for(let i=0;i<u32(96);i++){
    const offset=u32(100)+i*32,descriptor=type(u32(offset));
    assert(!classes.has(descriptor),'Duplicate class definition: '+descriptor);
    classes.set(descriptor,{dex:name,flags:u32(offset+4),parent:u32(offset+8)===0xffffffff?null:type(u32(offset+8))});
  }
}
const prefix='Lcom/meadowmarket/littles/';
for(const name of ['MainActivity','MainActivity$PictureBridge','LittlesAdsPlugin','LittlesStorePlugin','LittlesPlayPlugin']){
  assert(classes.has(prefix+name+';'),'Missing compiled Littles class: '+name);
}
const launcher=classes.get(prefix+'MainActivity;');
assert(launcher.flags&1,'Launcher must be public');
assert(!(launcher.flags&0x400),'Launcher must be concrete');
assert.equal(launcher.parent,'Lcom/getcapacitor/BridgeActivity;','Unexpected launcher superclass');
assert(classes.has(launcher.parent),'Capacitor launcher dependency missing');
const manifest=files.get('base/manifest/AndroidManifest.xml')||files.get('AndroidManifest.xml');
assert(manifest,'Packaged Android manifest missing');
const name='com.meadowmarket.littles.MainActivity';
assert(manifest.includes(Buffer.from(name))||manifest.includes(Buffer.from(name,'utf16le')),'Packaged manifest does not name the Littles launcher');
console.log(JSON.stringify({artifact:path.basename(file),definedClasses:classes.size,launcher,requiredLittlesClasses:'present'},null,2));
