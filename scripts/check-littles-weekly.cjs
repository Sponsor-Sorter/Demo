const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../meadow-market-littles');
const run=file=>fs.readFileSync(path.join(root,file),'utf8');
async function main(){
 const data=new Map(),store={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};
 const c={localStorage:store};c.window=c;vm.runInNewContext(run('play-access.js'),c);
 const a=c.meadowLittlesAccess,events=[];let bonus=2;
 a.configure({enabled:true,onBegin:id=>({id}),onComplete:(id,t,used)=>{events.push({id,t,used});if(used)bonus--;},bonusRemaining:()=>bonus});
 for(let i=0;i<5;i++){assert(a.begin('memory'));assert(a.complete('memory'));assert(!a.complete('memory'));}
 assert.equal(a.remaining('memory'),2);assert(a.begin('memory'));assert(a.begin('memory'),'Abandoning a round does not spend its bonus');assert.equal(bonus,2);a.complete('memory');assert.equal(bonus,1);assert.equal(events.length,6);assert.equal(events.at(-1).used,true);
 a.begin('memory');a.complete('memory');assert.equal(a.remaining('memory'),0);assert(!a.begin('memory'));assert.equal(a.remaining('sorting'),5);
 a.configure({plus:true});a.begin('memory');a.complete('memory');assert.equal(events.at(-1).used,false,'Plus does not spend earned bonus tries');a.configure({resetTickets:true});assert(!a.complete('memory'));
 let identity='one',calls=[],seq=0,serverBonus=2,praises=0,serverQuality=63,serverPublic=62;
 const hooks={},week=(()=>{const d=new Date();d.setUTCHours(0,0,0,0);d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return d.toISOString().slice(0,10)})();
 const sandbox={localStorage:store,Promise,Date,document:{querySelector:()=>null},crypto:{randomUUID:()=>String(++seq)},window:{meadowAudio:{play:()=>praises++},meadowLittlesAccess:{configure:x=>Object.assign(hooks,x)},meadowLittlesCloud:{getStatus:()=>({userId:identity}),weekly:async(action,p)=>{calls.push({action,p,user:identity});if(action==='begin')return {user_id:identity,ticket:'ticket'};return {contract:'littles-weekly-v1',public_quality_build:serverPublic,quality_build:serverQuality,enabled:true,user_id:identity,week,rounds:3,bonus_per_game:serverBonus,bonus_spent:{memory:1}};}}}};
 vm.runInNewContext(run('weekly-fair.js'),sandbox);const f=sandbox.window.meadowWeeklyFair;f.accountChanged(identity);await f.refresh();assert.equal(f.remaining('memory'),1);assert.equal(f.remaining('sorting'),2);assert.equal(f.getQualityBuild(),63);assert.equal(store.getItem('meadow-littles-quality-build'),'62','A private mechanics preview is never cached for offline use');
 const old=hooks.onBegin('memory');identity='two';serverQuality=62;f.accountChanged(identity);await hooks.onComplete('memory',old,true);await f.refresh();assert(!calls.some(x=>x.action==='finish'),'An old account ticket cannot complete on the new account');assert.equal(f.getQualityBuild(),62,'Preview mechanics cannot follow another account');
 const t=hooks.onBegin('memory');await t.promise;await hooks.onComplete('memory',t,true);assert.equal(calls.filter(x=>x.action==='finish').length,1);assert.equal(calls.at(-1).p.use_bonus,true);
 const first=hooks.onBegin('sorting'),second=hooks.onBegin('flowers');serverBonus=5;await Promise.all([hooks.onComplete('sorting',first,false),hooks.onComplete('flowers',second,false)]);assert.equal(praises,1,'Delayed completions celebrate a newly earned trophy once');
 serverPublic=63;serverQuality=63;await f.refresh();assert.equal(store.getItem('meadow-littles-quality-build'),'63');identity=null;f.accountChanged(null);assert.equal(f.getQualityBuild(),63,'A published mechanics build remains available offline');assert.equal(f.remaining('sorting'),0,'Signing out clears another account’s bonus');
 assert(run('weekly-fair.css').includes('prefers-reduced-motion'));
 console.log('Littles weekly: bonus spending, failed/duplicate rounds, independent games, Plus, account isolation and signed-out cleanup passed.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
