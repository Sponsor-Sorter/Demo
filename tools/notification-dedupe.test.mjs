import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const read=name=>readFileSync(new URL(`../${name}`,import.meta.url),'utf8').replace(/\r\n/g,'\n');
const sponsor=read('js/sponsorOffers.js'),creator=read('js/sponseeOffers.js');
const baseline=name=>execFileSync('git',['-c','gc.auto=0','-c',`safe.directory=${root.replace(/\\/g,'/').replace(/\/$/,'')}`,'-C',root,'show',`47c52df34b284059f030655f801b4b7016f27692:${name}`],{encoding:'utf8'}).replace(/\r\n/g,'\n');

test('private comment/status flows no longer issue duplicate browser notifications',()=>{
  for(const source of [sponsor,creator]) {
    assert.doesNotMatch(source,/\bnotifyComment\b|\bnotifyOfferStatus\b|\.from\(['"]user_notifications/);
    assert.doesNotMatch(source,/type:\s*['"](?:creation_date_set|content_live|content_live_confirmed)['"]/);
  }
  assert.doesNotMatch(creator,/from ['"].*alerts\.js/);
});
test('offer deletion notification remains, outside committed UPDATE event scope',()=>{
  assert.equal((sponsor.match(/await notifyOfferUpdate\(/g)||[]).length,1);
  assert.match(sponsor,/await notifyOfferUpdate\(\{[\s\S]*?type: 'offer_deleted'/);
});
test('comment business insert fields and moderation remain in both offer flows',()=>{
  for(const source of [sponsor,creator]) {
    assert.match(source,/\.from\('private_offer_comments'\)\s*\.insert\(\[\{/);
    assert.match(source,/comment_text: commentText/);
    assert.match(source,/if \(!modResult.allowed\) return;/);
    assert.match(source,/Failed to submit comment/);
  }
});
test('acceptance and rejection mutations remain unchanged',()=>{
  assert.match(creator,/\.update\(\{ status: 'accepted', stage: 2 \}\)/);
  assert.match(creator,/\.update\(\{ status: 'rejected' \}\)/);
});
test('creation scheduling and publication business fields are preserved',()=>{
  assert.match(creator,/\.update\(\{ stage: 3, creation_date: selectedDate \}\)/);
  assert.match(creator,/stage: 4,\s*status: 'live',\s*sponsee_live_confirmed: true/);
  for(const field of ['live_url: firstUrl','live_date: earliest','live_urls: urls','url_dates: dates']) assert.ok(creator.includes(field));
});
test('manual confirmation still completes content separately from payment',()=>{
  assert.match(sponsor,/sponsor_live_confirmed: true,\s*stage: 4,[^\n]*\n\s*status: 'completed'/);
  assert.match(sponsor,/Failed to confirm content as live/);
  assert.match(sponsor,/renderOffersByFilter\('all'\)/);
});
test('notification edits remove exactly seven post-commit helper calls',()=>{
  const before=(baseline('js/sponsorOffers.js')+'\n'+baseline('js/sponseeOffers.js')).match(/await notify(?:Comment|OfferStatus|OfferUpdate)\(/g)||[];
  const after=(sponsor+'\n'+creator).match(/await notify(?:Comment|OfferStatus|OfferUpdate)\(/g)||[];
  assert.equal(before.length-after.length,7);
});
test('unrelated producers, inbox readers, 2FA and messaging remain byte-identical',()=>{
  for(const file of ['js/alerts.js','js/messages.js','js/groupOffers.js','js/friendGroups.js','js/publicOffers.js','js/reviewPage.js','js/AffiliateAdmin.js','js/AffiliateDashboard.js','js/adminLogic.js','js/login.js','js/twofa.js','service-worker.js']) assert.equal(read(file),baseline(file).replace("from './FamBot.js'","from './FamBot.js?v=20261018-fambot1'").replace('.eq("action", "auto-strike")','.in("action", ["auto-strike", "auto-ban", "fambot-unban"])'),file);
});
test('dashboard cache keys load the new offer modules while shared alerts stay loaded',()=>{
  for(const [page,module] of [['dashboardsponsor.html','sponsorOffers'],['dashboardsponsee.html','sponseeOffers']]) {
    const source=read(page);
    assert.match(source,new RegExp(`${module}\\.js\\?v=\\d{8}-[a-z0-9-]+`));
    assert.match(source,/js\/alerts\.js\?/);
  }
});
