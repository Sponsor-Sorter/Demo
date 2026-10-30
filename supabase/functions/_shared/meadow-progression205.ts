// Adapt the game's reviewed, pure progression functions to strict commands.
// Rewards, costs, prerequisite checks and clocks come from server-owned rules.
type Data=Record<string,any>;
export function progressionCommand(type:string,target:unknown,d:Data,c:Data):Data|null{
 const {s,W,R,now,map,fields,fail,xp,event}=c, J=W.meadowJourneyCore;
 const id=()=>{if(typeof target!=='string'||!target.length||target.length>160)fail('Choose a current farm goal.');return target;};
 const expected=()=>{fields(d,['expected']);if(!Number.isSafeInteger(d.expected)||d.expected<0||d.expected>1000000000)fail('Reopen the current upgrade.');return d.expected;};
 const success=(r:Data)=>{if(!r?.ok)fail(r?.error||'This goal is not ready yet.');if(r.xp)xp(r.xp);return r;};
 const award=(r:Data)=>{if(!r)fail('This reward is not ready or is already collected.');if(r.gold)s.coins+=r.gold;if(r.reward)s.coins+=r.reward;if(r.xp)xp(r.xp);return r;};
 // A map-qualified command never silently applies its per-farm focus elsewhere.
 const previous=s.active;s.active=map;
 try{switch(type){
  case 'journey.restore':{const r=success(J.restore(s,id(),expected()));event('upgrade');return r;}
  case 'customer.deliver':{fields(d,['serial']);if(!Number.isSafeInteger(d.serial)||d.serial<0)fail('Reopen this customer’s current order.');const r=success(J.deliver(s,id(),d.serial,R.crops,now));event('sell');return r;}
  case 'career.train':return success(J.train(s,id(),expected()));
  case 'focus.choose':fields(d,[]);return success(W.meadowProgress.choose(s,id(),now));
  case 'focus.upgrade':return success(W.meadowProgress.upgrade(s,id(),expected()));
  case 'relationship.claim':fields(d,[]);return success(W.meadowProgress.claim(s,id()));
  case 'story.claim':fields(d,[]);return award(W.meadowStory.claim(s,id()));
  case 'almanac.claim':fields(d,[]);return award(W.meadowAlmanac.claim(s,id()));
  case 'artisan.choose':fields(d,[]);if(!W.meadowArtisan.choose(s,id()))fail('Reach the recipe’s signature requirements first.');return {ok:true};
  case 'artisan.clear':fields(d,[]);if(!W.meadowArtisan.clear(s,id()))fail('Choose a kitchen or workshop signature.');return {ok:true};
  case 'artisan.claim':{const rank=expected();return award(W.meadowArtisan.claim(s,id(),rank));}
  case 'festival.join':fields(d,[]);if(!W.meadowLife.join(s,now))fail('This week’s celebration has already started.');return {ok:true};
  case 'festival.advance':fields(d,[]);return award(W.meadowLife.advance(s,id(),now));
  case 'collection.claim':fields(d,[]);return award(W.meadowLife.claimCollection(s,id()));
  case 'weekly.deliver':{fields(d,[]);const r=award(W.meadowVillageOrders.claim(s,s.farms.willow.inventory,now,id()));event('sell');return r;}
  case 'fair.enter':{
   fields(d,['category','entry']);if(!['crop','craft','animal'].includes(d.category)||typeof d.entry!=='string'||d.entry.length>160)fail('Choose a matching fair entry.');
   // Animal IDs are map-qualified: duplicate legacy IDs cannot select a different farm.
   if(d.category==='animal'&&(!d.entry.startsWith(map+':')||d.entry.split(':').length!==2))fail('Choose an animal on this farm.');
   return success(J.enterFair(s,d.category,d.entry,R.crops,now));}
  case 'fair.claim':fields(d,[]);if(typeof target!=='string'||!['0','1','2'].includes(target))fail('Choose a fair ribbon.');return success(J.claimFair(s,Number(target),now));
  case 'nursery.upgrade':return success(J.nurseryUpgrade(s,expected()));
  case 'nursery.breed':fields(d,['first','second']);if([d.first,d.second].some(k=>typeof k!=='string'||k.length>160||k.split(':').length!==2))fail('Choose two adult animals.');return success(J.breed(s,d.first,d.second,now));
  case 'nursery.care':fields(d,['action']);return success(J.babyCare(s,id(),d.action));
  case 'nursery.settle':fields(d,['home']);if(typeof d.home!=='string')fail('Choose a matching animal home.');return success(J.settleBaby(s,id(),map,d.home,now));
  case 'greenhouse.upgrade':return success(J.greenhouseUpgrade(s,expected()));
  case 'greenhouse.plant':fields(d,['index','crop']);return success(J.greenhousePlant(s,d.index,d.crop,now));
  case 'greenhouse.harvest':fields(d,['index']);return success(J.greenhouseHarvest(s,d.index,now));
  case 'planner.pin':{
   fields(d,['kind','id','map','stage','week','amount']);if(!['recipe','project','festival','weekly','order'].includes(d.kind))fail('Choose a farm project.');
   if(!W.meadowPlanner.pin(s,d))fail('This farm project has changed or is complete.');return {ok:true};}
  case 'planner.clear':fields(d,[]);W.meadowPlanner.clear(s);return {ok:true};
  case 'planner.settings':fields(d,['helpers','keepGold']);if(!s.farmPlan||typeof d.helpers!=='boolean'||typeof d.keepGold!=='boolean')fail('Choose a farm project first.');Object.assign(s.farmPlan,d);return {ok:true};
  case 'journal.claim':case 'journal.bonus':{
   fields(d,['day']);const j=c.journal();if(d.day!==j.day)fail('These are yesterday’s farm jobs. Reopen the journal.');
   if(type==='journal.bonus'){if(j.claimed.length!==3||j.bonus)fail('Finish and collect all three jobs first.');j.bonus=true;return award({gold:100,xp:20});}
   const task=R.journalTasks.find((t:Data)=>t.id===target);if(!task||(j.progress[task.id]||0)<task.goal||j.claimed.includes(task.id))fail('This journal reward is not ready or is already collected.');j.claimed.push(task.id);return award({gold:task.reward,xp:8});}
  default:return null;
 }}finally{s.active=previous;}
}
