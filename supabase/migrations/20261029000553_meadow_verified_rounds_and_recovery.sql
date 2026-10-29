-- Meadow Markets only. Test rewards; no billing or live advertisements.
alter table public.meadow_market_play_runs add column if not exists verified boolean not null default false;
create table meadow_private.reward_rounds (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.meadow_market_profiles(user_id) on delete cascade,
 request_id uuid not null, game text not null check(game in ('eggs','milk','word_search','market_pack','market_weigh','ad')),
 level integer not null, goal integer not null, duration integer not null, map text,
 puzzle jsonb, started_at timestamptz not null default clock_timestamp(), expires_at timestamptz not null,
 closed boolean not null default false, result jsonb, unique(user_id,request_id)
);
create index meadow_round_owner_time on meadow_private.reward_rounds(user_id,started_at desc);
alter table meadow_private.reward_rounds enable row level security;
revoke all on meadow_private.reward_rounds from public,anon,authenticated;

create table meadow_private.round_progress (
 user_id uuid references public.meadow_market_profiles(user_id) on delete cascade,
 game text, legacy_level integer not null, primary key(user_id,game)
);
alter table meadow_private.round_progress enable row level security;
revoke all on meadow_private.round_progress from public,anon,authenticated;
create table meadow_private.word_themes (id text primary key, words jsonb not null);
alter table meadow_private.word_themes enable row level security;
revoke all on meadow_private.word_themes from public,anon,authenticated;
insert into meadow_private.word_themes(id,words) values ('farm-0','["CARROT","POTATO","PUMPKIN","TOMATO","CUCUMBER","BEETROOT","RADISH","TURNIP","PARSNIP","SPINACH","CABBAGE","BROCCOLI","CAULIFLOWER","LETTUCE","CELERY","ONION","GARLIC","PEPPER","ZUCCHINI","AUBERGINE"]'::jsonb),
('farm-1','["APPLE","PEAR","PEACH","PLUM","APRICOT","CHERRY","NECTARINE","ORANGE","LEMON","LIME","MANDARIN","GRAPEFRUIT","FIG","QUINCE","PERSIMMON","MULBERRY","WALNUT","ALMOND","CHESTNUT","HAZELNUT"]'::jsonb),
('farm-2','["STRAWBERRY","RASPBERRY","BLUEBERRY","BLACKBERRY","GOOSEBERRY","CRANBERRY","CURRANT","BRAMBLE","RUNNER","BLOSSOM","POLLINATOR","PICKING","BASKET","JAM","PRESERVE","COMPOTE","CORDIAL","CRUMBLE","TART","SWEETNESS"]'::jsonb),
('farm-3','["WHEAT","BARLEY","OATS","RYE","MAIZE","MILLET","SORGHUM","QUINOA","BUCKWHEAT","SPELT","HARVEST","THRESHING","WINNOWING","COMBINE","GRANARY","CHAFF","HUSK","STRAW","FLOUR","SILO"]'::jsonb),
('farm-4','["CHICKEN","ROOSTER","PULLET","HEN","CHICK","COW","BULL","CALF","HEIFER","SHEEP","LAMB","RAM","EWE","GOAT","KID","BILLY","NANNY","ALPACA","PONY","DONKEY"]'::jsonb),
('farm-5','["FEEDING","WATERING","GROOMING","BRUSHING","SHEARING","HOOF","PASTURE","BEDDING","SHELTER","TROUGH","MANGER","HALTER","HARNESS","LEADROPE","VETERINARY","VACCINE","HEALTH","COMFORT","FRIENDSHIP","ENRICHMENT"]'::jsonb),
('farm-6','["MILKING","BUCKET","CREAM","BUTTER","CHEESE","YOGHURT","CURDS","WHEY","CHURN","UDDER","PAIL","DAIRY","RENNET","STARTER","CULTURE","STRAINER","COOLING","SEPARATOR","PASTURE","BOTTLE"]'::jsonb),
('farm-7','["HIVE","APIARY","HONEY","NECTAR","POLLEN","QUEEN","WORKER","DRONE","SWARM","COMB","WAX","PROPOLIS","SMOKER","VEIL","FRAME","EXTRACTOR","BLOSSOM","POLLINATION","FORAGE","LAVENDER"]'::jsonb),
('farm-8','["SUNFLOWER","LAVENDER","DAISY","TULIP","ROSE","MARIGOLD","POPPY","DAHLIA","ZINNIA","COSMOS","PEONY","IRIS","PANSY","VIOLET","PRIMROSE","FOXGLOVE","HOLLYHOCK","LUPIN","ASTER","PETUNIA"]'::jsonb),
('farm-9','["BASIL","THYME","ROSEMARY","SAGE","MINT","PARSLEY","CORIANDER","DILL","CHIVES","OREGANO","TARRAGON","FENNEL","SORREL","MARJORAM","LOVAGE","CHERVIL","SAVORY","CHAMOMILE","LEMONBALM","BORAGE"]'::jsonb),
('farm-10','["COMPOST","HUMUS","MULCH","LOAM","CLAY","SAND","SILT","MINERAL","NITROGEN","PHOSPHATE","POTASSIUM","FERTILITY","DRAINAGE","MOISTURE","AERATION","EARTHWORM","MICROBE","ACIDITY","ROTATION","FALLOW"]'::jsonb),
('farm-11','["SPADE","SHOVEL","RAKE","HOE","FORK","TROWEL","SECATEURS","SHEARS","DIBBER","WHEELBARROW","WATERINGCAN","HOSE","SPRINKLER","MATTOCK","SCYTHE","SICKLE","PITCHFORK","MALLET","HAMMER","WRENCH"]'::jsonb),
('farm-12','["TRACTOR","ENGINE","PISTON","GEARBOX","CLUTCH","THROTTLE","STEERING","AXLE","WHEEL","TYRE","TREAD","BONNET","RADIATOR","DIESEL","FILTER","EXHAUST","PLOUGH","CULTIVATOR","HARROW","TRAILER"]'::jsonb),
('farm-13','["TIMBER","LUMBER","PLANK","JOIST","RAFTER","BEAM","BRACE","NAIL","SCREW","BOLT","WASHER","HINGE","LATCH","GATE","FENCE","POST","RAIL","ROOF","SHINGLE","FOUNDATION"]'::jsonb),
('farm-14','["BREAD","FLOUR","DOUGH","YEAST","KNEADING","PROVING","BAKING","CRUST","CRUMB","LOAF","SOURDOUGH","PASTRY","PIE","TART","BISCUIT","CAKE","SCONE","MUFFIN","BUTTER","OVEN"]'::jsonb),
('farm-15','["PRESERVE","JAM","JELLY","MARMALADE","CHUTNEY","RELISH","PICKLE","VINEGAR","BRINE","SUGAR","SIMMER","STERILISE","JAR","LID","SEAL","FUNNEL","LADLE","FRUIT","PECTIN","SYRUP"]'::jsonb),
('farm-16','["VENDOR","CUSTOMER","STALL","BASKET","CRATE","DISPLAY","PRICE","BARGAIN","RECEIPT","ORDER","DELIVERY","HARVEST","PRODUCE","WEIGHING","SCALES","STOCK","SHELF","CHECKOUT","COIN","PROFIT"]'::jsonb),
('farm-17','["WOOL","FLEECE","YARN","SPINNING","SPINDLE","LOOM","WEAVING","KNITTING","CROCHET","NEEDLE","BOBBIN","THREAD","FABRIC","BLANKET","SCARF","MITTENS","DYE","PATTERN","STITCH","FELT"]'::jsonb),
('farm-18','["RIVER","STREAM","CREEK","BROOK","BANK","BRIDGE","FORD","CURRENT","RIPPLE","PEBBLE","REED","RUSH","WILLOW","ALDER","OTTER","HERON","KINGFISHER","DRAGONFLY","WATERLILY","WETLAND"]'::jsonb),
('farm-19','["OAK","PINE","BIRCH","BEECH","ASH","ELM","MAPLE","CEDAR","HAZEL","HOLLY","MOSS","FERN","LICHEN","MUSHROOM","ACORN","CONE","BARK","CANOPY","CLEARING","WOODLAND"]'::jsonb),
('farm-20','["BADGER","FOX","HEDGEHOG","RABBIT","HARE","SQUIRREL","VOLE","MOUSE","SHREW","DEER","OWL","ROBIN","SPARROW","SWALLOW","FINCH","BUTTERFLY","MOTH","BEETLE","CRICKET","LADYBIRD"]'::jsonb),
('farm-21','["SPRING","SUMMER","AUTUMN","WINTER","SUNSHINE","RAINFALL","DRIZZLE","THUNDER","LIGHTNING","RAINBOW","FROST","SNOW","HAIL","BREEZE","GALE","DROUGHT","THAW","SOLSTICE","EQUINOX","HARVEST"]'::jsonb),
('farm-22','["HOMESTEAD","FARMHOUSE","COURTYARD","PORCH","PANTRY","CELLAR","ATTIC","CHIMNEY","HEARTH","FIREWOOD","LAUNDRY","CLOTHESLINE","LANTERN","KETTLE","TEAPOT","BREAKFAST","SUPPER","PICNIC","FAMILY","NEIGHBOUR"]'::jsonb),
('farm-23','["RENEWABLE","SOLAR","WINDMILL","TURBINE","RAINWATER","COMPOST","RECYCLING","HABITAT","HEDGEROW","BIODIVERSITY","CONSERVATION","STEWARDSHIP","ECOSYSTEM","ORGANIC","PERMACULTURE","COVERCROP","INTERCROPPING","WATERSHED","CARBON","RESILIENCE"]'::jsonb),
('farm-24','["JADE","RHYS","JAY","WILLOWBROOK","SUNPETAL","PINECONE","GOLDENRIDGE","EASTBANK","MEADOW","ORCHARD","PASTURE","COAST","VILLAGE","BAKERY","WHARF","EMPORIUM","FRIENDSHIP","JOURNEY","DISCOVERY","COMMUNITY"]'::jsonb);
create or replace function meadow_private.reward_round(p_action text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 u uuid:=auth.uid(); r meadow_private.reward_rounds; w public.meadow_market_wallets;
 receipt public.meadow_market_economy_receipts; g text; lv int; d int; target int; duration int;
 elapsed numeric; active numeric; completed int; won boolean; points int; paid int; baselevel int;
 delivery jsonb:='{}'; output jsonb; ev jsonb; previous numeric:=-1; t numeric; hits int:=0; seen text[]:='{}'; words jsonb; answer text; indices jsonb; i int; cell int; lastcell int; dx int; dy int; step_x int; step_y int; letters text;
begin
 if u is null or not exists(select 1 from public.meadow_market_profiles where user_id=u) then raise exception 'Connect your Meadow Markets farm first'; end if;
 insert into public.meadow_market_wallets(user_id) values(u) on conflict do nothing;
 -- All round/reward/ticket writes take the same owner wallet lock as the shop.
 select * into w from public.meadow_market_wallets where user_id=u for update;
 if p_action='start' then
  select * into r from meadow_private.reward_rounds where user_id=u and request_id=(p_data->>'id')::uuid;
  if found then
   if r.closed or r.expires_at<clock_timestamp() then raise exception 'This round has ended. Start a new game'; end if;
   return jsonb_build_object('round',to_jsonb(r)-'user_id'-'request_id'-'result');
  end if;
  g:=p_data->>'game';
  if g is null or g not in ('eggs','milk','word_search','market_pack','market_weigh','ad') then raise exception 'Unknown rewarded game'; end if;
  if (select count(*) from meadow_private.reward_rounds where user_id=u and started_at>clock_timestamp()-interval '1 minute')>=15 then raise exception 'Please wait a moment before starting another round'; end if;
  -- Preserve existing game levels once as a migration ceiling; subsequent progression requires verified wins.
  select greatest(1,least(1000,coalesce((save_data->'minigames'->'records'->g->>'level')::int,1))) into baselevel from public.meadow_market_saves where user_id=u;
  insert into meadow_private.round_progress(user_id,game,legacy_level) values(u,g,coalesce(baselevel,1)) on conflict do nothing;
  select legacy_level into baselevel from meadow_private.round_progress where user_id=u and game=g;
  select greatest(coalesce(baselevel,1),coalesce(max(level) filter(where won and verified),0)+1) into baselevel from public.meadow_market_play_runs where user_id=u and game=g;
  lv:=case when g in ('eggs','milk') then least(greatest(coalesce((p_data->>'level')::int,1),1),baselevel,1000) else 1 end;
  d:=least(30,lv-1);
  if g='eggs' then target:=12+least(30,d*2);duration:=ceil(greatest(28,45-d*.5));
  elsif g='milk' then target:=8+least(10,d/2);duration:=ceil(greatest(24,40-d*.6));
  elsif g='word_search' then target:=20;duration:=300;
  elsif g='ad' then
   if (select count(*) from public.meadow_market_economy_receipts where user_id=u and kind='ad_reward' and created_at>=(date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'))>=3 then raise exception 'Three rewarded previews complete today'; end if;
   target:=1;duration:=5;
  else target:=coalesce((p_data->>'amount')::int,0);if target not between 1 and 6 then raise exception 'Choose one to six goods'; end if;duration:=45;
  end if;
  if g='word_search' then
   select t.words into words from meadow_private.word_themes t where id=p_data->>'theme';
   if words is null or coalesce(p_data->>'board','')!~'^[A-Z]{256}$' then raise exception 'Invalid word-search puzzle'; end if;
  end if;
  update meadow_private.reward_rounds set closed=true where user_id=u and not closed and (game='ad')=(g='ad');
  insert into meadow_private.reward_rounds(user_id,request_id,game,level,goal,duration,map,puzzle,expires_at)
  values(u,(p_data->>'id')::uuid,g,lv,target,duration,p_data->>'map',case when g='word_search' then jsonb_build_object('board',p_data->>'board','words',words) else null end,clock_timestamp()+case when g='word_search' then interval '24 hours' else interval '2 hours' end) returning * into r;
  return jsonb_build_object('round',to_jsonb(r)-'user_id'-'request_id'-'result');
 elsif p_action<>'finish' then raise exception 'Unknown round action'; end if;
 select * into r from meadow_private.reward_rounds where id=(p_data->>'id')::uuid and user_id=u for update;
 if not found then raise exception 'Round not found on this account'; end if;
 if r.result is not null then return r.result||jsonb_build_object('duplicate',true,'wallet',to_jsonb(w)); end if;
 if r.closed or r.expires_at<clock_timestamp() then raise exception 'Round expired or replaced. Play a new round'; end if;
 elapsed:=extract(epoch from clock_timestamp()-r.started_at);
 completed:=(p_data->>'completed')::int; active:=(p_data->>'elapsed')::numeric; won:=(p_data->>'won')::boolean;
 if completed is null or active is null or won is null or active<0 or active>86400 or active>elapsed+1+(case when r.game='market_weigh' then least(45,greatest(0,coalesce((p_data->>'misses')::int,0)))*3 else 0 end) or completed<0 or completed>r.goal or (won and completed<>r.goal) then raise exception 'Invalid round result'; end if;
 if won and elapsed<(case r.game when 'ad' then 5 when 'eggs' then ceil(r.goal/(case when r.level>=5 then 2.0 else 1.0 end))*greatest(.32,1.25/(1+least(30,r.level-1)*.12))-.15 when 'milk' then (r.goal-1)*.45 when 'word_search' then 5 when 'market_weigh' then (r.goal-1)*.5 else (r.goal-1)*.25 end) then raise exception 'Round finished too quickly'; end if;
 if r.game in ('eggs','milk','market_pack','market_weigh') then
  if jsonb_typeof(p_data->'events') is distinct from 'array' or jsonb_array_length(p_data->'events')>500 then raise exception 'Missing game actions'; end if;
  for ev in select value from jsonb_array_elements(p_data->'events') loop
   t:=(ev->>'t')::numeric;
   if t is null or t<0 or t>active+.1 or t<previous then raise exception 'Invalid action timing'; end if;
   if r.game in ('milk','market_pack','market_weigh') then
    if previous>=0 and t-previous<(case r.game when 'milk' then .44 when 'market_pack' then .24 else .49 end) then raise exception 'Actions are too close'; end if;
    if coalesce((ev->>'hit')::boolean,false) then
     if r.game<>'market_pack' and abs(sin(t*(2.6+least(30,r.level-1)*.18)))>(case when r.game='market_weigh' then .36 else greatest(.10,.36/(1+least(30,r.level-1)*.15)) end)+.015 then raise exception 'Action missed the golden zone'; end if;
     hits:=hits+1;
    end if;
   else
    if coalesce(ev->>'egg','')='' or (ev->>'egg')=any(seen) then raise exception 'Egg already collected'; end if;
    seen:=array_append(seen,ev->>'egg');hits:=hits+1;
    if t<ceil(hits/(case when r.level>=5 then 2.0 else 1.0 end))*greatest(.32,1.25/(1+least(30,r.level-1)*.12))-.15 then raise exception 'Egg was not available yet'; end if;
   end if;
   previous:=t;
  end loop;
  if hits<>completed or (won and active>r.duration+.1) then raise exception 'Actions do not match the result'; end if;
 end if;
 if r.game='word_search' then
  if jsonb_typeof(p_data->'paths') is distinct from 'array' or jsonb_array_length(p_data->'paths')<>completed then raise exception 'Missing selected words'; end if;
  seen:='{}';
  for ev in select value from jsonb_array_elements(p_data->'paths') loop
   answer:=ev->>'word';indices:=ev->'indices';
   if answer is null or not (r.puzzle->'words' ? answer) or answer=any(seen) or jsonb_typeof(indices) is distinct from 'array' or jsonb_array_length(indices)<>length(answer) then raise exception 'Invalid selected word'; end if;
   letters:='';lastcell:=null;step_x:=null;step_y:=null;
   for i in 0..jsonb_array_length(indices)-1 loop
    cell:=(indices->>i)::int;
    if cell is null or cell<0 or cell>=256 then raise exception 'Word outside puzzle'; end if;
    if lastcell is not null then
     dx:=cell%16-lastcell%16;dy:=cell/16-lastcell/16;
     if abs(dx)>1 or abs(dy)>1 or (dx=0 and dy=0) or (step_x is not null and (dx<>step_x or dy<>step_y)) then raise exception 'Words must follow a straight line'; end if;
     step_x:=dx;step_y:=dy;
    end if;
    letters:=letters||substr(r.puzzle->>'board',cell+1,1);lastcell:=cell;
   end loop;
   if letters<>answer and reverse(letters)<>answer then raise exception 'Word does not match this puzzle'; end if;
   seen:=array_append(seen,answer);
  end loop;
 end if;
 points:=completed*100+case when won then r.level*1000+floor(greatest(0,r.duration-elapsed)*10)::int else 0 end;
 if r.game='ad' then
  if not won then raise exception 'Finish the preview first'; end if;
  if (select count(*) from public.meadow_market_economy_receipts where user_id=u and kind='ad_reward' and created_at>=(date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'))>=3 then raise exception 'Three rewarded previews complete today'; end if;
  update public.meadow_market_wallets set gems=gems+5,reward_turns=reward_turns+1,updated_at=now() where user_id=u returning * into w;
  insert into public.meadow_market_economy_receipts(user_id,request_id,kind,claim_key,delivery) values(u,r.id,'ad_reward','round:'||r.id,'{}') returning * into receipt;
 else
  insert into public.meadow_market_play_runs(id,user_id,game,week,level,points,won,verified) values(r.id,u,r.game,date_trunc('week',now() at time zone 'UTC')::date,r.level,points,won,true);
  if won and r.game in ('eggs','milk','word_search') then
   select count(*) into paid from public.meadow_market_economy_receipts where user_id=u and kind='game_reward' and delivery->>'game'=r.game and created_at>=(date_trunc('day',now() at time zone 'UTC') at time zone 'UTC');
   if paid<3 then
    delivery:=jsonb_build_object('gold',case when r.game='word_search' then 20 else 25 end,'xp',case when r.game='word_search' then 3 else 8 end,'items',case r.game when 'eggs' then '{"egg":3}'::jsonb when 'milk' then '{"milk":3}'::jsonb else '{"apple":1}'::jsonb end,'game',r.game,'map',r.map);
    insert into public.meadow_market_economy_receipts(user_id,request_id,kind,claim_key,delivery) values(u,r.id,'game_reward','round:'||r.id,delivery) returning * into receipt;
   end if;
  end if;
 end if;
 output:=jsonb_build_object('wallet',to_jsonb(w),'points',points,'verified',true,'rewarded',receipt.id is not null,'receipt',case when receipt.id is not null then to_jsonb(receipt) else null end);
 update meadow_private.reward_rounds set closed=true,result=output where id=r.id;
 return output;
end;
$$;
revoke all on function meadow_private.reward_round(text,jsonb) from public,anon;
grant execute on function meadow_private.reward_round(text,jsonb) to authenticated;
create or replace function public.meadow_market_reward_round(p_action text,p_data jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$ select meadow_private.reward_round(p_action,p_data); $$;
revoke all on function public.meadow_market_reward_round(text,jsonb) from public,anon;
grant execute on function public.meadow_market_reward_round(text,jsonb) to authenticated;

-- Keep old cached clients syncing farm events, but their unissued scores earn no ranked prizes.
do $patch$
declare f text; before text;
begin
 select pg_get_functiondef('meadow_private.play_service(text,jsonb)'::regprocedure) into f;
 before:=f;
 f:=replace(f,'if p_action=''score'' then','if p_action=''score'' then return jsonb_build_object(''wallet'',to_jsonb(w),''legacy'',true);');
 f:=replace(f,'where r.week=period_start and r.game=g','where r.verified and r.week=period_start and r.game=g');
 f:=replace(f,'where week=period_start and game=g group by','where verified and week=period_start and game=g group by');
 f:=replace(f,'where user_id=u and created_at>=period_start::timestamptz and (m.event=''play'' or won)','where verified and user_id=u and created_at>=period_start::timestamptz and (m.event=''play'' or won)');
 f:=replace(f,'and user_id=u and won;if not found','and user_id=u and won and verified and not exists(select 1 from public.meadow_market_economy_receipts e where e.user_id=u and e.claim_key=''round:''||(p_data->>''run''));if not found');
 f:=replace(f,'when ''tractorrepair'' then ''{"wheat":5}''::jsonb else','when ''tractorrepair'' then ''{"wheat":5}''::jsonb when ''word_search'' then ''{"apple":1}''::jsonb else');
 f:=replace(f,'elsif p_action=''ad_reward'' then','elsif p_action=''ad_reward'' then raise exception ''Start a rewarded preview in the updated game first'';');
 if f=before or position('where r.verified' in f)=0 or position('where verified and week=' in f)=0 or position('and won and verified' in f)=0 then raise exception 'Play service changed; review migration'; end if;
 execute f;
end $patch$;

-- Recovery keys stay hashed. Reserve before Auth writes; consume only after it succeeds.
alter table public.meadow_market_accounts add column if not exists recovery_lease uuid;
alter table public.meadow_market_accounts add column if not exists recovery_lease_until timestamptz;
create or replace function public.meadow_market_reserve_recovery(p_username text,p_hash text,p_token uuid)
returns uuid language sql security invoker set search_path='' as $$
 update public.meadow_market_accounts set recovery_lease=p_token,recovery_lease_until=clock_timestamp()+interval '2 minutes'
 where username=p_username and ready and recovery_hash=p_hash
 and (recovery_lease is null or recovery_lease_until<clock_timestamp()) returning user_id;
$$;
create or replace function public.meadow_market_finish_recovery(p_user uuid,p_token uuid,p_success boolean)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
 update public.meadow_market_accounts set
 recovery_hash=case when p_success then null else recovery_hash end,
 recovery_set_at=case when p_success then null else recovery_set_at end,
 recovery_lease=null,recovery_lease_until=null
 where user_id=p_user and recovery_lease=p_token;
 return found;
end;
$$;
create or replace function public.meadow_market_set_recovery(p_user uuid,p_hash text)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
 if p_hash is null or p_hash!~'^[a-f0-9]{64}$' then return false; end if;
 update public.meadow_market_accounts set recovery_hash=p_hash,recovery_set_at=clock_timestamp(),recovery_lease=null,recovery_lease_until=null
 where user_id=p_user and ready and (recovery_lease is null or recovery_lease_until<clock_timestamp());
 return found;
end;
$$;
revoke all on function public.meadow_market_claim_recovery(text,text) from public,anon,authenticated,service_role;
revoke all on function public.meadow_market_reserve_recovery(text,text,uuid),public.meadow_market_finish_recovery(uuid,uuid,boolean),public.meadow_market_set_recovery(uuid,text) from public,anon,authenticated;
grant execute on function public.meadow_market_reserve_recovery(text,text,uuid),public.meadow_market_finish_recovery(uuid,uuid,boolean),public.meadow_market_set_recovery(uuid,text) to service_role;
