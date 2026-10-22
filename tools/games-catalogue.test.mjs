import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync, readdirSync} from 'node:fs';
import {validateCatalogue,renderEntry,escape} from './build-games-catalogue.mjs';
import {browserBuildLabel} from '../js/gamesCatalogue.mjs';
const data=JSON.parse(readFileSync(new URL('../content/games-catalogue.json',import.meta.url),'utf8'));
const page=readFileSync(new URL('../games.html',import.meta.url),'utf8');
test('all products have distinct stable entries and complete instructions',()=>{assert.equal(validateCatalogue(data),data);assert.equal(data.entries.length,5);});
test('each entry renders version, actions, instructions and local QR',()=>{
 for(const entry of data.entries){const html=renderEntry(entry);assert.ok(html.includes(entry.id+'-title'));assert.ok(html.includes(escape(entry.build)));assert.ok(html.includes('Open on your phone'));assert.ok(existsSync(new URL(`../games-assets/${entry.id}-qr.svg`,import.meta.url)));}
});
test('catalogue content is escaped at HTML boundaries',()=>{
 const html=renderEntry({...data.entries[0],description:'<img src=x onerror="bad">',title:'<Title>'});assert.ok(html.includes('&lt;img'));assert.ok(html.includes('&lt;Title&gt;'));assert.ok(!html.includes('<img src=x'));
});
test('unsafe action URLs and duplicate IDs are rejected',()=>{
 const copy=structuredClone(data);copy.entries[0].actions[0].url='javascript:alert(1)';assert.throws(()=>validateCatalogue(copy));
 const duplicate=structuredClone(data);duplicate.entries[1].id=duplicate.entries[0].id;assert.throws(()=>validateCatalogue(duplicate));
});
test('browser manifest build is validated separately from native package versions',()=>{
 assert.equal(browserBuildLabel({build:74,androidVersion:'1.5.0'}),'Browser build 74');for(const build of [null,0,-1,'74',true,1.5])assert.equal(browserBuildLabel({build}),null);
});
test('page uses the shared home theme, stable anchors and Games footer',()=>{
 assert.match(page,/homepage.css/);assert.match(page,/connectionHeader.js\?v=20261018-calm1/);assert.match(page,/<a href="\.\/games.html">Games<\/a>/);for(const entry of data.entries)assert.ok(page.includes('id="'+entry.id+'"'));
});
test('public Android metadata does not promote pending Sponsor Sorter build 9',()=>{
 assert.equal(data.entries.find(entry=>entry.id==='sponsor-sorter').build,'Version 1.0.0 · Build 8');
 assert.equal(data.entries.find(entry=>entry.id==='bargain-barge').build,'Version 0.4.4 · Build 19');
});
test('every canonical footer has a Games link, including the public profile directory',()=>{
 for(const name of [...readdirSync(new URL('../',import.meta.url)).filter(name=>name.endsWith('.html')),'u/index.html']) {
  const html=readFileSync(new URL('../'+name,import.meta.url),'utf8');
  const footer=html.match(/<footer class="site-footer"[\s\S]*?<\/footer>/)?.[0];
  if(footer)assert.match(footer,/href="(?:\.\/|\.\.\/)?games.html">Games<\/a>/,name);
 }
});


test('Frontlines publishes accepted build 9 Web and Android preview',()=>{
 const entry=data.entries.find(e=>e.id==='frontlines');assert.equal(entry.build,'Version 1.0.0-preview.9 · Build 9');
 assert.equal(entry.actions[0].url,'https://sponsorsorter.com/frontlines/builds/9/');
 assert.equal(entry.actions[1].url,'https://sponsorsorter.com/frontlines/downloads/frontlines-1.0.0-preview-build-9.apk');
 assert.match(entry.notes,/in-app update flow is still being tested/);
 assert.equal(existsSync(new URL('../frontlines/downloads/frontlines-1.0.0-preview-build-7.apk',import.meta.url)),false);
 assert.ok(data.entries.some(e=>e.id==='meadow-market-littles'));
});
test('Frontlines accepted packet site files retain exact hashes and metadata',async()=>{
 const {createHash}=await import('node:crypto');const m=JSON.parse(readFileSync(new URL('../docs/releases/frontlines-preview9.json',import.meta.url),'utf8'));
 assert.equal(m.build,9);
 for(const f of m.files.filter(f=>f.path.startsWith('site/'))){const b=readFileSync(new URL('../'+f.path.slice(5),import.meta.url));assert.equal(b.length,f.bytes,f.path);assert.equal(createHash('sha256').update(b).digest('hex'),f.sha256,f.path);}
 const android=JSON.parse(readFileSync(new URL('../frontlines/android-release.json',import.meta.url),'utf8'));assert.equal(android.versionCode,9);assert.equal(android.sha256,m.android.sha256);
 const web=JSON.parse(readFileSync(new URL('../frontlines/release.json',import.meta.url),'utf8'));assert.equal(web.build,9);assert.equal(web.url,m.web.url);
});

test('Frontlines preserves all accepted build 8 immutable bytes',async()=>{
 const {createHash}=await import('node:crypto');const m=JSON.parse(readFileSync(new URL('../docs/releases/frontlines-preview8.json',import.meta.url),'utf8'));
 for(const f of m.files.filter(f=>f.path.startsWith('site/frontlines/builds/8/')||f.path.endsWith('build-8.apk'))){const b=readFileSync(new URL('../'+f.path.slice(5),import.meta.url));assert.equal(b.length,f.bytes,f.path);assert.equal(createHash('sha256').update(b).digest('hex'),f.sha256,f.path);}
});
