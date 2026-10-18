const fs=require('fs'),path=require('path'),vm=require('vm'),root=path.resolve(__dirname,'../../../meadow-and-market'),out=path.resolve(__dirname,'../www');
const scope={};vm.runInNewContext(fs.readFileSync(root+'/sw.js','utf8').split('\n').slice(0,2).join('\n')+';globalThis.list=FILES',scope);
const files=new Set(['index.html','sw.js','release.json','manifest.webmanifest',...scope.list.map(u=>u.replace(/^\.\//,'').split('?')[0]).filter(Boolean)]);
// Copy only the shipped cache manifest. Master sheets, source art and APKs are excluded.
fs.mkdirSync(out,{recursive:true});
for(const file of files){const source=path.resolve(root,file),target=path.resolve(out,file);if(!source.startsWith(root+path.sep)||!target.startsWith(out+path.sep))throw Error('Invalid package asset '+file);if(!fs.existsSync(source)||!fs.statSync(source).isFile())throw Error('Missing package asset '+file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(source,target)}
// Remove obsolete generated files from the previous package after validating the target.
function clean(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())clean(p);else if(!files.has(path.relative(out,p).split(path.sep).join('/')))fs.unlinkSync(p)}}clean(out);
console.log('Packaged '+files.size+' runtime files, '+Math.round([...files].reduce((n,f)=>n+fs.statSync(path.join(out,f)).size,0)/1024/1024*10)/10+' MB');
