import { supabase } from './supabaseClient.js';

export async function startSetupGuide(force = false) {
  document.getElementById('account-setup-guide')?.remove();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return;
  const { data: profile, error } = await supabase.from('users_extended_data')
    .select('userType,onboarded').eq('user_id',user.id).single();
  if (error || !profile || (!force && profile.onboarded)) return;
  const response = await fetch(new URL('../app-assets/setup-guide.json',import.meta.url));
  if (!response.ok) throw new Error('Setup guide unavailable');
  const catalog = await response.json();
  const steps = catalog[profile.userType?.toLowerCase() === 'besponsored' ? 'creator' : 'sponsor'];
  const key = `ss_setup_step:${user.id}`;
  let step = 0;
  try { const saved=Number(localStorage.getItem(key)); step = !force && Number.isInteger(saved) && saved>=0 && saved<4 ? saved : 0; } catch {}
  const panel = document.createElement('section');
  panel.id = 'account-setup-guide'; panel.className = 'account-setup-guide';
  panel.setAttribute('aria-label','Getting started');
  const host = document.querySelector('.workspace-intro') || document.querySelector('header');
  host?.after(panel);
  let busy = false;
  function render(message = '') {
    panel.replaceChildren();
    const progress = document.createElement('p'); progress.className='setup-progress';
    progress.textContent=`Getting started · ${step + 1} of ${steps.length}`;
    const title=document.createElement('h2'); title.tabIndex=-1; title.textContent=steps[step].title;
    const copy=document.createElement('p'); copy.textContent=steps[step].body;
    const action=document.createElement('a'); action.href=steps[step].web; action.textContent=steps[step].action;
    const controls=document.createElement('div'); controls.className='setup-controls';
    const back=document.createElement('button'); back.type='button'; back.textContent='Back'; back.disabled=step===0 || busy;
    back.onclick=()=>move(step-1);
    const next=document.createElement('button'); next.type='button'; next.textContent=busy?'Saving…':step===3?'Finish guide':'Next'; next.disabled=busy;
    next.onclick=async()=>{
      if(busy)return;
      if(step<3)return move(step+1);
      busy=true;render();
      try {
        const {data:{user:currentUser},error:currentAuthError}=await supabase.auth.getUser();
        if(currentAuthError || currentUser?.id!==user.id)throw Error('Account changed');
        const {error,data}=await supabase.from('users_extended_data').update({onboarded:true}).eq('user_id',user.id).select('user_id').single();
        if(error || data?.user_id!==user.id)throw Error('Save failed');
        try{localStorage.removeItem(key);}catch{}
        panel.replaceChildren(); const done=document.createElement('p'); done.setAttribute('role','status');
        done.textContent='You’re ready to explore. Reopen this guide from Getting started whenever you need it.'; panel.append(done);
      } catch {busy=false;render('Could not save your progress. Check your connection and try again.');}
    };
    const later=document.createElement('button'); later.type='button';later.textContent='Continue later';later.disabled=busy;later.onclick=()=>panel.remove();
    controls.append(back,next,later);
    const status=document.createElement('p');status.setAttribute('role','status');status.textContent=message;
    panel.append(progress,title,copy,action,controls,status);
  }
  function move(value){step=value;let message='';try{localStorage.setItem(key,String(step));if(localStorage.getItem(key)!==String(step))throw Error('Storage unavailable');}catch{message='Progress is available for this visit; it could not be saved in this browser.';}render(message);panel.querySelector('h2')?.focus({preventScroll:true});}
  render();
}
