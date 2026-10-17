const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ERROR_MESSAGES = {
  SIGN_IN_REQUIRED: 'Sign in to manage your subscription.',
  IMPERSONATION_ACTIVE: 'Stop impersonation to manage your own subscription.',
  CUSTOMER_REVIEW_REQUIRED: 'Your billing account needs review. Contact support before starting another checkout.',
  ALREADY_SUBSCRIBED: 'You already have a subscription. Use Manage Subscription to review it.',
  CHECKOUT_PENDING: 'Your checkout is still pending. Check its status before starting another checkout.',
  CHECKOUT_EXPIRED: 'Your previous checkout expired. You can try the upgrade again.',
  VERIFY_EMAIL_REQUIRED: 'Verify your email address before managing your subscription.',
  NO_BILLING_CUSTOMER: 'No billing account is linked yet. You can review the Pro upgrade from Subscription settings.',
  WEBHOOK_NOT_CONFIGURED: 'Subscription checkout is temporarily unavailable. Please try again later.',
};

export function billingErrorMessage(error) {
  return ERROR_MESSAGES[error?.code] || 'Subscription details could not be confirmed. Please check again before starting another checkout.';
}

export function subscriptionStatusText(info) {
  if (info?.ok !== true || !['free', 'pro'].includes(info.plan) || typeof info.customer_linked !== 'boolean') {
    throw new Error('Subscription status unavailable.');
  }
  if (info.subscription) {
    const labels = { active: 'Active', trialing: 'Trial', past_due: 'Payment overdue', unpaid: 'Unpaid', canceled: 'Cancelled', incomplete: 'Incomplete', incomplete_expired: 'Expired', paused: 'Paused' };
    return `Subscription: ${labels[info.subscription.status] || 'Status unavailable'}.`;
  }
  return info.customer_linked ? 'Subscription: No active Stripe subscription found.' : 'Subscription: No Stripe subscription linked yet.';
}

// Only the backend chooses the account, Stripe customer, price and return URL.
export function billingBody(action, input = {}) {
  if (action === 'checkout') {
    if (!UUID.test(input.request_id || '')) throw new Error('A checkout request reference is required.');
    const base = new URL(input.frontendBaseUrl);
    const local = base.protocol === 'http:' && base.hostname === 'localhost' && base.port === '5500';
    if ((!local && base.protocol !== 'https:') || base.username || base.password || base.search || base.hash) {
      throw new Error('Invalid website address.');
    }
    return { action, request_id: input.request_id, frontendBaseUrl: base.href.replace(/\/$/, '') };
  }
  if (action === 'complete') {
    if (!/^cs_[A-Za-z0-9_]+$/.test(input.session_id || '')) throw new Error('A valid checkout reference is required.');
    return { action, session_id: input.session_id };
  }
  if (action === 'status' || action === 'portal') return { action };
  throw new Error('Unknown subscription action.');
}

export function stripeBillingUrl(value, action) {
  const url = new URL(value);
  const host = action === 'checkout' ? 'checkout.stripe.com' : action === 'portal' ? 'billing.stripe.com' : null;
  if (!host || url.protocol !== 'https:' || url.hostname !== host || url.port || url.username || url.password) {
    throw new Error('Invalid billing destination.');
  }
  return url.href;
}

// No fallback POST: an interrupted response may already have created a session.
export async function subscriptionBilling(client, action, input) {
  const body = billingBody(action, input);
  const { data: auth, error: authError } = await client.auth.getSession();
  if (authError || !auth?.session?.access_token) {
    const error = new Error('Sign in to manage your subscription.');
    error.code = 'SIGN_IN_REQUIRED';
    throw error;
  }
  const { data, error } = await client.functions.invoke('subscription-billing', { body });
  if (error || !data || typeof data !== 'object' || data.ok !== true) {
    let details = data;
    if (!details && error?.context?.json) {
      try { details = await error.context.json(); } catch { /* No additional request. */ }
    }
    const failure = new Error(billingErrorMessage(details));
    failure.code = details?.code;
    throw failure;
  }
  return data;
}

// Scope an uncertain checkout to the signed-in account; never store credentials.
export function checkoutRequestId(storage, ownerId, randomUUID) {
  if (!UUID.test(ownerId || '')) throw new Error('Sign in to continue.');
  const key = `subscription-checkout:${ownerId}`;
  let id = storage.getItem(key);
  if (!UUID.test(id || '')) {
    id = randomUUID();
    if (!UUID.test(id || '')) throw new Error('Could not prepare checkout.');
    storage.setItem(key, id);
  }
  return id;
}
