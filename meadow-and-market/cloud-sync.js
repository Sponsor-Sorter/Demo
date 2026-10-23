(() => {
  'use strict';
  // Snapshot at enqueue time; slow requests cannot overtake later saves.
  function writer(write,onResult=()=>{}) {
    let running=false,paused=false,epoch=0,active=null;const queue=[],pending=new Set();
    async function drain(){
      if(running)return;running=true;
      while(queue.length&&!paused){const job=queue.shift();let result;active=typeof AbortController==='function'?new AbortController():{abort(){},signal:undefined};try{result=await write(job.userId,job.snapshot,active.signal)}catch(error){result={error}}
        active=null;if(job.epoch===epoch&&!paused)try{onResult(result?.error||null)}catch{}for(const resolve of job.waiters)resolve(result);
      }running=false;
    }
    return {
      enqueue(userId,state) {
        if(paused)return Promise.resolve({error:Error('Cloud save paused until the farm conflict is reviewed')});
        const snapshot=JSON.parse(JSON.stringify(state));
        const promise=new Promise(resolve=>{const last=queue.at(-1);if(last?.userId===userId&&last.epoch===epoch){last.snapshot=snapshot;last.waiters.push(resolve)}else queue.push({userId,snapshot,epoch,waiters:[resolve]});drain()});
        pending.add(promise);promise.finally(()=>pending.delete(promise));return promise;
      },
      flush:async()=>{while(pending.size)await Promise.all([...pending]);},
      pause(){paused=true;epoch++;active?.abort();const result={error:Error('Cloud save paused until the farm conflict is reviewed')};for(const job of queue.splice(0))for(const resolve of job.waiters)resolve(result);},
      resume(){paused=false;drain();},
      status:()=>({writing:running,pending:queue.length,paused})
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
