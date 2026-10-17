import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
const source=readFileSync(new URL('../js/sponseeLogic.js',import.meta.url),'utf8');
const begin=source.indexOf('      setTTThumb(ttEls.lastThumb, c.cover');
const end=source.indexOf("      ttEls.lastRow.style.display = '';",begin);
const formatBegin=source.indexOf('function fmtNum(n) {');
const formatEnd=source.indexOf('\n}',formatBegin)+2;
const render=new Function('c','ttEls','setTTThumb',source.slice(formatBegin,formatEnd)+'\n'+source.slice(begin,end));
function fixture(){return Object.fromEntries(['lastThumb','lastViews','lastLikes','lastComments','lastShares'].map(k=>[k,{textContent:'stale'}]));}
function run(c,els=fixture()){render(c,els,(el,url)=>{if(el)el.src=url;});return els;}
test('v27 flat view count and cover aliases render',()=>{const e=run({view_count:42,cover_image_url:'https://fixture.invalid/cover.png'});assert.equal(e.lastViews.textContent,'42');assert.equal(e.lastThumb.src,'https://fixture.invalid/cover.png');for(const k of ['lastLikes','lastComments','lastShares'])assert.equal(e[k].textContent,'-');});
test('legacy nested counters remain supported including measured zero',()=>{const e=run({stats:{view_count:0,like_count:2,comment_count:3,share_count:4},cover:'legacy-cover'});assert.equal(e.lastViews.textContent,'0');assert.equal(e.lastLikes.textContent,'2');assert.equal(e.lastComments.textContent,'3');assert.equal(e.lastShares.textContent,'4');assert.equal(e.lastThumb.src,'legacy-cover');});
test('unknown counters clear prior rendered values',()=>{const e=run({view_count:7});run({},e);for(const k of ['lastViews','lastLikes','lastComments','lastShares'])assert.equal(e[k].textContent,'-');});
test('nested zero takes precedence over flat fallback',()=>{const e=run({stats:{view_count:0},view_count:9});assert.equal(e.lastViews.textContent,'0');});
test('optional UI fields may be absent',()=>{assert.doesNotThrow(()=>run({view_count:8},{}));});
test('creator dashboard versions the edited module',()=>{const html=readFileSync(new URL('../dashboardsponsee.html',import.meta.url),'utf8');assert.match(html,/sponseeLogic\.js\?v=20261017-flow-fixes1/);});
