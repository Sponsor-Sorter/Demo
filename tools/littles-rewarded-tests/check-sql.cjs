'use strict';
// Execute the actual migration in an in-memory PostgreSQL fixture, never a hosted database.
const { PGlite } = require('@electric-sql/pglite');
const fs = require('node:fs'), path = require('node:path'), test = require('node:test'), assert = require('node:assert/strict');
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';
const CLIENT = '33333333-3333-4333-8333-333333333333', OTHER = '44444444-4444-4444-8444-444444444444';
test('Actual SQL migration: default-off gates, live-actor boundary, idempotency, SSV ownership and ACLs', async () => {
  const db = await PGlite.create();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth; create table auth.users(id uuid primary key);
      insert into auth.users values('${A}'),('${B}');
      create schema meadow_littles_private;
      grant usage on schema meadow_littles_private to authenticated,service_role;
      create function meadow_littles_private.require_actor() returns uuid language plpgsql security definer set search_path='' as $$
        declare actor uuid:=nullif(current_setting('fixture.actor',true),'')::uuid;
        begin if actor is null or current_setting('fixture.session',true)='invalid' or not exists(select 1 from auth.users where id=actor) then raise exception using errcode='42501',message='SIGN_IN_REQUIRED';end if;return actor;end $$;
      create function meadow_littles_private.play_status() returns jsonb language sql security definer set search_path='' as $$
        select jsonb_build_object('parent_ready',coalesce(nullif(current_setting('fixture.parent',true),'')::boolean,true),'ads_enabled',coalesce(nullif(current_setting('fixture.ads',true),'')::boolean,true)) $$;
      create function public.meadow_littles_plus_projection(uuid) returns jsonb language sql set search_path='' as $$
        select jsonb_build_object('effective_verified',coalesce(nullif(current_setting('fixture.verified',true),'')::boolean,true),'effective_plus',coalesce(nullif(current_setting('fixture.plus',true),'')::boolean,false)) $$;
    `);
    await db.exec(fs.readFileSync(path.resolve(__dirname, '../../supabase/migrations/20261122130357_littles_rewarded_rounds91.sql'), 'utf8'));
    const set = async (key, value) => db.query('select set_config($1,$2,false)', ['fixture.' + key, value]);
    const role = async value => db.exec('reset role; set role ' + value);
    const call = async (action, data = {}) => (await db.query('select public.meadow_littles_ad_rounds($1,$2::jsonb) as result', [action, JSON.stringify({ client: CLIENT, ...data })])).rows[0].result;
    const record = async (challenge, transaction = 'transaction_one', unit = 'ca-app-pub-6946008351204848/6193791997', at = new Date().toISOString()) => (await db.query('select public.meadow_littles_record_ad_round($1,$2,$3,$4::timestamptz) as result', [challenge, transaction, unit, at])).rows[0].result;
    const denied = async (fn, code) => assert.rejects(fn, error => error.code === code);
    await role('authenticated'); await set('actor', A);
    assert.equal((await call('status')).enabled, false);
    await denied(() => call('prepare', { game: 'harvest_slice', requestId: crypto.randomUUID() }), '42501');
    await denied(() => db.query('select * from meadow_littles_private.ad_round_config'), '42501');
    await denied(() => record(crypto.randomUUID()), '42501');
    await db.exec('reset role');
    await db.query("update meadow_littles_private.ad_round_config set format_reviewed=true,private_users=array[$1::uuid],private_until=now()+interval '30 minutes'", [A]);
    await role('authenticated');
    assert.equal((await call('status')).enabled, true);
    await set('ads','false');assert.equal((await call('status')).privateTest,true);assert.equal((await call('status')).enabled,false);
    await denied(()=>call('prepare',{game:'harvest_slice',requestId:crypto.randomUUID()}),'42501');await set('ads','true');
    for (const [key, value] of [['parent', 'false'], ['plus', 'true'], ['verified', 'false']]) {
      await set(key, value); assert.equal((await call('status')).enabled, false); await set(key, key === 'plus' ? 'false' : 'true');
    }
    await set('session', 'invalid'); await denied(() => call('status'), '42501'); await set('session', 'valid');
    const requestId = crypto.randomUUID(), first = await call('prepare', { game: 'harvest_slice', requestId });
    assert.deepEqual(await call('prepare', { game: 'harvest_slice', requestId }), first);
    await denied(() => call('prepare', { game: 'meadowpairs', requestId }), '22023');
    await denied(() => call('prepare', { game: 'harvest_slice', requestId, client: OTHER }), '22023');
    assert.equal((await call('claim', { game: 'harvest_slice', challenge: first.challenge })).status, 'pending');
    await role('service_role');
    await denied(() => record(first.challenge, 'transaction_one', 'wrong-unit'), '22023');
    assert.equal((await record(first.challenge)).duplicate, false); assert.equal((await record(first.challenge)).duplicate, true);
    await denied(() => record(first.challenge, 'different_transaction'), '22023');
    await role('authenticated');
    const receipt = await call('claim', { game: 'harvest_slice', challenge: first.challenge });
    assert.equal(receipt.verified, true); assert.equal(receipt.actor, A); assert.equal(receipt.game, 'harvest_slice'); assert.equal(receipt.amount, 1);
    assert.deepEqual(await call('claim', { game: 'harvest_slice', challenge: first.challenge }), receipt);
    await denied(() => call('claim', { game: 'meadowpairs', challenge: first.challenge }), '42501');
    await denied(() => call('claim', { game: 'harvest_slice', challenge: first.challenge, client: OTHER }), '42501');
    await set('actor', B); assert.equal((await call('status')).enabled, false);
    await denied(() => call('claim', { game: 'harvest_slice', challenge: first.challenge }), '42501'); await set('actor', A);
    const second = await call('prepare', { game: 'meadowpairs', requestId: crypto.randomUUID() });
    await role('service_role'); await denied(() => record(second.challenge), '23505');
    await role('authenticated'); assert.equal((await call('claim', { game: 'meadowpairs', challenge: second.challenge })).status, 'pending');
    await db.exec('reset role'); await db.exec('update meadow_littles_private.ad_round_config set max_prepares_per_hour=2');
    await role('authenticated'); await denied(() => call('prepare', { game: 'harvest_slice', requestId: crypto.randomUUID() }), 'P0001');
    assert.equal((await call('prepare', { game: 'harvest_slice', requestId })).challenge, first.challenge, 'Idempotent lookup does not spend the request cap');
    await role('anon'); await denied(() => call('status'), '42501');
    await db.exec('reset role');
    const rows = (await db.query('select transaction_id from meadow_littles_private.ad_round_requests where verified_at is not null')).rows;
    assert.equal(rows.length, 1, 'Exactly one signed provider transaction has a verified row');
  } finally { await db.close(); }
});
