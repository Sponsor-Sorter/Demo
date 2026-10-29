const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync('meadow-and-market/farm-club.js','utf8');
let owner='one',online=true,failing=false,flushFails=false,calls=0,xp=0;const state={coins:0,active:'willow',farms:{willow:{inventory:{}},east:{inventory:{}}}},receipts=new Map();
const scope={window:{},console,crypto:require('crypto').webcrypto,setTimeout(){},clearTimeout(){},setInterval(){},clearInterval(){},document:{getElementById:()=>null}};
vm.runInNewContext(source.replace('window.meadowClub={','window.roundTest={setApi:a=>api=a,applyReceipt,local};window.meadowClub={'),scope);
const club=scope.window.meadowClub;
scope.window.roundTest.setApi({state:()=>state,current:()=>state.farms[state.active],ready:()=>online,user:()=>({id:owner}),xp:n=>xp+=n,save(){},render(){},notify(){},flush:async()=>{if(flushFails)throw Error('save offline')},client:()=>({rpc:async(name,body)=>{calls++;if(failing)return {error:{message:'offline',code:'network'}};assert.equal(name,'meadow_market_reward_round');if(body.p_action==='start')return {data:{round:{id:'issued',game:body.p_data.game,level:1,goal:12,duration:45}}};const id=body.p_data.id;if(!receipts.has(id))receipts.set(id,{wallet:{gems:5,reward_turns:1},verified:true,rewarded:true,points:2500,receipt:{id,kind:'game_reward',created_at:'2026-10-29T00:00:00Z',delivery:{gold:25,xp:8,game:'eggs',map:'east',items:{egg:3}}}});return {data:receipts.get(id)}}})});
(async()=>{
 online=false;assert.equal(await club.beginRound({id:'eggs'}),null);assert.equal((await club.finishRound(null,{})).practice,true);assert.equal(calls,0);
 online=true;const ticket=await club.beginRound({id:'eggs'});assert.equal(ticket.owner,'one');
 failing=true;const events=[{egg:1,t:2}];const pending=await club.finishRound(ticket,{completed:1,elapsed:2,won:false,events});assert(pending.pending);events[0].egg=9;assert.equal(state.club.rounds[0].body.events[0].egg,1,'Retry payload is immutable');
 failing=false;flushFails=true;await club.flushRounds();assert.equal(state.coins,25);assert.equal(xp,8);assert.equal(state.farms.east.inventory.egg,3,'Receipt follows its originating farm');assert.equal(state.farms.willow.inventory.egg,undefined);assert.equal(state.club.rounds.length,1,'Cloud-save failure keeps the exact request for retry');
 flushFails=false;await club.flushRounds();assert.equal(state.coins,25);assert.equal(xp,8);assert.equal(state.club.rounds.length,0);assert.equal(state.minigames.rewards['2026-10-29:eggs'],1);
 await club.finishRound(ticket,{completed:12,elapsed:30,won:true,events:[]});assert.equal(state.coins,25,'Repeated result does not repeat the payout');
 owner='two';assert((await club.finishRound(ticket,{})).practice);assert.equal(state.coins,25,'Another owner cannot settle the old farm’s round');
 const recovery=fs.readFileSync('supabase/functions/meadow-market-accounts/index.ts','utf8');assert(recovery.includes('meadow_market_reserve_recovery'));assert(recovery.indexOf('const consumed=')>recovery.indexOf("if(!updated.ok)"));assert(!recovery.includes('recovery_hash=is.null'));assert(recovery.includes('sessions_revoked:sessionsRevoked'));
 console.log('Issued rounds: offline practice, immutable outbox, interrupted save, exact-once XP/goods/gold, originating map, account guard and recovery lease wiring passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
