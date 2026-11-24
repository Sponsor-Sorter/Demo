'use strict';
const assert=require('node:assert/strict'),{Game,settings,segmentCircle}=require('../meadow-market-littles/bug-smash-core.js');
const random=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
assert.equal(settings(NaN).level,1);assert.equal(settings(-5).level,1);assert.equal(settings(Infinity).level,12);
assert(settings(12).goal>settings(1).goal);assert(settings(12).armourHp>settings(1).armourHp);assert(settings(12).speed>settings(1).speed);
assert.equal(segmentCircle({x:0,y:0},{x:0,y:0},{x:0,y:0},50),0,'Holding still is not rubbing');
assert.equal(segmentCircle({x:-100,y:0},{x:100,y:0},{x:0,y:0},50),100,'A fast swipe counts only its actual path through the tummy');
assert.equal(segmentCircle({x:-100,y:100},{x:100,y:100},{x:0,y:0},50),0);
assert.equal(segmentCircle({x:NaN,y:0},{x:100,y:0},{x:0,y:0},50),0);
let rounds=0,armourHits=0,claspHits=0,bubbles=0,rubs=0;
for(const [width,height]of [[320,280],[390,620],[742,220],[1024,650]])for(let level=1;level<=12;level++)for(let seed=1;seed<=3;seed++){
  const g=new Game(width,height,{level,random:random(seed)});let wins=0,resized=false;
  for(let frame=0;frame<50000&&!g.done;frame++){
    g.step(1/60);
    for(const a of g.ants)assert([a.x,a.y,a.r,a.hp,a.walk].every(Number.isFinite));
    assert(g.ants.length<=g.capacity);assert(g.particles.length<=240);assert(g.splats.length<=22);
    if(frame%7===0){
      if(g.phase==='ants'){
        const a=g.ants.find(a=>a.x>a.r*1.8&&a.x<g.width-a.r*1.8);if(a){const before=a.hp,hits=g.hits;g.tap(a);if(before>1){assert.equal(a.hp,before-1);assert.equal(g.hits,hits,'Armour damage is not a squashed ant');armourHits++;}}
      }else if(g.phase==='boss'){
        const b=g.boss;
        if(!resized&&level%3===0&&b.stage==='shield'){
          const oldHp=b.hp,progress=b.tickle/b.tickleGoal;g.resize(width===320?680:320,height===220?420:280);assert.equal(b.hp,oldHp);assert(Math.abs(b.tickle/b.tickleGoal-progress)<1e-8);resized=true;
        }
        if(b.stage==='body')g.tap({x:b.x,y:b.y});
        else if(b.type==='acorn'){const p=g.parts()[0];if(p){g.tap(p);claspHits++;}}
        else if(b.type==='bubble'){const p=g.parts()[0];if(p){g.stroke({x:p.x-p.r*1.5,y:p.y},{x:p.x+p.r*1.5,y:p.y});bubbles++;}}
        else{
          const progress=b.tickle;g.tap({x:b.x,y:b.y});assert.equal(b.tickle,progress,'Tapping a tummy does not fake rubbing');
          g.stroke({x:b.x-b.r*1.7,y:b.y},{x:b.x+b.r*1.7,y:b.y});rubs++;
        }
      }
    }
    for(const e of g.drain())if(e.type==='won')wins++;
  }
  assert(g.done,`Whole trail and boss must be completable: ${width}x${height}/level${level}/seed${seed}`);assert.equal(g.hits,g.config.goal);assert.equal(g.boss.hp,0);assert.equal(wins,1,'One round emits one completion');
  assert.equal(g.tap({x:g.boss.x,y:g.boss.y}),false);assert.equal(g.accessible('boss-body'),false);for(let i=0;i<120;i++)g.step(1/60);assert.equal(g.drain().filter(e=>e.type==='won').length,0,'No repeated win or reward after completion');rounds++;
}
assert(armourHits>0&&claspHits>0&&bubbles>0&&rubs>0);
const idle=new Game(390,620,{random:random(19)});for(let i=0;i<7200;i++)idle.step(1/60);assert.equal(idle.hits,0);assert.equal(idle.phase,'ants');assert(!idle.done);assert(idle.serial>12,'Missed ants keep returning without ending a round');
idle.drain();idle.paused=true;const frozen=JSON.stringify(idle);idle.step(.05);assert.equal(idle.tap({x:195,y:300}),false);assert.equal(idle.stroke({x:0,y:300},{x:390,y:300}),false);assert.equal(JSON.stringify(idle),frozen,'Pause freezes physics and scoring');idle.paused=false;
const count=idle.hits;for(const p of [{x:NaN,y:0},{x:Infinity,y:2},{x:-1,y:1},{x:391,y:1}])assert.equal(idle.tap(p),false);assert.equal(idle.hits,count);
// Real public keyboard actions cover all three bosses without a pointer gesture dependency.
for(let level=1;level<=3;level++){
  const g=new Game(390,620,{level,random:random(level)});let wins=0;
  for(let i=0;i<25000&&!g.done;i++){
    g.step(1/60);if(i%7===0){if(g.phase==='ants'){const a=g.ants.find(a=>a.x>a.r*2&&a.x<g.width-a.r*2);if(a)g.accessible(String(a.id));}else if(g.phase==='boss'){const b=g.boss;if(b.stage==='body')g.accessible('boss-body');else if(b.type==='tickle')g.accessible('tickle-belly');else if(g.parts()[0])g.accessible(g.parts()[0].id);}}
    wins+=g.drain().filter(e=>e.type==='won').length;
  }assert(g.done);assert.equal(wins,1);
}
console.log(`Bug Smash rules: ${rounds} complete tap/swipe/rub rounds across12levels and4screen sizes; all3bosses, armour damage, free misses, pause, resize, finite particles and single completion passed. Three additional keyboard rounds passed. No real account or phone state used.`);
