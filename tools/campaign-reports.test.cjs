const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=file=>fs.readFileSync(require('node:path').join(__dirname,'../js',file),'utf8').replace(/^import[\s\S]*?;\r?\n/gm,'').replaceAll('export ','');
const reports=vm.runInNewContext(read('campaignReports.js')+';({observedMetrics,reportCsv})');
const platforms=vm.runInNewContext(read('statsnap.js')+';({detectPlatform,normalizeUrl})',{URL});
test('observations preserve missing values and exclude credentials or invalid numbers',()=>{
 const result=reports.observedMetrics({views:null,likes:0,comments:-1,shares:false,reach:[],impressions:' ',access_token:'secret'});
 assert.equal(result.views,null);assert.equal(result.likes,0);assert.equal(result.comments,null);assert.equal(result.shares,null);assert.equal(result.reach,null);assert.equal(result.impressions,null);assert.equal(result.access_token,undefined);
});
test('report export escapes formulas and omits private payloads',()=>{
 const csv=reports.reportCsv([{recorded_at:'2026-10-12',platform:'=bad()',content_url:'https://example.invalid',metrics:{likes:0},raw:{secret:'never export'}}]);
 assert.ok(csv.includes("'=bad()"));assert.ok(csv.includes('not independently verified'));assert.ok(!csv.includes('secret'));
});
test('normalization cannot turn an unsafe or lookalike URL into a trusted platform',()=>{
 for(const url of ['https://youtube.com.evil.invalid/watch?v=abc','https://notyoutube.com/watch?v=abc','https://evil-tiktok.com/video/1','http://youtube.com/watch?v=abc','https://name:password@youtube.com/watch?v=abc']) assert.equal(platforms.detectPlatform(platforms.normalizeUrl(url)),'unknown');
 assert.equal(platforms.normalizeUrl('https://youtu.be/abc?utm_source=test'),'https://www.youtube.com/watch?v=abc');
});
