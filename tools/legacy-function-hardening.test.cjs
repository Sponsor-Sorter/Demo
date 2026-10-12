const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('../.validation/node_modules/@electric-sql/pglite');

test('pinned functions ignore temporary-table shadowing; wallet RPC is server-only', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create table public.api_action_log(user_id uuid, action_type text);
      create function public.log_comment_action() returns trigger language plpgsql as $$
      begin insert into api_action_log values(new.user_id,'comment'); return new; end $$;
      create function public.increment_wallet_balance(uuid,numeric) returns void language sql as 'select';
      create table public.comments(user_id uuid);
      create trigger comment_log after insert on public.comments for each row execute function public.log_comment_action();
      create temporary table api_action_log(user_id uuid,action_type text);
    `);
    const migration = fs.readFileSync('supabase/migrations/20261012102500_pin_legacy_function_search_paths.sql','utf8');
    await db.exec(migration);
    await db.exec(migration); // migration remains safe to replay
    await db.exec("insert into public.comments values('11111111-1111-4111-8111-111111111111')");
    assert.equal((await db.query('select count(*) as n from public.api_action_log')).rows[0].n, 1);
    assert.equal((await db.query('select count(*) as n from pg_temp.api_action_log')).rows[0].n, 0);
    const { rows } = await db.query(`select
      has_function_privilege('anon','public.increment_wallet_balance(uuid,numeric)','execute') as anon,
      has_function_privilege('authenticated','public.increment_wallet_balance(uuid,numeric)','execute') as authenticated,
      has_function_privilege('service_role','public.increment_wallet_balance(uuid,numeric)','execute') as service`);
    assert.deepEqual(rows[0], { anon:false, authenticated:false, service:true });
  } finally { await db.close(); }
});
