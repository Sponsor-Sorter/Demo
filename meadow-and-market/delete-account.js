import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm';
const client=createClient('https://ejavqlyozqhzqogflqzr.supabase.co','sb_publishable_NGAHium82O8-2idyjUON5w_37bUAezE',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const $=s=>document.querySelector(s);let busy=false;
async function run(work){if(busy)return;busy=true;document.querySelectorAll('button').forEach(b=>b.disabled=true);$('#status').textContent='Working…';try{await work();$('#status').textContent='';}catch(e){$('#status').textContent=e.message||'Could not connect. Try again.';}finally{busy=false;document.querySelectorAll('button').forEach(b=>b.disabled=false);}}
async function update(action='status'){
 const result=await client.rpc('meadow_market_account_deletion',{p_action:action});if(result.error)throw Error(result.error.message);
 $('#delete-login').hidden=true;$('#deletion-controls').hidden=false;
 const pending=result.data.pending;$('#deletion-state').textContent=pending?'Deletion is requested for '+new Date(result.data.execute_after).toLocaleDateString()+'. You can cancel before then.':'Your account has not been scheduled for deletion.';
 $('#request-deletion').hidden=pending;$('#confirm-label').hidden=pending;$('#cancel-deletion').hidden=!pending;$('#deletion-confirm').value='';
}
$('#delete-login').onsubmit=e=>{e.preventDefault();run(async()=>{
 const form=new FormData(e.target),username=String(form.get('username')).trim().toLowerCase(),password=String(form.get('password'));
 if(!/^[a-z0-9_]{3,20}$/.test(username))throw Error('Enter your game username.');
 const result=await client.functions.invoke('meadow-market-accounts',{body:{action:'login',username,password}});$('#delete-login input[name="password"]').value='';
 if(result.error||!result.data?.access_token)throw Error(result.data?.error||'Could not sign in. Check your username and password.');
 const session=await client.auth.setSession({access_token:result.data.access_token,refresh_token:result.data.refresh_token});if(session.error)throw Error('Could not establish a private session.');await update();
});};
$('#request-deletion').onclick=()=>run(async()=>{if($('#deletion-confirm').value!=='DELETE')throw Error('Type DELETE to request deletion.');await update('request');});
$('#cancel-deletion').onclick=()=>run(()=>update('cancel'));
$('#sign-out').onclick=()=>run(async()=>{await client.auth.signOut({scope:'local'});$('#delete-login').reset();$('#delete-login').hidden=false;$('#deletion-controls').hidden=true;});
