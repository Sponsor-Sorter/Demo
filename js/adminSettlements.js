import {supabase} from './supabaseClient.js';
import {validateQueue,createEarningOperation,amountText,receiptText} from './adminEarnings.mjs?v=20261021-1';
const host=document.getElementById('verified-settlements');
const node=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
let loading=false;
function reviewDialog(row,operation,result,onDone){
 const previous=document.activeElement,dialog=node('dialog');dialog.className='earnings-review';
 dialog.setAttribute('aria-labelledby','earnings-review-heading');
 const heading=node('h3','Review creator earning');heading.id='earnings-review-heading';
 const summary=node('p',`${row.offer_title} · ${row.creator || row.creator_id}`);
 const status=node('p');status.setAttribute('role','status');
 const cancel=node('button','Close');cancel.type='button';
 const close=()=>{operation.cancel();dialog.close();dialog.remove();previous?.focus();};
 cancel.addEventListener('click',close);dialog.addEventListener('cancel',event=>{event.preventDefault();if(!cancel.disabled)close();});
 dialog.append(heading,summary);
 if(result.completed){dialog.append(node('p',receiptText(result.data)),node('p','Existing result loaded read-only. No earning was executed.'),cancel);}
 else{
  const p=result.data;
  dialog.append(node('p',`${amountText(p.amount_cents)} · ${p.livemode?'Live environment':'Sandbox environment'} · ${p.route==='wallet'?'Sponsor Sorter wallet credit':'Stripe balance transfer'}`),node('p','Preview performed no writes. A wallet credit is not an external withdrawal; a Stripe transfer is not a confirmed bank payout.'));
  const label=node('label'),check=node('input');check.type='checkbox';label.append(check,document.createTextNode(' I have reviewed this earning, amount, route and environment.'));
  const confirm=node('button','Confirm and settle this earning');confirm.type='button';confirm.disabled=true;
  check.addEventListener('change',()=>{confirm.disabled=!check.checked;});
  confirm.addEventListener('click',async()=>{
   if(!check.checked||confirm.disabled)return;
   confirm.disabled=true;check.disabled=true;cancel.disabled=true;status.textContent='Confirming this canonical earning…';
   try{const receipt=await operation.execute(true);status.textContent=receiptText(receipt);confirm.remove();check.disabled=true;await onDone();}
   catch{status.textContent='Execution could not be confirmed. Close and re-preview this same earning before any further action, or request reconciliation.';confirm.remove();}
   finally{cancel.disabled=false;}
  });
  dialog.append(label,confirm,cancel,status);
 }
 document.body.append(dialog);dialog.showModal();cancel.focus();
}
async function load(cursor=null){
 if(!host||loading)return;loading=true;
 host.replaceChildren(node('p','Checking current Admin session…'));
 try{
  const {data:auth,error:authError}=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if(authError||auth?.currentLevel!=='aal2'){
   host.replaceChildren(node('p','A current verified Admin session with MFA (AAL2) is required to view creator earnings. Sign in and complete your existing MFA verification, then reload this section.'));
   const link=node('a','Sign in');link.href='./login.html';host.append(link);return;
  }
  const {data,error}=await supabase.rpc('admin_creator_earnings_queue',{p_limit:50,p_before_agreement_id:cursor});
  if(error){host.replaceChildren(node('p','Earnings access is unavailable. A current verified, unbanned Admin session with MFA (AAL2) is required. If your session is current, contact support.'));return;}
  const queue=validateQueue(data);host.replaceChildren();
  const refresh=node('button','Refresh earnings');refresh.type='button';refresh.addEventListener('click',()=>load());host.append(refresh);
  host.append(node('p','Queue candidates are not provider-verified. Review each earning with a fresh preview. Automatic execution is disabled.'));
  if(!queue.items.length)host.append(node('p','No funded creator earnings found.'));
  for(const row of queue.items){
   const card=node('article');card.className='verified-settlement';
   card.append(node('h3',row.offer_title),node('p',`${row.creator || row.creator_id} · ${row.amount_cents===null?'Amount requires review':amountText(row.amount_cents)} · ${row.source==='wallet'?'Wallet-funded':'Stripe-funded'} · ${row.livemode?'Live':'Sandbox'} · ${row.offer_kind==='group'?'Group agreement':'Private agreement'}`),node('p',row.review_required?'Review hold':row.settlement_status==='wallet_credited'?'Wallet credit recorded':row.settlement_status==='transferred'?'Stripe balance transfer recorded':row.settlement_status==='processing'?'Processing — reconcile this earning':row.completed?'Completion confirmed; preview required':'Awaiting confirmed completion'));
   if(row.settlement_id)card.append(node('p','Settlement reference: '+row.settlement_id));
   if(row.transfer_id)card.append(node('p','Stripe transfer reference: '+row.transfer_id));
   if(row.completed&&!row.review_required&&row.amount_cents!==null){
    const preview=node('button','Preview earning');preview.type='button';const status=node('p');status.setAttribute('role','status');
    const operation=createEarningOperation(supabase,row);
    preview.addEventListener('click',async()=>{
     preview.disabled=true;status.textContent='Checking canonical funding, route and current eligibility…';
     try{const result=await operation.preview();status.textContent='';reviewDialog(row,operation,result,()=>load());}
     catch{status.textContent='Preview unavailable. This same earning may require review, current Admin MFA, or reconciliation. No execution was requested.';}
     finally{preview.disabled=false;}
    });card.append(preview,status);
   }
   host.append(card);
  }
  for(const limitation of queue.limitations)host.append(node('p',limitation));
  if(queue.next_cursor){const more=node('button','Next earnings page');more.type='button';more.addEventListener('click',()=>load(queue.next_cursor));host.append(more);}
 }catch{host.replaceChildren(node('p','Earnings could not be verified. Refresh after checking your Admin MFA session. No execution was requested.'));}
 finally{loading=false;}
}
if(host)load();
