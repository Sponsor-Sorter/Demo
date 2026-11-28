'use strict';
require('../tools/littles-local/qa-network.cjs');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(root+'/meadow-market-littles/weekly-fair.js','utf8'),old=fs.readFileSync(root+'/tools/littles-local/weekly-fair-v4-frozen.js','utf8');
const week=(()=>{const d=new Date();d.setUTCHours(0,0,0,0);d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return d.toISOString().slice(0,10);})();
async function client(code,values,renderer,fields){
 let user='local-phone',response=fields;const win={meadowLittlesAccess:{configure(){}},meadowLittlesCloud:{getStatus:()=>({userId:user}),weekly:async()=>({user_id:user,enabled:true,week,...response})}};
 if(renderer)win.meadowStickerWriting={rendererVersion:renderer};
 const sandbox={window:win,localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},document:{querySelector:()=>null},Date,Promise};
 vm.runInNewContext(code,sandbox);const fair=win.meadowWeeklyFair;fair.accountChanged(user);await fair.refresh();return {fair,async update(next){response=next;await fair.refresh();},async account(id){user=id;fair.accountChanged(id);await fair.refresh();}};
}
(async()=>{
 const values=new Map([['meadow-littles-quality-build','99']]),preview={public_quality_build:99,quality_build:99,public_quality_build_v2:99,quality_build_v2:101};
 const fixed=await client(source,values,2,preview);assert.equal(fixed.fair.getQualityBuild(),101);assert.equal(values.get('meadow-littles-quality-build'),'99');assert.equal(values.get('meadow-littles-quality-build-v2'),'99');
 await fixed.account(null);assert.equal(fixed.fair.getQualityBuild(),99,'Private preview must not survive sign-out');
 const published={...preview,public_quality_build_v2:101};await fixed.account('local-phone');await fixed.update(published);await fixed.account(null);assert.equal(fixed.fair.getQualityBuild(),101,'Published fixed renderer remains available offline');
 assert.equal(values.get('meadow-littles-quality-build'),'99');assert.equal(values.get('meadow-littles-quality-build-v2'),'101');
 const cached=await client(old,values,null,published);assert.equal(cached.fair.getQualityBuild(),99,'Actual cached v4 cannot unlock invisible writing101');await cached.account(null);assert.equal(cached.fair.getQualityBuild(),99);
 for(const renderer of [undefined,1,'2']){const mixed=await client(source,new Map(values),renderer,published);assert.equal(mixed.fair.getQualityBuild(),99,'Mixed-cache clients need the actual fixed renderer');}
 const clean=new Map();const malformed=await client(source,clean,2,preview);
 for(const bad of [null,'102',NaN,Infinity,61,10000,101.5]){await malformed.update({...preview,public_quality_build_v2:bad,quality_build_v2:bad});assert.equal(malformed.fair.getQualityBuild(),99);assert.equal(clean.get('meadow-littles-quality-build-v2'),'99');}
 await malformed.update({...preview,public_quality_build:99999999,quality_build:99999999,public_quality_build_v2:null,quality_build_v2:null});assert.equal(malformed.fair.getQualityBuild(),99);
 const poisoned=await client(source,new Map([['meadow-littles-quality-build','101']]),null,preview);assert.equal(poisoned.fair.getQualityBuild(),99);
 console.log('Writing rollout: actual cached v4, mixed scripts, private preview, sign-out, offline publication and malformed versions passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
