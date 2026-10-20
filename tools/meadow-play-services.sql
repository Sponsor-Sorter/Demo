-- Meadow Markets only. Test economy: no payment or ad network is connected.
create schema if not exists meadow_private;
revoke all on schema meadow_private from public, anon;
grant usage on schema meadow_private to authenticated;
create table public.meadow_market_play_runs (
 id uuid primary key, user_id uuid not null references public.meadow_market_profiles(user_id) on delete cascade,
 game text not null, week date not null, level int not null check(level between 1 and 10000),
 points int not null check(points between 0 and 10000000), won boolean not null,
 created_at timestamptz not null default now()
);
create index meadow_play_rank on public.meadow_market_play_runs(week,game,points desc);
create index meadow_play_owner on public.meadow_market_play_runs(user_id,created_at);
create table public.meadow_market_wallets (
 user_id uuid primary key references public.meadow_market_profiles(user_id) on delete cascade,
 gems int not null default 0 check(gems>=0), premium boolean not null default false,
 reward_turns int not null default 0 check(reward_turns>=0), ads_enabled boolean not null default false,
 updated_at timestamptz not null default now(), vip_xp bigint not null default 0 check(vip_xp>=0)
);
create table public.meadow_market_economy_receipts (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.meadow_market_profiles(user_id) on delete cascade,
 request_id uuid not null, kind text not null, claim_key text, delivery jsonb not null default '{}',
 created_at timestamptz not null default now(), unique(user_id,request_id),unique(user_id,claim_key)
);
create table public.meadow_market_mission_events (
 id uuid primary key, user_id uuid not null references public.meadow_market_profiles(user_id) on delete cascade,
 event text not null, amount int not null check(amount between 1 and 100),created_at timestamptz not null default now()
);
create index meadow_missions_owner_time on public.meadow_market_mission_events(user_id,created_at,event);
alter table public.meadow_market_play_runs enable row level security;
alter table public.meadow_market_wallets enable row level security;
alter table public.meadow_market_economy_receipts enable row level security;
alter table public.meadow_market_mission_events enable row level security;
revoke all on public.meadow_market_play_runs,public.meadow_market_wallets,public.meadow_market_economy_receipts,public.meadow_market_mission_events from anon,authenticated;
grant select on public.meadow_market_wallets,public.meadow_market_economy_receipts to authenticated;
create policy meadow_wallet_owner on public.meadow_market_wallets for select to authenticated using(user_id=(select auth.uid()));
create policy meadow_receipts_owner on public.meadow_market_economy_receipts for select to authenticated using(user_id=(select auth.uid()));
-- Atomic wallet writes, bounded test scores and private friendship lookups need a privileged implementation.
-- Only the invoker wrapper below is exposed; every branch checks the signed-in game profile.
create or replace function meadow_private.play_service(p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 u uuid:=auth.uid(); w public.meadow_market_wallets; rid uuid; receipt public.meadow_market_economy_receipts;
 wk date:=(date_trunc('week',now() at time zone 'UTC'))::date; dy date:=(now() at time zone 'UTC')::date;
 g text; lv int; pts int; completed int; goal int; secs numeric; victory boolean;
 cost int:=0; add_gems int:=0; add_turns int:=0; delivery jsonb:='{}'; ck text; sku text;
 rows_json jsonb; missions jsonb:='[]'; m record; progress int; period_start date; rank_n int; reward_gold int; vip_tier int;
begin
 if u is null or not exists(select 1 from public.meadow_market_profiles where user_id=u) then raise exception 'Connect your Meadow Markets account first'; end if;
 insert into public.meadow_market_wallets(user_id) values(u) on conflict do nothing;
 select * into w from public.meadow_market_wallets where user_id=u for update;
 if p_action='score' then
  rid:=(p_data->>'id')::uuid; g:=p_data->>'game'; lv:=(p_data->>'level')::int; completed:=(p_data->>'completed')::int; goal:=(p_data->>'goal')::int; secs:=(p_data->>'remaining')::numeric; victory:=(p_data->>'won')::boolean;
  if g not in ('eggs','milk','sheep','goat','cow','flowers','memory','sorting','coopmath','differences','market_pack','market_weigh','tractorrepair','colourbynumber','matchpainting') or lv not between 1 and 10000 or goal not between 1 and 120 or completed not between 0 and goal or secs not between 0 and 300 or (victory and completed<>goal) then raise exception 'Invalid game result'; end if;
  pts:=completed*100+case when victory then lv*1000+floor(secs*10)::int else 0 end;
  insert into public.meadow_market_play_runs(id,user_id,game,week,level,points,won) values(rid,u,g,wk,lv,pts,victory) on conflict do nothing;
 return jsonb_build_object('wallet',to_jsonb(w));
 elsif p_action='event' then
  g:=p_data->>'event'; if g not in ('harvest','care','sell','upgrade','place','craft','water','plant') then raise exception 'Unknown mission event'; end if;
  insert into public.meadow_market_mission_events(id,user_id,event,amount) values((p_data->>'id')::uuid,u,g,least(100,greatest(1,coalesce((p_data->>'amount')::int,1)))) on conflict do nothing;
 return jsonb_build_object('wallet',to_jsonb(w));
 elsif p_action='boards' then
  g:=p_data->>'game'; period_start:=case when p_data->>'period'='previous' then wk-7 else wk end;
  with best as (select r.user_id,max(r.points) points,max(r.level) filter(where r.won) level from public.meadow_market_play_runs r where r.week=period_start and r.game=g and (p_data->>'scope'<>'friends' or r.user_id=u or exists(select 1 from public.meadow_market_friendships f where f.status='accepted' and ((f.requester_id=u and f.recipient_id=r.user_id) or (f.recipient_id=u and f.requester_id=r.user_id)))) group by r.user_id),ranked as(select *,dense_rank() over(order by points desc) place from best)
  select coalesce(jsonb_agg(to_jsonb(t) order by t.place,t.name),'[]') into rows_json from (select r.place,r.points,r.level,p.display_name name,r.user_id=u self,case when coalesce(v.vip_xp,0)>=3000 then 5 when v.vip_xp>=1600 then 4 when v.vip_xp>=800 then 3 when v.vip_xp>=300 then 2 when v.vip_xp>=100 then 1 else 0 end vip from ranked r join public.meadow_market_profiles p on p.user_id=r.user_id left join public.meadow_market_wallets v on v.user_id=r.user_id order by r.place,p.display_name limit 100) t;
  return jsonb_build_object('rows',rows_json,'week',period_start,'ends',period_start+7,'test',true);
 elsif p_action in ('purchase','redeem','claim_mission','claim_week','settings','reward_turn','ad_reward','claim_vip') then
  rid:=(p_data->>'id')::uuid;
  select * into receipt from public.meadow_market_economy_receipts where user_id=u and request_id=rid;
  if found then return jsonb_build_object('wallet',to_jsonb(w),'receipt',to_jsonb(receipt),'duplicate',true); end if;
  if p_action='settings' then
   update public.meadow_market_wallets set ads_enabled=coalesce((p_data->>'ads')::boolean,false),updated_at=now() where user_id=u returning * into w;
   return jsonb_build_object('wallet',to_jsonb(w));
  elsif p_action='claim_vip' then
   vip_tier:=case when w.vip_xp>=3000 then 5 when w.vip_xp>=1600 then 4 when w.vip_xp>=800 then 3 when w.vip_xp>=300 then 2 when w.vip_xp>=100 then 1 else 0 end;
   if vip_tier<1 then raise exception 'Reach VIP 1 by getting or spending gems first';end if;
   ck:='vip_daily:'||dy;add_gems:=vip_tier*2;delivery:=jsonb_build_object('gold',vip_tier*50);add_turns:=case when vip_tier>=3 then 1 else 0 end;
  elsif p_action='purchase' then
   if (select count(*) from public.meadow_market_economy_receipts where user_id=u and kind='purchase' and created_at>=dy::timestamptz)>60 then raise exception 'Test purchase limit reached today'; end if;
   sku:=p_data->>'sku';
   case sku
    when 'pocket_gems' then add_gems:=100;
    when 'gem_chest' then add_gems:=550;
    when 'starter_pack' then add_gems:=150;delivery:='{"gold":1000,"items":{"wheat":15,"carrot":15,"milk":5,"egg":5}}';
    when 'builders_pack' then add_gems:=300;delivery:='{"gold":3000}';
    when 'reward_tickets' then add_turns:=5;
    when 'pantry_pack' then delivery:='{"items":{"wheat":20,"milk":10,"egg":10,"apple":10,"flour":10}}';
    when 'premium' then update public.meadow_market_wallets set premium=true where user_id=u;
    else raise exception 'Unknown test pack';
   end case;
  elsif p_action='redeem' then
   sku:=p_data->>'sku';
   if sku='gold' then completed:=coalesce((p_data->>'packs')::int,1);if completed not between 1 and 20 then raise exception 'Choose between one and twenty gold packs';end if;cost:=20*completed;delivery:=jsonb_build_object('gold',500*completed);
   elsif sku='reward_turns' then cost:=10;add_turns:=3;
   elsif sku='item' then
    g:=p_data->>'item'; completed:=(p_data->>'amount')::int;
    if g not in ('carrot','wheat','strawberry','corn','tomato','lavender','pumpkin','apple','mushroom','egg','milk','goatmilk','wool','fleece','nectar','honey','flour','bread','jam','cheese','honeycake','yarn','soap','bouquet','applepreserve','goatcheese','scarf') or completed not between 1 and 100 then raise exception 'Unknown supply'; end if;
    cost:=completed*2; delivery:=jsonb_build_object('items',jsonb_build_object(g,completed));
   elsif sku='supplies' then
    if jsonb_typeof(p_data->'items')<>'object' or (select count(*) from jsonb_object_keys(p_data->'items'))>30 then raise exception 'Invalid supply basket';end if;
    for m in select key,value from jsonb_each_text(p_data->'items') loop
     completed:=m.value::int;g:=m.key;
     if g not in ('carrot','wheat','strawberry','corn','tomato','lavender','pumpkin','apple','mushroom','egg','milk','goatmilk','wool','fleece','nectar','honey','flour','bread','jam','cheese','honeycake','yarn','soap','bouquet','applepreserve','goatcheese','scarf') or completed not between 1 and 100 then raise exception 'Unknown supply';end if;
     cost:=cost+completed*2;
    end loop;
    if cost<1 then raise exception 'Your basket is empty';end if;delivery:=jsonb_build_object('items',p_data->'items');
   elsif sku='speed' then
    g:=p_data->>'target'; completed:=(p_data->>'minutes')::int;
    if length(g)>120 or completed not between 1 and 60 then raise exception 'Invalid speed up'; end if;
    cost:=greatest(1,ceil(completed/5.0)::int);delivery:=jsonb_build_object('speed',jsonb_build_object('target',g,'map',p_data->>'map','minutes',completed));
   else raise exception 'Unknown gem exchange'; end if;
  elsif p_action='reward_turn' then
   if w.reward_turns<1 then raise exception 'Get more reward tickets in the test shop'; end if;
   select game into g from public.meadow_market_play_runs where id=(p_data->>'run')::uuid and user_id=u and won;if not found then raise exception 'Finish and sync a winning game first';end if;
   ck:='turn:'||(p_data->>'run');
   delivery:=jsonb_build_object('gold',25,'items',case g when 'eggs' then '{"egg":3}'::jsonb when 'milk' then '{"milk":3}'::jsonb when 'sheep' then '{"wool":2}'::jsonb when 'goat' then '{"goatmilk":2}'::jsonb when 'cow' then '{"milk":2}'::jsonb when 'flowers' then '{"nectar":3}'::jsonb when 'memory' then '{"apple":3}'::jsonb when 'coopmath' then '{"egg":3}'::jsonb when 'differences' then '{"apple":3}'::jsonb when 'colourbynumber' then '{"nectar":3}'::jsonb when 'matchpainting' then '{"apple":3}'::jsonb when 'tractorrepair' then '{"wheat":5}'::jsonb else '{"carrot":5}'::jsonb end);add_turns:=-1;
  elsif p_action='ad_reward' then
   if (select count(*) from public.meadow_market_economy_receipts where user_id=u and kind='ad_reward' and created_at>=dy::timestamptz)>=3 then raise exception 'Three rewarded ad previews complete today'; end if;
   add_gems:=5;add_turns:=1;
  elsif p_action='claim_mission' then
   sku:=p_data->>'mission';
   for m in select * from (values ('daily_play','day','play',3,10,75),('daily_win','day','win',1,5,50),('daily_harvest','day','harvest',5,5,50),('daily_care','day','care',3,5,50),('weekly_play','week','play',20,40,300),('weekly_win','week','win',10,50,500),('weekly_build','week','place',3,25,200),('weekly_market','week','sell',10,25,200),('weekly_upgrade','week','upgrade',2,25,200)) as t(id,period,event,target,gems,gold) where id=sku loop
    period_start:=case when m.period='day' then dy else wk end;
    if m.event in ('play','win') then select count(*) into progress from public.meadow_market_play_runs where user_id=u and created_at>=period_start::timestamptz and (m.event='play' or won);
    else select coalesce(sum(amount),0) into progress from public.meadow_market_mission_events where user_id=u and event=m.event and created_at>=period_start::timestamptz; end if;
    if progress<m.target then raise exception 'Keep going to finish this mission'; end if;
    ck:='mission:'||sku||':'||period_start;add_gems:=m.gems;delivery:=jsonb_build_object('gold',m.gold);
   end loop;
   if ck is null then raise exception 'Unknown mission'; end if;
  elsif p_action='claim_week' then
   g:=p_data->>'game'; period_start:=(p_data->>'week')::date;
   if period_start>=wk or period_start<>date_trunc('week',period_start)::date then raise exception 'This week has not finished'; end if;
   with best as(select user_id,max(points) points from public.meadow_market_play_runs where week=period_start and game=g group by user_id),ranks as(select user_id,dense_rank() over(order by points desc) place from best)
   select place into rank_n from ranks where user_id=u;
   if rank_n is null or rank_n>10 then raise exception 'Weekly rewards are for the global top ten'; end if;
   add_gems:=case rank_n when 1 then 150 when 2 then 100 when 3 then 50 else 20 end;
   reward_gold:=case rank_n when 1 then 500 when 2 then 300 when 3 then 150 else 75 end;
   ck:='week:'||period_start||':'||g; delivery:=jsonb_build_object('gold',reward_gold);
  end if;
  if ck is not null and exists(select 1 from public.meadow_market_economy_receipts where user_id=u and claim_key=ck) then raise exception 'Reward already collected'; end if;
  if w.gems<cost then raise exception 'Not enough gems. Free test gem packs are in the shop'; end if;
  update public.meadow_market_wallets set gems=gems-cost+add_gems,reward_turns=reward_turns+add_turns,vip_xp=vip_xp+cost+case when p_action='purchase' then add_gems else 0 end,updated_at=now() where user_id=u returning * into w;
  insert into public.meadow_market_economy_receipts(user_id,request_id,kind,claim_key,delivery) values(u,rid,p_action,ck,delivery) returning * into receipt;
  return jsonb_build_object('wallet',to_jsonb(w),'receipt',to_jsonb(receipt));
 elsif p_action<>'status' then raise exception 'Unknown farm service';
 end if;
 for m in select * from (values ('daily_play','day','play',3,10,75),('daily_win','day','win',1,5,50),('daily_harvest','day','harvest',5,5,50),('daily_care','day','care',3,5,50),('weekly_play','week','play',20,40,300),('weekly_win','week','win',10,50,500),('weekly_build','week','place',3,25,200),('weekly_market','week','sell',10,25,200),('weekly_upgrade','week','upgrade',2,25,200)) as t(id,period,event,target,gems,gold) loop
  period_start:=case when m.period='day' then dy else wk end;
  if m.event in ('play','win') then select count(*) into progress from public.meadow_market_play_runs where user_id=u and created_at>=period_start::timestamptz and (m.event='play' or won);
  else select coalesce(sum(amount),0) into progress from public.meadow_market_mission_events where user_id=u and event=m.event and created_at>=period_start::timestamptz; end if;
  missions:=missions||jsonb_build_array(jsonb_build_object('id',m.id,'period',m.period,'event',m.event,'target',m.target,'progress',progress,'gems',m.gems,'gold',m.gold,'claimed',exists(select 1 from public.meadow_market_economy_receipts where user_id=u and claim_key='mission:'||m.id||':'||period_start)));
 end loop;
 return jsonb_build_object('wallet',to_jsonb(w),'missions',missions,'week',wk,'day',dy,'test',true);
end $$;
revoke all on function meadow_private.play_service(text,jsonb) from public,anon;
grant execute on function meadow_private.play_service(text,jsonb) to authenticated;
create or replace function public.meadow_market_play_service(p_action text,p_data jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select meadow_private.play_service(p_action,p_data)$$;
revoke all on function public.meadow_market_play_service(text,jsonb) from public,anon;
grant execute on function public.meadow_market_play_service(text,jsonb) to authenticated;
comment on table public.meadow_market_wallets is 'Meadow Markets test economy only. Premium removes optional interstitial previews. No real payments.';
comment on table public.meadow_market_play_runs is 'Meadow Markets test scores; client-reported results, unsuitable for real-money prizes.';
