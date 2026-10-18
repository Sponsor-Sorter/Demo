(() => {
  'use strict';
  // Snapshot at enqueue time; slow requests cannot overtake later saves.
  function writer(write,onResult=()=>{}) {
    let tail=Promise.resolve();
    return {
      enqueue(userId,state) {
        const snapshot=JSON.parse(JSON.stringify(state));
        tail=tail.then(async()=>{try{const result=await write(userId,snapshot);onResult(result?.error||null);return result}catch(error){onResult(error);return {error}}});
        return tail;
      },
      flush:()=>tail
    };
  }
  function profile(state,existing,userId) {
    if(existing?.friend_code)state.friendCode=existing.friend_code;
    if(existing?.display_name&&existing.display_name!=='Meadow Farmer')state.farmerName=existing.display_name;
    return {user_id:userId,friend_code:state.friendCode,display_name:state.farmerName||'Farmer '+state.friendCode.slice(-5),updated_at:new Date().toISOString()};
  }
  const newer=(remote,loadedSeen)=>!!remote&&Number(remote.seen||0)>Number(loadedSeen||0);
  function savedSeen(raw){try{const save=JSON.parse(raw);return save?.version===1?Number(save.seen)||0:0}catch{return 0}}
  window.meadowCloud={writer,profile,newer,savedSeen};
})();
