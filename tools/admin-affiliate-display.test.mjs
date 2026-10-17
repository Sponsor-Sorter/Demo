import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { conversionDisplay, affiliateReferralUrl, usersNeedingAudience, applicationHasSnapshot } from '../js/affiliateConversionDisplay.mjs';

test('historical null-amount conversions earn 1, 1.50, 1.50 with their own rates', () => {
  const rows = [10,15,15].map(commission => conversionDisplay({ amount: null, commission }));
  assert.deepEqual(rows.map(row=>row.earned), [1,1.5,1.5]);
  assert.equal(rows.reduce((sum,row)=>sum+row.earned,0),4);
  assert.equal(rows[0].rate,10);
});
test('a real zero base amount remains zero', () => {
  assert.deepEqual(conversionDisplay({ amount: 0, commission: 15 }), { earned: 0, rate: 15 });
});
test('round each row using decimal arithmetic, including half-cent boundary', () => {
  assert.equal(conversionDisplay({ amount: '1.005', commission: '100' }).earned,1.01);
  assert.equal(conversionDisplay({ amount: '10', commission: '0.05' }).earned,.01);
});
test('unknown or invalid rate is never replaced with a partner rate', () => {
  for (const commission of [null,undefined,'bad',-5,101]) {
    assert.deepEqual(conversionDisplay({ amount: 10, commission, commission_rate: 15 }),{ rate:null, earned:null });
  }
});
test('referral URL goes directly to signup and encodes code', () => {
  const url = new URL(affiliateReferralUrl('fitstyle & test','https://sponsorsorter.com'));
  assert.equal(url.pathname,'/signup.html'); assert.equal(url.searchParams.get('ref'),'fitstyle & test');
});
const source = await readFile(new URL('../js/AffiliateAdmin.js',import.meta.url),'utf8');
const summary = source.slice(source.indexOf('async function computeAffiliateTotals('),source.indexOf('/* =========================',source.indexOf('async function computeAffiliateTotals(')));
test('admin summary reads canonical selected-partner endpoint', async () => {
  const context = vm.createContext({ URLSearchParams, callFunction: async (route,options)=> {
    assert.equal(route,'affiliate-admin/summary'); assert.equal(options.method,'GET');
    assert.equal(options.query,'partner_id=owned-partner');
    return { ok:true,total_conversions:3,unique_referred_users:3,total_gmv:30,pending_commission:0,approved_commission:0,paid_commission:4 };
  } });
  vm.runInContext(`${summary}; globalThis.readSummary=computeAffiliateTotals;`,context);
  assert.equal((await context.readSummary({id:'owned-partner',commission_rate:15})).paid_commission,4);
});
test('failed/malformed summary cannot become zero totals', async () => {
  for (const data of [{ok:false},{ok:true},{ok:true,total_conversions:null}]) {
    const context=vm.createContext({URLSearchParams,callFunction:async()=>data});
    vm.runInContext(`${summary}; globalThis.readSummary=computeAffiliateTotals;`,context);
    await assert.rejects(context.readSummary({id:'owned-partner'}),/unavailable/);
  }
});
test('View Partner does not silently create a missing referral link', () => {
  const load = source.slice(source.indexOf('async function loadPartner('),source.indexOf('function renderConversions('));
  assert.equal(/const ensured = await ensureReferralLink/.test(load),false);
  assert.match(load,/role="alert">Affiliate totals are unavailable/);
});
test('one saved snapshot does not suppress current data for other applications', () => {
  const applications=[{user_id:'same-user',stats_snapshot:{tt:1}},{user_id:'same-user',stats_snapshot:null},{user_id:'same-user',stats_snapshot:{}},{user_id:'another-user',stats_snapshot:null}];
  assert.deepEqual(usersNeedingAudience(applications),['same-user','another-user']);
});
test('historical applications with snapshots do not request current audience', () => {
  assert.deepEqual(usersNeedingAudience([{user_id:'historical-user',stats_snapshot:{tt:0}}]),[]);
  assert.equal(applicationHasSnapshot({stats_snapshot:[]}),false);
});
test('audience display separates unavailable/current observations from saved snapshots', () => {
  assert.match(source,/usersNeedingAudience\(apps\)\.map/);
  assert.match(source,/applicationHasSnapshot\(a\) \? ""/);
  assert.match(source,/Current audience unavailable/);
  assert.match(source,/Checked/);
});
