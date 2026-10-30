const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const context={window:{},document:{addEventListener(){}}};vm.runInNewContext(fs.readFileSync('meadow-and-market/journey-activities.js','utf8'),context);
const phase=context.window.meadowJourneyActivities.phaseAt;
assert.equal(phase([],0),0);assert.equal(phase([],1),2.2);assert(Math.abs(phase([{t:1}],2)-4.6)<1e-10);assert(Math.abs(phase([{t:1},{t:2}],3)-7.2)<1e-10);
let score=0,previous=0,serverPhase=0;const actions=[{t:.71},{t:1.42},{t:2.13}];for(let i=0;i<actions.length;i++){serverPhase+=(actions[i].t-previous)*(2.2+i*.2);previous=actions[i].t;const uiPhase=phase(actions.slice(0,i),actions[i].t);assert(Math.abs(serverPhase-uiPhase)<1e-10);score+=Math.round(Math.max(0,100-Math.abs(Math.sin(uiPhase))*100));}assert(Number.isSafeInteger(score));
console.log('Trip UI timing matches server phases across every cast and changing speed.');
