const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),source=fs.readFileSync('meadow-and-market/game.js','utf8');
const nodes={};let writes=0,schedules=0,notices=0,fail=true;
const scope={replacingFarm:false,window:{},state:{coins:123,level:4},Date,JSON,SAVE_KEY:'test-farm',localStorage:{setItem(){writes++;if(fail)throw Error('QuotaExceededError')}},cloudReady:true,$:id=>nodes[id]||=( {} ),scheduleCloudSave:()=>schedules++,notify:()=>notices++};
vm.createContext(scope);vm.runInContext('let storageWarningShown=false;'+source.match(/  function save\([^\n]+/)[0],scope);
assert.doesNotThrow(()=>scope.save());assert.equal(schedules,1,'Cloud save is still scheduled when local storage fails');assert.equal(nodes['#coins'].textContent,'123');assert.equal(nodes['#level'].textContent,'Lv. 4');assert(nodes['#save-status'].textContent.includes('unavailable'));scope.save();assert.equal(notices,1,'A full device does not flood the player with notices');
fail=false;scope.save();assert(nodes['#save-status'].textContent.startsWith('Saved here'));fail=true;scope.cloudReady=false;scope.save();assert.equal(notices,2,'A new failure after recovery is reported');assert(nodes['#save-status'].textContent.includes('export a backup'));
scope.replacingFarm=true;const prior=writes;scope.save();assert.equal(writes,prior,'Farm replacement retains its save barrier');
console.log('Storage-full handling: gameplay remains responsive, cloud sync continues, truthful save status, quiet repeated failures, recovery and replacement barrier passed.');
