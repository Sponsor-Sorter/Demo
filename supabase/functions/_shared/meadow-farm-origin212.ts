import {applyFarmCommands,FarmActionError} from './meadow-farm-actions204.ts';
type Data=Record<string,any>;
// No client snapshot enters this factory. Prices, starter stock and every tile
// are selected by reviewed repository rules and the server clock.
export function createFarmBaseline(now:number,profile:Data){
 if(typeof profile?.friend_code!=='string'||!/^[-a-zA-Z0-9]{1,40}$/.test(profile.friend_code)||typeof profile.display_name!=='string'||profile.display_name.length>80)throw new FarmActionError('INVALID_PROFILE','Connect your farmer profile first.');
 const farm={layoutVersion:2,gridScaleVersion:2,cropClusterVersion:1,tileSizeVersion:1,fixedGridVersion:1,objects:[],storage:[],inventory:{carrot:5,wheat:3,strawberry:2,corn:0,tomato:0,lavender:0,pumpkin:0,apple:0,mushroom:0,egg:1,milk:0},orders:[],done:0,visits:0,shop:{unlocked:false,stock:{},earned:0},expanded:false,expansionLevel:0};
 const state={version:1,coins:250,level:1,xp:0,rep:0,active:'willow',farms:{willow:farm},view:'farm',mode:'tend',inventory:farm.inventory,animals:[],seen:now,orderIndex:0,orientation:'auto',friendCode:profile.friend_code,farmerName:profile.display_name,sharedPantryVersion:1};
 return applyFarmCommands(state,[{type:'farm.initialize'}],now,{initializing:true,ownedCollections:[],sharedLandmarks:[],roundRecords:[]});
}
