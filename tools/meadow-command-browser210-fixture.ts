// Disposable anonymous browser-QA data only. Never apply to a player account.
import {applyFarmCommands} from '../supabase/functions/_shared/meadow-farm-actions204.ts';
import {createGameRules} from '../supabase/functions/_shared/meadow-game-rules204.ts';
const now=Date.now(),rules=createGameRules(now) as any;
const seed={version:1,coins:250,level:1,xp:0,rep:0,active:'willow',sharedPantryVersion:1,orderIndex:1,
 tutorial:{version:1,completed:[],rewarded:[],seenContexts:[],introduced:true,paused:true},
 farms:{willow:{layoutVersion:2,gridScaleVersion:2,cropClusterVersion:1,tileSizeVersion:1,fixedGridVersion:1,expansionLevel:0,objects:[
 {id:'p1',type:'plot',x:4,y:3,crop:'carrot',stage:0,plantedAt:0},
 {id:'p2',type:'plot',x:5,y:3,crop:'wheat',stage:0,plantedAt:0},
 {id:'w1',type:'well',x:1,y:5,tier:0,helpers:{jade:true,rhys:true,jay:true},helperCrop:'carrot',helperPlantMode:'previous',helperCropCap:0}
 ],inventory:{carrot:5,wheat:3},orders:[{...rules.vendorDefs[0],vendor:rules.vendorDefs[0].id,id:'qa-order'}],done:0,visits:0,shop:{unlocked:false,stock:{},earned:0}}}};
const result=applyFarmCommands(seed,[{type:'shop.check'},{type:'workers.tick'}],now);
console.log(JSON.stringify(result.save));
