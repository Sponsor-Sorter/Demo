/* Personal practice records only. This module never grants farm goods or leaderboard points. */
(() => {
  'use strict';
  const key=owner=>'meadow-markets-bee-challenge-v1:'+encodeURIComponent(String(owner).slice(0,100));
  const integer=(value,max=100000)=>Number.isFinite(value)?Math.max(0,Math.min(max,Math.floor(value))):0;
  function load(storage,owner){
    const data={last:0,maps:{}};
    try{
      const saved=JSON.parse(storage.getItem(key(owner))||'null');
      if(!saved||typeof saved!=='object')return data;
      data.last=integer(saved.last,19);
      for(let i=0;i<20;i++){
        const row=saved.maps?.[i];if(!row||!integer(row.wins))continue;
        data.maps[i]={wins:integer(row.wins),score:integer(row.score),ink:integer(row.ink,1000),stars:integer(row.stars,3)};
      }
    }catch{}
    return data;
  }
  function score(level,spent,usedHint){
    const ink=Math.max(0,Math.min(level.ink,Math.ceil(spent)));
    return {ink,stars:1+(ink<=level.ink*.85?1:0)+(usedHint?0:1),score:1000+Math.max(0,level.ink-ink)*10+(usedHint?0:500)};
  }
  function write(storage,owner,data){try{storage.setItem(key(owner),JSON.stringify(data));return true;}catch{return false;}}
  function record(storage,owner,index,result){
    const data=load(storage,owner),old=data.maps[index];
    data.last=Math.min(19,index+1);
    data.maps[index]={wins:(old?.wins||0)+1,score:Math.max(old?.score||0,result.score),ink:Math.min(old?.ink??1000,result.ink),stars:Math.max(old?.stars||0,result.stars)};
    return {data,saved:write(storage,owner,data)};
  }
  window.meadowBeeChallengeProgress={key,load,score,record,write};
})();
