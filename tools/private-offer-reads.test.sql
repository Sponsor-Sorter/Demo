-- Transaction-only fixtures. No real account or financial records are edited.
begin;
do $test$
declare
  members uuid[];
  emails text[];
  admin_id uuid;
  admin_email text;
  offer_id uuid := gen_random_uuid();
  review_id integer := -1900000000 - floor(random()*100000000)::integer;
  i integer;
  visible_count integer;
begin
  select array_agg(user_id order by user_id), array_agg(email order by user_id)
  into members, emails from (
    select distinct user_id,email from public.users_extended_data
    where not coalesce(is_admin,false) and user_id is not null and email is not null
      and user_id <> '62a9095d-d212-4dd5-842b-6b575b879be7'
      and lower(username) <> 'moikailive'
    order by user_id limit 3
  ) fixtures;
  select user_id,email into admin_id,admin_email from public.users_extended_data
  where is_admin and user_id <> '62a9095d-d212-4dd5-842b-6b575b879be7'
    and lower(username) <> 'moikailive' limit 1;
  if cardinality(members)<>3 or admin_id is null then raise exception 'Missing safe fixtures'; end if;
  insert into public.private_offers(id,sponsor_email,sponsor_company,sponsee_username,sponsee_email,sponsor_id,sponsee_id,offer_title)
  values(offer_id,emails[1],'RLS rollback fixture','RLS rollback fixture',emails[2],members[1],members[2],'Private fixture');
  insert into public.private_offer_reviews(id,offer_id,reviewer_id,reviewer_role,overall,review_text)
  values(review_id,offer_id,members[1],'sponsor',5,'RLS rollback fixture');

  perform set_config('request.jwt.claims','{}',true);
  perform set_config('request.jwt.claim.sub','',true);
  execute 'set local role anon';
  if has_table_privilege(current_user,'public.private_offers','select')
    or has_table_privilege(current_user,'public.private_offer_reviews','select') then
    raise exception 'Visitor still has raw private table grants';
  end if;
  -- Public projections remain queryable with their existing opt-in filters.
  perform 1 from public.public_user_directory limit 1;
  perform 1 from public.public_user_profiles limit 1;
  perform 1 from public.public_profile_reviews limit 1;
  execute 'reset role';

  for i in 1..4 loop
    perform set_config('request.jwt.claim.sub',case when i=4 then admin_id::text else members[i]::text end,true);
    perform set_config('request.jwt.claims',json_build_object('sub',case when i=4 then admin_id else members[i] end,
      'email',case when i=4 then admin_email else emails[i] end,'role','authenticated')::text,true);
    execute 'set local role authenticated';
    select count(*) into visible_count from public.private_offers o where o.id=offer_id;
    if visible_count <> (case when i=3 then 0 else 1 end) then raise exception 'Incorrect offer visibility for fixture role %',i; end if;
    select count(*) into visible_count from public.private_offer_reviews r where r.id=review_id;
    if visible_count <> (case when i=3 then 0 else 1 end) then raise exception 'Incorrect review visibility for fixture role %',i; end if;
    execute 'reset role';
  end loop;
end;
$test$;
rollback;

