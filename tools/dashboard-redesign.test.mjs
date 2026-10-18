import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {dashboardSections} from '../js/dashboardWorkspace.mjs';
const root = new URL('../',import.meta.url);
test('sections have unique stable destinations and useful labels',()=>{
 assert.equal(new Set(dashboardSections.map(row=>row[0])).size,6);
 assert.equal(dashboardSections[0][0],'overview');
 for(const row of dashboardSections) assert.ok(row.every(value=>typeof value==='string'&&value.length));
});
for (const page of ['dashboardsponsor.html','dashboardsponsee.html']) {
 test(`${page} retains every original control ID and business script`,()=>{
  const previous=execFileSync('git',['-c','safe.directory=D:/Chat Gpt/workspaces/website-edge-audit/fambot-helper-20261018','show',`9df8d2a:${page}`],{encoding:'utf8'});
  const current=readFileSync(new URL(page,root),'utf8');
  const ids=s=>[...s.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  assert.deepEqual(ids(current),ids(previous));
  for(const match of previous.matchAll(/<script[^>]*src="([^"]+)"/g)) assert.ok(current.includes(match[0]));
  assert.match(current,/dashboard-workspace.css/);assert.match(current,/dashboardWorkspace.mjs/);
 });
}
test('layout module has no data writes, HTML interpolation or network calls',()=>{
 const source=readFileSync(new URL('js/dashboardWorkspace.mjs',root),'utf8');
 assert.doesNotMatch(source,/innerHTML|outerHTML|\bfetch\s*\(|supabase|localStorage|sessionStorage/);
 assert.match(source,/panel.hidden = id !== key/);assert.match(source,/aria-current/);assert.match(source,/hashchange/);
});
test('responsive styles isolate dashboard changes and respect hidden panels',()=>{
 const css=readFileSync(new URL('dashboard-workspace.css',root),'utf8');
 assert.match(css,/\.dw-panel\[hidden\]/);assert.match(css,/@media\(max-width:760px\)/);assert.match(css,/prefers-reduced-motion/);
 assert.match(css,/overflow-x:auto/);assert.match(css,/minmax\(0,1fr\)/);
});

test('empty creator filters never display page zero',()=>{
 const source=readFileSync(new URL('js/sponseeOffers.js',root),'utf8');
 assert.doesNotMatch(source,/Page \$\{totalOffers === 0 \? 0/);
 assert.match(source,/No matching campaigns/);
});
