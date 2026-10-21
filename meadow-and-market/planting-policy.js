(() => {
 'use strict';
 function crop(well,previous,fallback){return well?.helperPlantMode==='selected'?fallback:(previous||fallback)}
 function canPlant(well,id,inventory,fields,output){
  const cap=Math.max(0,Math.floor(Number(well?.helperCropCap)||0));
  if(!cap)return true;
  const growing=fields.filter(p=>p.type==='plot'&&p.plantedAt&&p.crop===id).reduce((n,p)=>n+output(p),0);
  return (Number(inventory[id])||0)+growing<cap;
 }
 window.meadowPlanting={crop,canPlant};
})();
