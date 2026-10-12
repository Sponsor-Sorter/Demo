const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('../.validation/node_modules/@electric-sql/pglite');
test('notification recipients can mark read but cannot rewrite content or routing',async()=>{
 const db=new PGlite();try{
 await db.exec(`create schema auth; create role anon; create role authenticated;
 create function auth.role() returns text language sql as $$select current_setting('request.jwt.claim.role',true)$$;
 create table public.user_notifications(id int primary key,email text,title text,message text,type text,read boolean,created_at timestamptz,notification_uuid uuid,related_offer_id uuid,error text);
 insert into public.user_notifications values(1,'test@example.com','Original','Message','offer',false,now(),null,null,null);`);
 await db.exec(fs.readFileSync('supabase/migrations/20261012121143_protect_notification_content.sql','utf8'));
 await db.exec(`set request.jwt.claim.role='authenticated'; update public.user_notifications set read=true where id=1;`);
 assert.equal((await db.query('select read from public.user_notifications')).rows[0].read,true);
 for(const change of ["email='other@example.com'","title='Forged'","message='Forged'","type='admin'","notification_uuid='00000000-0000-4000-8000-000000000001'","related_offer_id='00000000-0000-4000-8000-000000000001'","id=2","created_at=now()+interval '1 day'","error='Forged'"]){await assert.rejects(db.exec('update public.user_notifications set '+change+' where id=1'),/cannot be changed/);}
 await db.exec(`set request.jwt.claim.role='service_role';update public.user_notifications set title='Server corrected' where id=1;`);
 assert.equal((await db.query('select title from public.user_notifications')).rows[0].title,'Server corrected');
 }finally{await db.close();}
});
