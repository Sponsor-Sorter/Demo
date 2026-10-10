begin;
do $test$
declare members uuid[]; emails text[]; draft_offer uuid:=gen_random_uuid(); object_name text; draft_id uuid; n integer;
begin
 select array_agg(user_id order by user_id),array_agg(email order by user_id) into members,emails from (
  select distinct user_id,email from public.users_extended_data
  where user_id is not null and email is not null and not coalesce(banned,false) and not coalesce(is_admin,false)
   and user_id<>'62a9095d-d212-4dd5-842b-6b575b879be7' and lower(username)<>'moikailive'
  order by user_id limit 3
 ) safe;
 if cardinality(members)<>3 then raise exception 'Safe fixture accounts missing'; end if;
 insert into public.private_offers(id,sponsor_id,sponsee_id,sponsor_email,sponsee_email,sponsor_company,sponsee_username,offer_title,offer_amount,stage,status,platforms)
 values(draft_offer,members[1],members[2],emails[1],emails[2],'Rollback-only fixture','Rollback-only fixture','Private draft permission test',100,2,'accepted',array['youtube']);
 object_name:=draft_offer::text||'/'||members[2]::text||'/'||gen_random_uuid()::text||'.mp4';
 -- Synthetic Storage metadata, not a real uploaded video. Rollback removes it.
 insert into storage.objects(bucket_id,name,owner_id,metadata) values('offer-submissions',object_name,members[2]::text,'{"size":100,"mimetype":"video/mp4"}');
 perform set_config('request.jwt.claim.sub',members[2]::text,true);
 perform set_config('request.jwt.claims',json_build_object('sub',members[2],'email',emails[2],'role','authenticated')::text,true);
 execute 'set local role authenticated';
 begin update public.private_offers set stage=5 where id=draft_offer; raise exception 'Client marked payment completed';
 exception when others then if sqlerrm='Client marked payment completed' then raise; end if; end;
 begin update public.private_offers set stage=null where id=draft_offer; raise exception 'Client cleared workflow stage';
 exception when others then if sqlerrm='Client cleared workflow stage' then raise; end if; end;
 draft_id:=public.submit_offer_video(draft_offer,object_name,'Fixture.mp4','Rollback-only test');
 if public.submit_offer_video(draft_offer,object_name,'Fixture.mp4','Retry')<>draft_id then raise exception 'Submission replay failed'; end if;
 begin perform public.review_offer_video(draft_id,'approved',''); raise exception 'Creator approved own draft';
 exception when others then if sqlerrm='Creator approved own draft' then raise; end if; end;
 execute 'reset role';
 perform set_config('request.jwt.claim.sub',members[3]::text,true);
 perform set_config('request.jwt.claims',json_build_object('sub',members[3],'email',emails[3],'role','authenticated')::text,true);
 execute 'set local role authenticated';
 select count(*) into n from public.offer_submissions where offer_id=draft_offer;
 if n<>0 then raise exception 'Outsider can see drafts'; end if;
 select count(*) into n from storage.objects where bucket_id='offer-submissions' and name=object_name;
 if n<>0 then raise exception 'Outsider can see private files'; end if;
 execute 'reset role';
 perform set_config('request.jwt.claim.sub',members[1]::text,true);
 perform set_config('request.jwt.claims',json_build_object('sub',members[1],'email',emails[1],'role','authenticated')::text,true);
 execute 'set local role authenticated';
 select count(*) into n from public.offer_submissions where id=draft_id;
 if n<>1 then raise exception 'Sponsor cannot see draft'; end if;
 perform public.review_offer_video(draft_id,'approved','Approved rollback fixture');
 perform public.review_offer_video(draft_id,'approved','Idempotent retry');
 execute 'reset role';
 if not exists(select 1 from public.offer_submissions where id=draft_id and status='approved' and reviewed_by=members[1]) then raise exception 'Approval not recorded'; end if;
 execute 'set local role anon';
 if has_table_privilege(current_user,'public.offer_submissions','select') or has_function_privilege(current_user,'public.submit_offer_video(uuid,text,text,text)','execute') then raise exception 'Anonymous draft access'; end if;
 execute 'reset role';
end;
$test$;
rollback;
select 'PASS: live draft permissions, submission/review replay and anonymous denial; all fixtures rolled back' result;
