import { supabase } from './supabaseClient.js';
import { subscriptionBilling, billingErrorMessage } from './subscriptionBilling.mjs?v=20261018-billing1';

export async function handleBillingReturn() {
  const query = new URLSearchParams(location.search);
  const state = query.get('billing');
  if (!['success', 'cancelled'].includes(state)) return;
  const banner = document.createElement('section');
  banner.setAttribute('aria-label', 'Subscription checkout status');
  banner.setAttribute('role', 'status');
  banner.style.cssText = 'padding:16px;margin:16px;border:1px solid #487285;border-radius:8px;overflow-wrap:anywhere;';
  (document.querySelector('main') || document.getElementById('page-content') || document.body).prepend(banner);
  if (state === 'cancelled') {
    banner.textContent = 'You returned from checkout. No subscription change is confirmed here. Open Subscription settings to check your current status.';
    return;
  }
  banner.textContent = 'Checking your subscription with Stripe…';
  try {
    const result = await subscriptionBilling(supabase, 'complete', { session_id: query.get('session_id') });
    if (result.plan !== 'pro' || !result.subscription?.id || !['active', 'trialing'].includes(result.subscription.status)) {
      throw new Error('Subscription completion was not confirmed.');
    }
    banner.textContent = 'Your Pro subscription is confirmed. You can manage it from Subscription settings.';
    const { data } = await supabase.auth.getSession();
    if (data?.session?.user?.id) {
      try { sessionStorage.removeItem(`subscription-checkout:${data.session.user.id}`); } catch { /* Completion is still confirmed. */ }
    }
    const cleanUrl = new URL(location.href);
    cleanUrl.searchParams.delete('billing');
    cleanUrl.searchParams.delete('session_id');
    history.replaceState(null, '', cleanUrl.href);
    window.dispatchEvent(new Event('subscription-billing-updated'));
  } catch (error) {
    banner.textContent = error.code === 'SIGN_IN_REQUIRED'
      ? 'Sign in, then reopen this checkout return link to finish checking your subscription. Do not pay again.'
      : billingErrorMessage(error);
  }
}

document.addEventListener('DOMContentLoaded', handleBillingReturn);
