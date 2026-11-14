-- Private native acceptance before public activation. No financial gates are changed.
create table meadow_littles_private.weekly_config(singleton boolean primary key default true check(singleton),enabled boolean not null default false,preview_users uuid[] not null default '{}');
insert into meadow_littles_private.weekly_config(singleton) values(true);
alter table meadow_littles_private.weekly_config enable row level security;
revoke all on meadow_littles_private.weekly_config from public,anon,authenticated;
create or replace function meadow_littles_private.weekly(p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=meadow_littles_private.require_actor();
 stamp timestamptz:=clock_timestamp();
 day date:=(stamp at time zone 'UTC')::date;
 start_week date:=date_trunc('week',stamp at time zone 'UTC')::date;
 entry meadow_littles_private.weekly_fair;
 run meadow_littles_private.weekly_rounds;
 ticket_id uuid;
 game_id text;
 parent_ready boolean;
 counted integer;
 spent integer;
 bonus_total integer;
 leaders jsonb;
 spent_map jsonb;
 place bigint;
 hash text;
 previous_shared boolean;
 enabled boolean;
 answer jsonb;
begin
 perform meadow_littles_private.guard_read(actor);
 select c.enabled or actor=any(c.preview_users) into enabled from meadow_littles_private.weekly_config c where singleton;
 if not coalesce(enabled,false) then
  if p_action is distinct from 'status' then raise exception 'LITTLES_WEEKLY_NOT_RELEASED';end if;
  return jsonb_build_object('contract','littles-weekly-v1','user_id',actor,'enabled',false,'week',start_week,'rounds',0,'days',array[0,0,0,0,0,0,0],'bonus_per_game',0,'bonus_spent','{}'::jsonb,'shared',false,'leaders','[]'::jsonb);
 end if;
 if not exists(select 1 from public.meadow_littles_profiles where user_id=actor) then raise exception 'LITTLES_OPEN_REQUIRED';end if;
 if p_action not in ('status','begin','finish','sharing') or jsonb_typeof(p_data)<>'object' then raise exception 'LITTLES_WEEKLY_INVALID';end if;
 -- Serialises completion/bonus spending and all devices of one account.
 perform pg_advisory_xact_lock(hashtextextended('littles-weekly:'||actor::text,0));
 select shared into previous_shared from meadow_littles_private.weekly_fair where user_id=actor order by week desc limit 1;
 hash:=encode(sha256(convert_to(actor::text||start_week::text,'UTF8')),'hex');
 insert into meadow_littles_private.weekly_fair(user_id,week,nickname,shared)
 values(actor,start_week,
 (array['Sunny','Happy','Cosy','Little','Bouncy','Smiley','Kind','Clever'])[1+get_byte(decode(hash,'hex'),0)%8]||' '||
 (array['Lamb','Duck','Hen','Calf','Pony','Bee','Bunny','Goat'])[1+get_byte(decode(hash,'hex'),1)%8]||' '||
 (1000+(('x'||substr(hash,5,6))::bit(24)::integer)%9000)::text,coalesce(previous_shared,false))
 on conflict(user_id,week) do nothing;
 select * into entry from meadow_littles_private.weekly_fair where user_id=actor and week=start_week;
 bonus_total:=(case when entry.rounds>=3 then 2 else 0 end)+(case when entry.rounds>=8 then 3 else 0 end)+(case when entry.rounds>=15 then 5 else 0 end);
 if p_action='sharing' then
  select not coalesce(is_anonymous,false) and email_confirmed_at is not null into parent_ready from auth.users where id=actor;
  if not coalesce(parent_ready,false) or jsonb_typeof(p_data->'enabled')<>'boolean' then raise exception 'LITTLES_PARENT_REQUIRED';end if;
  update meadow_littles_private.weekly_fair set shared=(p_data->>'enabled')::boolean where user_id=actor;
 elsif p_action='begin' then
  game_id:=p_data->>'game';
  if game_id is null or not game_id=any(array[
   'market_pretend','shape_shadows','together_animalrescue','together_picnicpartners','together_gardenhelpers','eggs','milk','sheep','goat','cow','lambcare','flowers','memory','sorting','tractorrepair','drawing','colourbynumber','matchpainting','coopmath','differences',
   'listenharvest','meadowpairs','spokenorder','paddockchange','farmerpattern','animalhome','barnyardlisten','applecartsort','harvestcount','gentleharvest','farmpicture','fullbasket',
   'letter_tracing','name_tracing','balloon_letters','word_search','sliding_picture','bee_shelter','harvest_slice','meadow_kitchen','farm_band','first_sounds',
   'meadow_story','little_farm_builder','hiding_friend','seed_to_snack','farm_weather','market_neighbours','farm_shapes','sound_garden','tractor_trail','meadow_keepsakes',
   'kindness_meadow','windmill_workshop','little_bridge_builders','haystack_tower','nest_builder','rainy_day_clothesline','pond_balance','orchard_seasons','barnyard_action_parade','farm_post_office',
   'learning_water','learning_sounds','learning_shares','learning_rolling','learning_patchwork','learning_orchard','learning_rhymes','learning_pip','learning_coding','learning_freeze',
   'together_connectfour','together_tictactoe','together_meadowrace','together_harvestbasket','together_memoryduel','together_memorygarden','together_rps',
   'together_picnic','together_planting','together_cozyhome','together_animalband','together_storywagon'
  ]) then raise exception 'LITTLES_WEEKLY_GAME';end if;
  ticket_id:=(p_data->>'request_id')::uuid;
  if ticket_id is null then raise exception 'LITTLES_WEEKLY_INVALID';end if;
  select * into run from meadow_littles_private.weekly_rounds where ticket=ticket_id;
  if found then
   if run.user_id<>actor or run.game<>game_id or run.week<>start_week then raise exception 'LITTLES_WEEKLY_CONFLICT';end if;
  else
   if (select count(*) from meadow_littles_private.weekly_rounds where user_id=actor and started_at>stamp-interval '1 minute')>=30 then raise exception 'LITTLES_WEEKLY_RATE_LIMIT';end if;
   insert into meadow_littles_private.weekly_rounds(ticket,user_id,game,week,started_at) values(ticket_id,actor,game_id,start_week,stamp);
  end if;
  return jsonb_build_object('contract','littles-weekly-v1','user_id',actor,'ticket',ticket_id);
 elsif p_action='finish' then
  ticket_id:=(p_data->>'ticket')::uuid;
  select * into run from meadow_littles_private.weekly_rounds where ticket=ticket_id and user_id=actor for update;
  if not found then raise exception 'LITTLES_WEEKLY_TICKET';end if;
  if run.finished_at is null then
   if run.week<>start_week or run.started_at>stamp-interval '2 seconds' or run.started_at<stamp-interval '2 hours' then raise exception 'LITTLES_WEEKLY_EXPIRED';end if;
   select count(*) into counted from meadow_littles_private.weekly_rounds where user_id=actor and week=start_week and game=run.game and scored and (finished_at at time zone 'UTC')::date=day;
   if coalesce((p_data->>'use_bonus')::boolean,false) then
    select count(*) into spent from meadow_littles_private.weekly_rounds where user_id=actor and week=start_week and game=run.game and bonus;
    if spent>=bonus_total then raise exception 'LITTLES_WEEKLY_NO_BONUS';end if;
   end if;
   update meadow_littles_private.weekly_rounds set finished_at=stamp,scored=counted<5,bonus=coalesce((p_data->>'use_bonus')::boolean,false) where ticket=ticket_id;
   if counted<5 then
    update meadow_littles_private.weekly_fair set rounds=rounds+1,days[extract(isodow from day)::integer]=days[extract(isodow from day)::integer]+1 where user_id=actor and week=start_week;
   end if;
  end if;
 end if;
 select * into entry from meadow_littles_private.weekly_fair where user_id=actor and week=start_week;
 bonus_total:=(case when entry.rounds>=3 then 2 else 0 end)+(case when entry.rounds>=8 then 3 else 0 end)+(case when entry.rounds>=15 then 5 else 0 end);
 select coalesce(jsonb_object_agg(game,n),'{}') into spent_map from(select game,count(*) n from meadow_littles_private.weekly_rounds where user_id=actor and week=start_week and bonus group by game) b;
 with ranked as (
  select user_id,nickname,rounds*10 points,dense_rank() over(order by rounds desc) position from meadow_littles_private.weekly_fair
  where week=start_week and shared and rounds>0
  -- Remove currently moderated participants without leaking decisions to the public board.
  and not coalesce((meadow_littles_private.fairplay_status(user_id)->>'banned')::boolean,false)
 ), top_rows as(select * from ranked order by points desc,nickname limit 20)
 select coalesce(jsonb_agg(jsonb_build_object('nickname',nickname,'points',points,'rank',position,'you',user_id=actor) order by points desc,nickname),'[]') into leaders from top_rows;
 if entry.shared and entry.rounds>0 then
  select count(distinct rounds)+1 into place from meadow_littles_private.weekly_fair where week=start_week and shared and rounds>entry.rounds and not coalesce((meadow_littles_private.fairplay_status(user_id)->>'banned')::boolean,false);
 end if;
 return jsonb_build_object('contract','littles-weekly-v1','user_id',actor,'week',start_week,'ends_at',(start_week+7)::text||'T00:00:00Z',
 'enabled',true,'rounds',entry.rounds,'days',entry.days,'bonus_per_game',bonus_total,'bonus_spent',spent_map,'shared',entry.shared,'nickname',entry.nickname,'rank',place,'leaders',leaders);
end $$;
