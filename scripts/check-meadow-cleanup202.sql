begin;
create temporary table cleanup_fixture as select gen_random_uuid() as exclusive_id,gen_random_uuid() as shared_id,gen_random_uuid() as real_email_id;
create table public.meadow_cleanup_other_app_fixture(owner_id uuid primary key references auth.users(id) on delete cascade,payload jsonb);
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
 select id,'player-'||id::text||'@players.sponsorsorter.com',now(),'{"meadow_app":"meadow-markets"}'::jsonb from
 (select exclusive_id as id from cleanup_fixture union all select shared_id from cleanup_fixture) x;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) select real_email_id,'cleanup-'||real_email_id::text||'@example.test',now(),'{"meadow_app":"meadow-markets"}'::jsonb from cleanup_fixture;
insert into public.meadow_market_profiles(user_id,friend_code,display_name) select id,'cleanup-'||id::text,'Cleanup fixture' from auth.users where id in(select exclusive_id from cleanup_fixture union select shared_id from cleanup_fixture union select real_email_id from cleanup_fixture);
insert into public.meadow_cleanup_other_app_fixture(owner_id,payload) select shared_id,'{"preserve":"another app"}'::jsonb from cleanup_fixture;
insert into meadow_private.account_deletions(user_id,execute_after) select user_id,now()-interval '1 second' from public.meadow_market_profiles where user_id in(select exclusive_id from cleanup_fixture union select shared_id from cleanup_fixture union select real_email_id from cleanup_fixture);
do $$ begin
 if exists(select 1 from meadow_private.account_deletions where execute_after<=now() and user_id not in(select exclusive_id from cleanup_fixture union select shared_id from cleanup_fixture union select real_email_id from cleanup_fixture)) then raise exception 'Fixture refuses to touch real pending deletions'; end if;
 if meadow_private.erase_due_game_accounts()<>3 then raise exception 'FAIL game erase'; end if;
 if not meadow_private.exclusive_retired_login((select exclusive_id from cleanup_fixture)) then raise exception 'FAIL exclusive candidate'; end if;
 if meadow_private.exclusive_retired_login((select shared_id from cleanup_fixture)) then raise exception 'FAIL shared candidate'; end if;
 if meadow_private.exclusive_retired_login((select real_email_id from cleanup_fixture)) then raise exception 'FAIL metadata spoof'; end if;
 if (select count(*) from meadow_private.auth_retirements where user_id in(select exclusive_id from cleanup_fixture union select shared_id from cleanup_fixture))<>2 then raise exception 'FAIL queue creation'; end if;
end $$;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
create temporary table cleanup_claim as select public.meadow_market_retire_login('claim') as jobs;
do $$ declare jobs jsonb:=(select jobs from cleanup_claim); id uuid:=(select exclusive_id from cleanup_fixture); token uuid;
begin
 if jsonb_array_length(jobs)<>1 or jobs->0->>'user_id'<>id::text then raise exception 'FAIL safe claim'; end if;
 token:=(jobs->0->>'lease')::uuid;
 if public.meadow_market_retire_login('confirm',id,gen_random_uuid())<>'false'::jsonb then raise exception 'FAIL wrong lease'; end if;
 if public.meadow_market_retire_login('confirm',id,token)<>'true'::jsonb then raise exception 'FAIL confirm'; end if;
 -- Simulate another app taking ownership after claim. Fresh confirmation must refuse.
 insert into public.meadow_cleanup_other_app_fixture(owner_id,payload) values(id,'{"later":true}');
 if public.meadow_market_retire_login('confirm',id,token)<>'false'::jsonb then raise exception 'FAIL stale ownership'; end if;
 delete from public.meadow_cleanup_other_app_fixture where owner_id=id;
 if public.meadow_market_retire_login('finish',id,token,true)<>'false'::jsonb then raise exception 'FAIL premature success'; end if;
 if not exists(select 1 from auth.users au where au.id=(select shared_id from cleanup_fixture)) or not exists(select 1 from public.meadow_cleanup_other_app_fixture where owner_id=(select shared_id from cleanup_fixture)) then raise exception 'FAIL other app lost'; end if;
 if has_function_privilege('authenticated','public.meadow_market_retire_login(text,uuid,uuid,boolean)','execute') then raise exception 'FAIL player cleanup access'; end if;
 if has_table_privilege('authenticated','meadow_private.auth_retirements','select') then raise exception 'FAIL queue exposure'; end if;
end $$;
rollback;
select 'PASS: cancelled-window purge pipeline, generated exclusive alias, shared/real-email preservation, user-metadata spoof denial, fresh ownership/lease checks, retry and private access; all fixture rows rolled back' as result;
