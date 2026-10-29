const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
module.exports=(async()=>{
 const window={},scope={window,AbortController,crypto:require('node:crypto').webcrypto};
 for(const f of ['farm-economy.js','cloud-sync.js','farm-backups.js'])vm.runInNewContext(fs.readFileSync('meadow-and-market/'+f,'utf8'),scope);
 const economy=window.meadowEconomy,clone=v=>JSON.parse(JSON.stringify(v));
 const initial=()=>({version:1,coins:100,xp:85,level:1,active:'east',sharedPantryVersion:1,club:{applied:[]},farms:{willow:{inventory:{egg:1},objects:[{id:'same',type:'well',wellGemTier:0}]},east:{inventory:{egg:1},objects:[{id:'same',type:'well'},{id:'oven',type:'kitchen',jobs:[{startAt:100000,finishAt:200000}]},{id:'plot',type:'plot',plantedAt:100000}]}}});
 const receipt={id:'reward1',kind:'game_reward',created_at:'2026-10-29T00:00:00Z',delivery:{gold:25,xp:8,game:'eggs',map:'east',items:{egg:3}}};
 const patch={version:1,from:0,to:1,receipts:[receipt]};
 const s=initial();assert(economy.apply(s,patch));assert.equal(s.coins,160);assert.equal(s.level,2);assert.equal(s.xp,3);assert.equal(s.inventory.egg,4);assert.equal(s.farms.willow.inventory,s.farms.east.inventory);assert(!economy.apply(s,patch));assert.equal(s.coins,160);
 const permanent={version:1,from:1,to:2,receipts:[{id:'upgrade',kind:'redeem',delivery:{well_watering:{map:'east',target:'same'},well_upgrade:{map:'east',target:'same',level:3},queue_slot:{map:'east',target:'oven',level:4},speed:{map:'east',target:'oven',minutes:1}}}]};
 economy.apply(s,permanent);assert(s.farms.east.objects[0].autoWater);assert(!s.farms.willow.objects[0].autoWater);assert.equal(s.farms.east.objects[0].wellGemTier,3);assert.equal(s.farms.east.objects[1].jobs[0].finishAt,140000);assert.equal(s.farms.east.objects[1].queueSlots,4);
 assert.throws(()=>economy.apply(initial(),permanent),/changed/);
 const work=initial();work.farms.east.objects[1].jobs.push({id:'new',startAt:200000,finishAt:300000});
 const bound={version:1,from:0,to:1,receipts:[{id:'bound-speed',delivery:{speed:{map:'east',target:'oven',minutes:1,basis:{east:{jobs:[{startAt:100000,finishAt:200000}]}}}}}]};
 economy.apply(work,bound);assert.equal(work.farms.east.objects[1].jobs[0].finishAt,140000);assert.equal(work.farms.east.objects[1].jobs[1].finishAt,300000,'New work cannot inherit a previously committed speed reward');
 const restored=window.meadowBackups.prepare(initial(),s);assert.equal(restored._farmEconomy.cursor,2);assert.equal(restored.farms.east.objects[0].wellGemTier,3);assert(restored.club.applied.includes('reward1'));
 // An unknown-outcome commit is retried immutably. Its acknowledged effects
 // must also rebase the newer snapshot captured while that reply was missing.
 let revision=0,stored=initial(),lost=true,last=null;const calls=[];
 const client={rpc:async(name,p)=>{
  assert.equal(name,'meadow_market_commit_economy_save');calls.push(clone(p));
  if(last?.id===p.p_write_id){assert.equal(last.body,JSON.stringify(p.p_save_data));return{data:clone(last.reply)}}
  if(p.p_expected_revision!==revision)return{data:{ok:false,conflict:true,revision,save_data:stored}};
  stored=clone(p.p_save_data);const delivery=revision===0?patch:{version:1,from:1,to:1,receipts:[]};economy.apply(stored,delivery);
  const reply={ok:true,revision:++revision,write_id:p.p_write_id,economy:delivery};last={id:p.p_write_id,body:JSON.stringify(p.p_save_data),reply};
  if(lost){lost=false;return{error:Error('reply lost')}}return{data:reply};
 }};
 const live=initial(),committer=window.meadowCloud.committer(0,()=>{},(rev,p)=>economy.apply(live,p));
 assert((await committer.commit(client,live)).error);assert.equal(live.coins,100,'No local reward before acknowledgement');
 live.coins-=3;const queued=clone(live);assert(!(await committer.commit(client,queued)).error);assert.equal(stored.coins,157);assert.equal(stored.farms.willow.inventory.egg,4);assert.equal(live.coins,157);assert.equal(calls[0].p_write_id,calls[1].p_write_id);assert.equal(calls[2].p_save_data._farmEconomy.cursor,1);
 const again=clone(live);assert(!(await committer.commit(client,again)).error);assert.equal(stored.coins,157);
 const offline=initial();offline.coins-=3;let owner='one',reply={revision:9,cursor:1,patches:[patch]};
 economy.attach({state:()=>offline,user:()=>({id:owner}),canReconcile:()=>true,client:()=>({rpc:async(name,p)=>{assert.equal(name,'meadow_market_rebase_farm_rewards');assert.equal(p.p_from_cursor,economy.cursor(offline));return{data:reply}}})});
 assert.equal(await economy.reconcile(),9);assert.equal(offline.coins,157,'Keep-local review preserves a local seed purchase and includes the other device reward');assert.equal(economy.cursor(offline),1);
 await economy.reconcile();assert.equal(offline.coins,157,'Repeated review cannot duplicate the other device reward');
 reply={revision:10,cursor:3,patches:[]};const intact=JSON.stringify(offline);await assert.rejects(economy.reconcile(),/Load the online/);assert.equal(JSON.stringify(offline),intact);
 const source=fs.readFileSync('meadow-and-market/game.js','utf8'),levels=[],notices=[];
 const levelContext={window:{meadowGuides:{unlocks:(n,what)=>levels.push({n,what})},meadowAudio:{play(){}}},maps:[{name:'Coast',unlock:3}],catalog:[{id:'kitchen',name:'Kitchen',unlock:2}],notify:n=>notices.push(n),state:{xp:85,level:1,coins:0}};
 for(const name of ['announceLevel','xp'])vm.runInNewContext(source.match(new RegExp('  function '+name+'\\([^\\n]+'))[0],levelContext);
 levelContext.xp(8);assert.equal(levelContext.state.level,2);assert.equal(levels[0].what.items[0].id,'kitchen');assert.equal(levelContext.state.coins,35);
 levelContext.announceLevel(3);assert.equal(levels[1].what.areas[0],'Coast');assert.equal(notices.length,2);
 assert(source.includes('for(let level=levelBefore+1;level<=state.level;level++)announceLevel(level)'),'Server deliveries preserve every intermediate unlock guide');
 const sql=fs.readFileSync('supabase/migrations/20261029022000_meadow_farm_economy_journal.sql','utf8');
 assert(sql.includes('saved.save_data->\'club\'->\'applied\''));assert(!sql.includes("p_save_data->'club'->'applied'"));
 for(const t of ['farm_economy_journal','farm_reward_deliveries','farm_save_receipts'])assert(sql.includes('alter table meadow_private.'+t+' enable row level security'));
 console.log('Farm economy: server-only receipt staging, shared baskets, level rewards, map-specific upgrades, immutable retry, queued snapshot rebasing, cursor conflicts and backup entitlements passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
