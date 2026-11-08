/* The approved farmer explains the current activity, once per phase. */
(() => {
  'use strict';
  const keys={
    jade:new Set(['nest-line','nest-smooth','nest-hatch','garden-plant','garden-water','garden-pick','garden-wash','garden-share','weather-dress','weather-rainy','weather-sunny','weather-windy','laundry-hang','laundry-peg','laundry-dry','laundry-collect','kindness-snack','kindness-water','kindness-play','post-stamp','post-deliver']),
    rhys:new Set(['bridge-fit','bridge-guide','pond-pads','pond-feed','pond-swim']),jay:new Set(['spring-return','hay-stack','hay-fluff','hay-rest','market-pack','market-weigh','market-deliver','slide-intro'])
  };
  function instructionId(farmer,key){return keys[farmer]?.has(key)?'journey-'+farmer+'-'+key:null;}
  function instruction(adventure,key){
    const id=instructionId(adventure.g.farmer,key);
    if(!id||adventure.finished)return Promise.resolve(0);
    adventure.helpVoice=id;
    if(adventure.spokenJourney===id)return adventure.journeySpeech||Promise.resolve(0);
    if(document.hidden){
      if(adventure.pendingJourney!==id){adventure.pendingJourney=id;adventure.later(()=>{if(adventure.pendingJourney===id)adventure.pendingJourney=null;if(adventure.helpVoice===id)instruction(adventure,key);},180);}
      return Promise.resolve(0);
    }
    adventure.spokenJourney=id;
    adventure.journeySpeech=Promise.resolve(window.meadowAudio?.speak(id)||0);
    return adventure.journeySpeech;
  }
  window.meadowJourneyAudio={instructionId,instruction};
})();
