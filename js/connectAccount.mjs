const ACCOUNT = /^acct_[A-Za-z0-9]+$/;
const MESSAGES = {
  CONNECT_PLATFORM_NOT_ENABLED: 'Stripe payout setup is unavailable until Sponsor Sorter completes its live Stripe setup. Contact support.',
  SIGN_IN_REQUIRED: 'Sign in to check your payout account.',
  ACCOUNT_UNAVAILABLE: 'Your account cannot manage payout settings right now.',
  VERIFY_EMAIL_REQUIRED: 'Verify your email before setting up a payout account.',
  CONNECT_ACCOUNT_REVIEW_REQUIRED: 'Your payout account needs review. Contact support before creating another account.',
  CONNECT_CREATION_REVIEW_REQUIRED: 'Payout account setup needs review. Do not create another account; contact support.',
  INVALID_RETURN_URL: 'Payout setup could not return to this Website. Please contact support.',
};
export function connectErrorMessage(error) {
  return MESSAGES[error?.code] || 'Stripe payout settings could not be confirmed. Please try again later.';
}
export function connectPayoutReady(info) {
  return !!info?.account_id && info.test_mode === false && info.migration_required === false && info.settlement_ready === true && info.status?.capability_source === 'accounts_v2' && info.status?.payouts_enabled === true && info.status?.capabilities?.transfers === 'active';
}
export function connectStatusMessage(info) {
  if (info.migration_required) return (info.test_mode ? 'Stripe test account. ' : '') + 'Existing Stripe account needs an upgrade before automated settlement. Updating account details does not complete this upgrade or enable live withdrawals.';
  if (info.test_mode) return 'Stripe test account. This does not enable live withdrawals.';
  if (!info.account_id) return 'No Stripe payout account linked. Setup is required.';
  if (connectPayoutReady(info)) return 'Stripe payout account is enabled. Withdrawal requests still require processing.';
  return 'Stripe payout setup is incomplete or requires attention. Withdrawals are not confirmed ready.';
}
export function validateConnectStatus(data) {
  const status=data?.status, context=data?.stripe_context;
  if (data?.ok !== true || !context || !ACCOUNT.test(context.account_id || '') ||
      typeof context.livemode !== 'boolean' || data.test_mode !== !context.livemode ||
      typeof data.setup_required !== 'boolean' || typeof data.migration_required !== 'boolean' || typeof data.settlement_ready !== 'boolean' ||
      !(data.account_id === null || ACCOUNT.test(data.account_id || '')) ||
      typeof status?.details_submitted !== 'boolean' || typeof status?.payouts_enabled !== 'boolean' ||
      !(status.disabled_reason === null || (typeof status.disabled_reason === 'string' && status.disabled_reason.length <= 300)) ||
      !['active','pending','inactive','unrequested','unavailable'].includes(status.capabilities?.transfers) ||
      (data.account_id !== null && !['accounts_v2','accounts_v1_legacy'].includes(status.capability_source)) ||
      (status.capability_source === 'accounts_v1_legacy' && (!data.migration_required || data.settlement_ready || status.payouts_enabled || typeof status.legacy_payouts_enabled !== 'boolean')) ||
      (status.capability_source === 'accounts_v2' && data.migration_required) ||
      (data.settlement_ready && (data.account_id === null || status.capability_source !== 'accounts_v2' || !status.payouts_enabled || status.capabilities.transfers !== 'active')) ||
      !['currently_due','past_due'].every(key => Array.isArray(status[key]) && status[key].length <= 100 && status[key].every(value => typeof value === 'string' && value.length <= 200)) ||
      (data.account_id === null && (!data.setup_required || data.migration_required || data.settlement_ready || status.payouts_enabled || status.capabilities.transfers !== 'inactive'))) throw Error('Invalid payout status.');
  return data;
}
export function connectStripeUrl(value) {
  const url=new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== 'connect.stripe.com' || url.port || url.username || url.password || !url.pathname.startsWith('/')) throw Error('Invalid payout destination.');
  return url.href;
}
export function connectBody(action, input={}) {
  if (action !== 'onboarding' && action !== 'dashboard') throw Error('Invalid payout action.');
  const body={action};
  if (action === 'onboarding') for (const key of ['returnUrl','refreshUrl']) if (input[key] !== undefined) {
    const url=new URL(input[key]);
    if (url.protocol !== 'https:' || !['sponsorsorter.com','www.sponsorsorter.com'].includes(url.hostname) || url.port || url.username || url.password || url.hash ||
        !['/settings.html','/dashboardsponsor.html','/dashboardsponsee.html'].includes(url.pathname) || url.search !== '?tab=payments') throw Error('Invalid return address.');
    body[key]=url.href;
  }
  return body;
}
export function validateConnectDiagnostics(data) {
  if (data?.ok !== true || typeof data.subscription_webhook_configured !== 'boolean' || typeof data.featured_webhook_configured !== 'boolean') throw Error('Invalid diagnostics.');
  const result={ok:true,subscription_webhook_configured:data.subscription_webhook_configured,featured_webhook_configured:data.featured_webhook_configured};
  for (const name of ['billing','sponsorship']) {
    const value=data[name];
    if (!value || typeof value.configured !== 'boolean' ||
        (value.available !== undefined && value.available !== false) ||
        (value.account_id !== undefined && !ACCOUNT.test(value.account_id)) ||
        (value.livemode !== undefined && typeof value.livemode !== 'boolean')) throw Error('Invalid diagnostics.');
    result[name]={configured:value.configured,available:value.available !== false};
    if (value.account_id !== undefined) result[name].account_id=value.account_id;
    if (value.livemode !== undefined) result[name].livemode=value.livemode;
  }
  return result;
}
export async function connectAccount(client, action='status', input={}) {
  const controller=new AbortController();let timer;
  try {
    const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('Payout request timed out.'));},25000);});
    return await Promise.race([(async()=>{
      const auth=await client.auth.getSession();const session=auth?.data?.session;
      if(auth?.error || !session?.access_token || !session?.user?.id){const error=Error('Sign in required.');error.code='SIGN_IN_REQUIRED';throw error;}
      if(controller.signal.aborted)throw Error('Payout request timed out.');
      const options={method:['status','diagnostics'].includes(action)?'GET':'POST',headers:{Authorization:`Bearer ${session.access_token}`},signal:controller.signal};
      if(!['status','diagnostics'].includes(action))options.body=connectBody(action,input);
      const reply=await client.functions.invoke(action==='diagnostics'?'get_connect_onboarding_link?diagnostics=stripe':'get_connect_onboarding_link',options);
      if(reply?.error || (reply?.response && !reply.response.ok) || reply?.data?.ok!==true){
        let details=reply?.data;
        if(!details && reply?.error?.context?.json)try{details=await reply.error.context.json();}catch{}
        const error=Error(connectErrorMessage(details));error.code=Object.hasOwn(MESSAGES,details?.code)?details.code:'CONNECT_UNAVAILABLE';throw error;
      }
      if(action==='diagnostics')return validateConnectDiagnostics(reply.data);
      const data=validateConnectStatus(reply.data);
      if(action==='onboarding')connectStripeUrl(data.onboarding_url);
      if(action==='dashboard')connectStripeUrl(data.dashboard_url);
      return data;
    })(),deadline]);
  }catch(error){const safe=Error(connectErrorMessage(error));safe.code=Object.hasOwn(MESSAGES,error?.code)?error.code:'CONNECT_UNAVAILABLE';throw safe;}
  finally{clearTimeout(timer);}
}
