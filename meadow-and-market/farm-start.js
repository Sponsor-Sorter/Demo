(() => {
 'use strict';
 async function start(a){
  const owner=a.owner(),key='meadow-farm-start-v1:'+owner;let remote=null,lastReply=null;
  if(!owner||typeof a.send!=='function'||typeof a.persist!=='function')throw Error('Connect your farmer account first.');
  const storage={getItem:()=>a.storage.getItem(key),setItem:(_,value)=>a.storage.setItem(key,value),removeItem:()=>a.storage.removeItem(key)};
  const transport=window.meadowFarmCommands.create({owner:a.owner,revision:0,storage,uuid:a.uuid,
   async send(body,who){lastReply=await a.send(body,who);return lastReply;},
   async apply(save,revision){const protocol=lastReply?.data?.save_protocol||4;if(![3,4].includes(protocol))throw Error('The saved farm needs review.');await a.persist(save,revision,owner);remote={save_data:save,revision,save_protocol:protocol};}
  });
  try{
   if(transport.status().pending)await transport.retry();else await transport.run([{type:'farm.initialize'}]);
  }catch(error){
   if(error.code==='ROLLOUT_PENDING'){storage.removeItem();return null;}
   if(error.code==='FARM_CONFLICT'&&[3,4].includes(lastReply?.data?.save_protocol))await transport.useRemote();else throw error;
  }finally{transport.stop();}
  return remote;
 }
 window.meadowFarmStart={start,key:owner=>'meadow-farm-start-v1:'+owner};
})();
