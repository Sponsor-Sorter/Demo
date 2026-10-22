(() => {
  'use strict';
  // Snapshot at enqueue time; slow requests cannot overtake later saves.
  function writer(write,onResult=()=>{}) {
    let tail=Promise.resolve(),running=false;const queue=[];
    async function drain(){
      if(running)return;running=true;
      while(queue.length){const job=queue.shift();let result;try{result=await write(job.userId,job.snapshot)}catch(error){result={error}}
        try{onResult(result?.error||null)}catch{}for(const resolve of job.waiters)resolve(result);
      }running=false;
    }
    return {
      enqueue(userId,state) {
        const snapshot=JSON.parse(JSON.stringify(state));
        tail=new Promise(resolve=>{const pending=queue.at(-1);if(pending?.userId===userId){pending.snapshot=snapshot;pending.waiters.push(resolve)}else queue.push({userId,snapshot,waiters:[resolve]});drain()});
        return tail;
      },
      flush:()=>tail,
      status:()=>({writing:running,pending:queue.length})
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
