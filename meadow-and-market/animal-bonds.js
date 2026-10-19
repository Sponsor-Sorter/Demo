(() => {
  'use strict';
  const thresholds=[0,3,9,18,30],names=['New friend','Getting to know you','Farm companion','Trusted friend','Best farm friend'],cooldown=600000;
  function points(a){return Math.max(0,Math.floor(Number(a.friendship?.points)||0))}
  function rank(a){const n=points(a);let level=1;for(let i=1;i<thresholds.length;i++)if(n>=thresholds[i])level=i+1;return level}
  function bonus(a){return rank(a)>=5?2:rank(a)>=3?1:0}
  function wait(a,kind,now=Date.now()){const last=Number(a.friendship?.last?.[kind]);return Number.isFinite(last)?Math.max(0,last+cooldown-now):0}
  function record(a,action,before={},now=Date.now()){
    const kinds=action==='all'?['feed','brush','play'].filter(k=>Number(before[{feed:'hunger',brush:'clean',play:'happy'}[k]])<90):action==='treat'?['feed']:['feed','brush','play'].includes(action)?[action]:[];
    let earned=0;for(const kind of kinds){if(wait(a,kind,now)>0||rank(a)===5)continue;a.friendship ||= {points:0,last:{}};a.friendship.last ||= {};a.friendship.points=points(a)+1;a.friendship.last[kind]=now;earned++}return earned;
  }
  function description(a,now=Date.now()){
    const level=rank(a),n=points(a),extra=bonus(a),next=thresholds[level],waiting=['feed','brush','play'].map(k=>wait(a,k,now)),seconds=Math.ceil(Math.min(...waiting)/1000);
    return {level,name:names[level-1],points:n,bonus:extra,next,needed:next?next-n:0,seconds};
  }
  function card(a){const d=description(a);return '<div class="task-card animal-bond-card"><small class="eyebrow">YOUR FRIENDSHIP · LEVEL '+d.level+' / 5</small><h3>'+d.name+'</h3><p>'+Array.from({length:5},(_,i)=>i<d.level?'♥':'♡').join(' ')+'</p><p class="sheet-copy">'+(d.next?d.points+' / '+d.next+' care stars · '+d.needed+' to the next level.':'A wonderful friendship, saved with your farm.')+' '+(d.bonus?'Adds '+d.bonus+' extra '+(d.bonus===1?'good':'goods')+' to every happy collection.':'At level 3, friendship adds an extra product to every happy collection.')+'</p><small class="sheet-copy" id="animal-bond-timer">'+timing(a)+'</small></div>'}
  function timing(a){const d=description(a);return d.level===5?'Best friends · +2 goods per collection':d.seconds?'Next care star in '+Math.ceil(d.seconds/60)+' minutes.':'Feed, brush or play to earn care stars. Each activity earns one star every 10 minutes.'}
  window.meadowBonds={thresholds,rank,points,bonus,wait,record,description,card,timing};
})();
