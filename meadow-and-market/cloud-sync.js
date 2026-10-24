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
  const newer=(remote,loaded)=>{if(!remote)return false;const a=remote._cloudRevision,b=loaded?._cloudRevision;if(Number.isSafeInteger(a)&&Number.isSafeInteger(b))return a>b;return Number(remote.seen||0)>Number(typeof loaded==='object'?loaded?.seen||0:loaded||0)};
  function committer(initialRevision=0,onConflict=()=>{},onAck=()=>{}) {
    let revision=Number(initialRevision)||0,pending=null;
    const id=()=>typeof crypto==='object'&&crypto.randomUUID?crypto.randomUUID():'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const n=Math.floor(Math.random()*16);return(c==='x'?n:n&3|8).toString(16)});
    const interrupted=()=>({error:Error('Farm save interrupted; its receipt will be checked when reconnecting')});
    async function send(client,job,signal){
      if(signal?.aborted)return interrupted();
      let request=client.rpc('meadow_market_commit_save',{p_expected_revision:job.revision,p_save_data:job.snapshot,p_write_id:job.id});
      if(signal&&request.abortSignal)request=request.abortSignal(signal);
      let result;try{result=await request}catch(error){return{error}}
      if(signal?.aborted)return interrupted();
      if(result?.error)return result;
      const reply=result?.data;
      if(reply?.conflict){pending=null;revision=Number(reply.revision)||0;onConflict(reply.save_data);return{error:Object.assign(Error('Another farm revision is ready to review'),{code:'MEADOW_SAVE_CONFLICT'})}}
      if(!reply?.ok||!Number.isSafeInteger(reply.revision)||reply.revision<job.revision+1||reply.write_id!==job.id)return{error:Error('Invalid farm-save receipt')};
      revision=reply.revision;pending=null;onAck(revision);return{data:reply,error:null};
    }
    return {
      async commit(client,snapshot,signal){
        // An uncertain response keeps the same request ID and immutable body. Resolve it before a newer snapshot.
        if(pending){const result=await send(client,pending,signal);if(result.error)return result}
        if(signal?.aborted)return interrupted();
        const job={id:id(),revision,snapshot:JSON.parse(JSON.stringify({...snapshot,_cloudRevision:revision}))};pending=job;
        return send(client,job,signal);
      },
      observe(remote){if(Number.isSafeInteger(remote?._cloudRevision)&&remote._cloudRevision>=revision){revision=remote._cloudRevision;pending=null}},
      revision:()=>revision
    };
  }
  function savedSeen(raw){try{const save=JSON.parse(raw);return save?.version===1?Number(save.seen)||0:0}catch{return 0}}
  function acknowledgedRevision(raw,owner,seen){try{const a=JSON.parse(raw);return a?.owner===owner&&a.seen===seen&&Number.isSafeInteger(a.revision)&&a.revision>=0?a.revision:null}catch{return null}}
  window.meadowCloud={writer,committer,profile,newer,savedSeen,acknowledgedRevision};
})();
