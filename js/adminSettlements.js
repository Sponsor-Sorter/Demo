import {supabase} from './supabaseClient.js';
const host=document.getElementById('verified-settlements');
async function load(){
 if(!host)return;
 const {data,error}=await supabase.rpc('admin_verified_settlement_queue');
 host.replaceChildren();
 if(error){host.textContent='Verified settlements could not be loaded.';return;}
 if(!data?.length){host.textContent='No verified sponsorship payments yet.';return;}
 for(const row of data){
  const card=document.createElement('article');card.className='verified-settlement';
  const title=document.createElement('h3');title.textContent=row.offer_title;
  const detail=document.createElement('p');detail.textContent=[row.creator, new Intl.NumberFormat('en-US',{style:'currency',currency:row.currency}).format(row.amount_cents/100),row.livemode?'Live payment':'Sandbox · no real money',row.review_required?'Payment needs review':row.settlement_status==='transferred'?'Transferred to Stripe balance':row.completed?'Ready for settlement':'Awaiting confirmed completion'].join(' · ');
  card.append(title,detail);
  if(row.stripe_transfer_id){const receipt=document.createElement('p');receipt.textContent='Transfer reference: '+row.stripe_transfer_id;card.append(receipt);}
  if(!row.livemode && row.completed && !row.review_required && row.settlement_status!=='transferred'){
   const button=document.createElement('button');button.type='button';button.textContent='Test sandbox transfer';
   const status=document.createElement('p');status.setAttribute('role','status');
   button.addEventListener('click',async()=>{
    button.disabled=true;status.textContent='Checking verified funding and recipient…';
    let {data,error}=await supabase.functions.invoke('settle-sponsorship',{body:{order_id:row.order_id}});
    if(error?.context){try{data=await error.context.json();}catch{}}
    if(error || data?.status!=='transferred'){status.textContent=(data?.code ? data.code+': ' : '')+(data?.error || 'Settlement could not be confirmed. Retry or request reconciliation.');button.disabled=false;return;}
    await load();
   });card.append(button,status);
  }
  host.append(card);
 }
}
if(host){supabase.auth.getUser().then(({data})=>{if(data?.user)load();});}
