'use strict';
const base='https://ejavqlyozqhzqogflqzr.supabase.co';
const key='sb_publishable_NGAHium82O8-2idyjUON5w_37bUAezE';
const $=id=>document.getElementById(id);
let session=null,busy=false;
async function work(action){if(busy)return;busy=true;document.querySelectorAll('button').forEach(b=>b.disabled=true);$('status').textContent='Working…';try{await action();$('status').textContent='';}catch(e){$('status').textContent=e.message||'Could not connect. Please retry.';}finally{busy=false;document.querySelectorAll('button').forEach(b=>b.disabled=false);}}
async function post(path,body,token=''){
 const response=await fetch(base+path,{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json',apikey:key,...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});
 const data=await response.json();if(!response.ok)throw Error(response.status===401?'Sign in again to verify your identity.':'This request could not be completed. Please retry or contact support.');return data;
}
async function update(op='deletion_status'){
 if(!session?.access_token)throw Error('Sign in to manage this request.');
 const answer=await post('/functions/v1/frontliners-commerce',{op,...(op==='request_deletion'?{confirm:'DELETE'}:{})},session.access_token);
 const value=answer.deletion,pending=value.state==='pending';
 $('login').hidden=true;$('controls').hidden=false;$('confirm').value='';
 $('request-state').textContent=pending?'Request received. Reference: '+value.reference+'. Support will verify ownership and confirm completion. You can cancel while it is pending.':value.state==='completed'?'This Frontlines deletion request has been completed.':value.state==='cancelled'?'Your pending request has been cancelled.':'There is no pending deletion request.';
 $('confirmation').hidden=pending||value.state==='completed';$('request').hidden=pending||value.state==='completed';$('cancel').hidden=!pending;
}
$('login').addEventListener('submit',e=>{e.preventDefault();work(async()=>{
 const form=new FormData(e.target);const body={email:String(form.get('email')).trim(),password:String(form.get('password'))};
 $('login').elements.password.value='';
 session=await post('/auth/v1/token?grant_type=password',body);body.password='';await update();
});});
$('request').onclick=()=>work(async()=>{if($('confirm').value!=='DELETE')throw Error('Type DELETE to confirm the request.');await update('request_deletion');});
$('cancel').onclick=()=>work(()=>update('cancel_deletion'));
$('signout').onclick=()=>{session=null;$('login').reset();$('login').hidden=false;$('controls').hidden=true;$('status').textContent='Signed out. This page has not saved your credentials.';};
addEventListener('pagehide',()=>{session=null;});
