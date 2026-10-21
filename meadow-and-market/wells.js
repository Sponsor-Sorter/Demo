(() => {
 'use strict';
 const names=['Family stone well','Freshwater family well','Shaded family well','Grand family well','Copper family well','Sheltered spring well','Carved homestead well','Grand brass family well'];
 const goldCosts=[180,420,850,1800,3600,7200,14000],goldLevels=[1,1,1,1,8,12,18,25],jobs=[2,4,7,12,16,22,30,40],drinks=[30,24,18,12,11,10,9,8];
 const gems=[{name:'Crystal spring well',cost:25,level:25,jobs:55,drink:7},{name:'Sapphire family well',cost:50,level:28,jobs:75,drink:6},{name:'Royal crystal well',cost:90,level:32,jobs:100,drink:5},{name:'Crown spring well',cost:150,level:36,jobs:140,drink:4}];
 const tier=o=>Math.max(0,Math.min(7,Math.floor(Number(o?.tier)||0))),gemTier=o=>Math.max(0,Math.min(4,Math.floor(Number(o?.wellGemTier)||0)));
 function stats(o){const t=tier(o),g=t===7?gemTier(o):0,p=g?gems[g-1]:null;return {tier:t,gemTier:g,name:p?.name||names[t],jobs:p?.jobs||jobs[t],drink:p?.drink||drinks[t],stage:t+g+1}}
 function image(o){const s=stats(o);return 'assets/generated/wells/'+(s.gemTier?'well-gem-'+s.gemTier:s.tier>3?'well-gold-'+s.tier:'well-'+s.tier)+'.webp'}
 function nextGold(o,level){const t=tier(o);return t<7?{cost:goldCosts[t],level:goldLevels[t+1],allowed:level>=goldLevels[t+1],jobs:jobs[t+1],drink:drinks[t+1],name:names[t+1]}:null}
 function nextGem(o,level){const g=gemTier(o),p=gems[g];return p?{...p,allowed:tier(o)===7&&level>=p.level,index:g+1}:null}
 window.meadowWells={tier,gemTier,stats,image,nextGold,nextGem,gems};
})();
