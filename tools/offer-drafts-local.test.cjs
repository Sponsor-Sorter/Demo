const { PGlite } = require("../.validation/node_modules/@electric-sql/pglite");
const fs = require("node:fs");
const assert = require("node:assert/strict");
const path = require("node:path");
const migration = fs.readFileSync(
  path.join(
    __dirname,
    "../supabase/migrations/20261010204209_private_offer_draft_review.sql",
  ),
  "utf8",
);
(async () => {
  const db = new PGlite();
  await db.exec(`
create role anon; create role authenticated;
create schema auth; grant usage on schema auth to authenticated,anon;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
create table public.users_extended_data(id uuid primary key,user_id uuid,email text,username text,is_admin boolean default false,banned boolean default false);
create table public.private_offers(id uuid primary key,sponsor_id uuid,sponsee_id uuid,sponsor_email text,sponsee_email text,offer_amount numeric,payment_schedule text,group_offer text,payout_status text default 'unpaid',payout_id uuid,creation_date date,live_url text,live_date date,sponsee_live_confirmed boolean,sponsor_live_confirmed boolean,stage integer,status text,archived boolean default false,platforms text[],live_urls text[],url_dates date[]);
create table public.private_offer_comments(id uuid primary key default gen_random_uuid(),offer_id uuid,user_id uuid,sponsor_id uuid,sponsee_id uuid,sponsor_email text,sponsee_email text,sender text,comment_text text,created_at timestamptz default now());
alter table public.private_offer_comments enable row level security;
create policy legacy_comments on public.private_offer_comments to authenticated using(true) with check(true);
create schema storage; grant usage on schema storage to authenticated;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner_id text,metadata jsonb,unique(bucket_id,name));
alter table storage.objects enable row level security;
create policy legacy_read on storage.objects for select to authenticated using(true);
create policy legacy_insert on storage.objects for insert to authenticated with check(true);
create policy legacy_update on storage.objects for update to authenticated using(true) with check(true);
create policy legacy_delete on storage.objects for delete to authenticated using(true);
grant select,insert,update,delete on storage.objects,public.private_offers,public.private_offer_comments to authenticated;
`);
  await db.exec(migration);
  await db.exec(
    fs.readFileSync(
      path.join(
        __dirname,
        "../supabase/migrations/20261010205323_support_snapchat_content_links.sql",
      ),
      "utf8",
    ),
  );
  await db.exec(
    fs.readFileSync(
      path.join(
        __dirname,
        "../supabase/migrations/20261010205903_restrict_legacy_private_storage.sql",
      ),
      "utf8",
    ),
  );
  await db.exec(
    fs.readFileSync(
      path.join(
        __dirname,
        "../supabase/migrations/20261010210228_enforce_private_offer_actors.sql",
      ),
      "utf8",
    ),
  );
  const sponsor = "11111111-1111-4111-8111-111111111111",
    creator = "22222222-2222-4222-8222-222222222222",
    outsider = "33333333-3333-4333-8333-333333333333",
    offer = "44444444-4444-4444-8444-444444444444";
  await db.query(
    `insert into users_extended_data(id,user_id,email,username) values ($1,$1,'sponsor@fixture.invalid','Sponsor'),($2,$2,'creator@fixture.invalid','Creator'),($3,$3,'outside@fixture.invalid','Outsider')`,
    [sponsor, creator, outsider],
  );
  await db.query(
    `insert into private_offers(id,sponsor_id,sponsee_id,sponsor_email,sponsee_email,offer_amount,stage,status,platforms) values($1,$2,$3,'sponsor@fixture.invalid','creator@fixture.invalid',100,2,'accepted',array['youtube'])`,
    [offer, sponsor, creator],
  );
  async function asUser(uid, sql, args = []) {
    await db.exec("begin");
    try {
      await db.query(
        "select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",
        [uid, JSON.stringify({ sub: uid, role: "authenticated" })],
      );
      await db.exec("set local role authenticated");
      const result = await db.query(sql, args);
      await db.exec("commit");
      return result;
    } catch (e) {
      await db.exec("rollback");
      throw e;
    }
  }
  const object =
    offer + "/" + creator + "/55555555-5555-4555-8555-555555555555.mp4";
  for (const bucket of ["invoices", "sponsorship-proofs"]) {
    const privatePath = creator + "/private-fixture.pdf";
    await asUser(
      creator,
      "insert into storage.objects(bucket_id,name,owner_id,metadata) values($1,$2,$3,'{}')",
      [bucket, privatePath, creator],
    );
    assert.equal(
      (
        await asUser(
          creator,
          "select id from storage.objects where bucket_id=$1",
          [bucket],
        )
      ).rows.length,
      1,
    );
    assert.equal(
      (
        await asUser(
          outsider,
          "select id from storage.objects where bucket_id=$1",
          [bucket],
        )
      ).rows.length,
      0,
    );
    await assert.rejects(
      asUser(
        outsider,
        "insert into storage.objects(bucket_id,name,owner_id,metadata) values($1,$2,$3,'{}')",
        [bucket, creator + "/forged.pdf", outsider],
      ),
      /row-level security/,
    );
  }

  await assert.rejects(
    asUser(
      outsider,
      `insert into storage.objects(bucket_id,name,owner_id,metadata) values('offer-submissions',$1,$2,'{"size":100,"mimetype":"video/mp4"}')`,
      [object, outsider],
    ),
    /row-level security/,
  );
  await asUser(
    creator,
    `insert into storage.objects(bucket_id,name,owner_id,metadata) values('offer-submissions',$1,$2,'{"size":100,"mimetype":"video/mp4"}')`,
    [object, creator],
  );
  let result = await asUser(
    creator,
    "select public.submit_offer_video($1,$2,$3,$4) id",
    [offer, object, "Draft.mp4", "First draft"],
  );
  const draft = result.rows[0].id;
  assert.equal(
    (
      await asUser(
        creator,
        "select public.submit_offer_video($1,$2,$3,$4) id",
        [offer, object, "Draft.mp4", "Retry"],
      )
    ).rows[0].id,
    draft,
  );
  assert.equal(
    (await asUser(outsider, "select * from public.offer_submissions")).rows
      .length,
    0,
  );
  assert.equal(
    (
      await asUser(
        outsider,
        "select * from storage.objects where bucket_id='offer-submissions'",
      )
    ).rows.length,
    0,
  );
  assert.equal(
    (await asUser(sponsor, "select * from public.offer_submissions")).rows
      .length,
    1,
  );
  assert.equal(
    (
      await asUser(
        creator,
        "update storage.objects set metadata='{}' where name=$1 returning id",
        [object],
      )
    ).rows.length,
    0,
  );
  assert.equal(
    (
      await asUser(
        creator,
        "delete from storage.objects where name=$1 returning id",
        [object],
      )
    ).rows.length,
    0,
  );
  await assert.rejects(
    asUser(creator, "select public.review_offer_video($1,'approved','')", [
      draft,
    ]),
    /Only the sponsor/,
  );
  await assert.rejects(
    asUser(creator, "update private_offers set stage=null where id=$1", [
      offer,
    ]),
    /Invalid sponsorship state/,
  );
  await asUser(creator, "update private_offers set stage=3 where id=$1", [
    offer,
  ]);
  const liveSql =
    "update public.private_offers set stage=4,status='live',sponsee_live_confirmed=true,live_urls=array['https://youtube.com/watch?v=fixture'],url_dates=array['2026-10-10'::date] where id=$1";
  await assert.rejects(asUser(creator, liveSql, [offer]), /approve the latest/);
  await assert.rejects(
    asUser(
      sponsor,
      "select public.review_offer_video($1,'changes_requested','')",
      [draft],
    ),
    /Describe/,
  );
  await asUser(
    sponsor,
    "select public.review_offer_video($1,'approved','Looks good')",
    [draft],
  );
  await asUser(
    sponsor,
    "select public.review_offer_video($1,'approved','Retry')",
    [draft],
  );
  await assert.rejects(
    asUser(
      sponsor,
      "select public.review_offer_video($1,'changes_requested','Undo')",
      [draft],
    ),
    /latest pending/,
  );
  const object2 = object.replace(
    "55555555-5555-4555-8555-555555555555",
    "66666666-6666-4666-8666-666666666666",
  );
  await asUser(
    creator,
    'insert into storage.objects(bucket_id,name,owner_id,metadata) values(\'offer-submissions\',$1,$2,\'{"size":100,"mimetype":"video/mp4"}\')',
    [object2, creator],
  );
  const draft2 = (
    await asUser(creator, "select public.submit_offer_video($1,$2,$3,$4) id", [
      offer,
      object2,
      "Revision.mp4",
      "Second version",
    ])
  ).rows[0].id;
  await assert.rejects(asUser(creator, liveSql, [offer]), /approve the latest/);
  await asUser(
    sponsor,
    "select public.review_offer_video($1,'changes_requested','Shorten intro')",
    [draft2],
  );
  await assert.rejects(asUser(creator, liveSql, [offer]), /approve the latest/);
  const object3 = object.replace(
    "55555555-5555-4555-8555-555555555555",
    "77777777-7777-4777-8777-777777777777",
  );
  await asUser(
    creator,
    'insert into storage.objects(bucket_id,name,owner_id,metadata) values(\'offer-submissions\',$1,$2,\'{"size":100,"mimetype":"video/mp4"}\')',
    [object3, creator],
  );
  const draft3 = (
    await asUser(creator, "select public.submit_offer_video($1,$2,$3,$4) id", [
      offer,
      object3,
      "Final.mp4",
      "Requested changes",
    ])
  ).rows[0].id;
  await asUser(
    sponsor,
    "select public.review_offer_video($1,'approved','Final approved')",
    [draft3],
  );
  await assert.rejects(
    asUser(
      creator,
      "update public.private_offers set offer_amount=999 where id=$1",
      [offer],
    ),
    /payment terms/,
  );
  await assert.rejects(
    asUser(
      creator,
      "update public.private_offers set stage=4,status='live',sponsee_live_confirmed=true,live_urls=array['https://youtube.com.evil.invalid/video'],url_dates=array['2026-10-10'::date] where id=$1",
      [offer],
    ),
    /agreed platform/,
  );
  await assert.rejects(
    asUser(
      creator,
      "update private_offers set platforms=array['tiktok'] where id=$1",
      [offer],
    ),
    /payment terms/,
  );
  await asUser(creator, liveSql, [offer]);
  await assert.rejects(
    asUser(
      creator,
      "update private_offers set sponsor_live_confirmed=true,status='completed' where id=$1",
      [offer],
    ),
    /Only the sponsor/,
  );
  await asUser(
    sponsor,
    "update private_offers set sponsor_live_confirmed=true,status='completed' where id=$1",
    [offer],
  );
  await assert.rejects(
    asUser(creator, "update private_offers set stage=5 where id=$1", [offer]),
    /verified server settlement/,
  );
  await assert.rejects(
    asUser(
      creator,
      "update private_offers set live_urls=array['https://youtube.com/watch?v=replaced'] where id=$1",
      [offer],
    ),
    /Confirmed publication details/,
  );
  await asUser(
    creator,
    "insert into public.private_offer_comments(offer_id,user_id,sender,comment_text) values($1,$2,'Impersonated sponsor','Hello')",
    [offer, creator],
  );
  result = await asUser(
    sponsor,
    "select sender from public.private_offer_comments",
  );
  assert.equal(result.rows[0].sender, "Creator");
  await assert.rejects(
    asUser(
      outsider,
      "insert into public.private_offer_comments(offer_id,user_id,comment_text) values($1,$2,'Unauthorized')",
      [offer, outsider],
    ),
    /participants/,
  );
  await db.query(
    "update private_offers set stage=5,status='review_completed',archived=true where id=$1",
    [offer],
  );
  assert.equal(
    (await asUser(sponsor, "select * from public.offer_submissions")).rows
      .length,
    3,
  );
  await db.exec("set role anon");
  assert.equal(
    (
      await db.query(
        "select has_table_privilege(current_user,'public.offer_submissions','select') allowed",
      )
    ).rows[0].allowed,
    false,
  );
  await db.exec("reset role");
  await db.close();
  console.log(
    "PASS: migration parses; upload ownership; participant privacy; immutable assets; idempotent submission/review; approval gate; terms guard; platform URL matching; comment authorship; archived evidence; anonymous access. No live records used.",
  );
})().catch((e) => {
  console.error(e.message, e.position || e.where || "");
  process.exitCode = 1;
});
