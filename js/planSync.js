// File: ./js/planSync.js
//
// Purpose:
// Keep users_extended_data.planType in sync with actual Stripe subscription status.
// - If user has an ACTIVE Stripe subscription => planType should be 'pro'.
// - If user has NO active subscription       => planType should be 'free'.
//
// This uses the existing `stripe_subscription_info` Edge Function and
// the `users_extended_data.planType` column (already used elsewhere).

import { supabase } from './supabaseClient.js';
import { getActiveUser } from './impersonationHelper.js';

/**
 * Sync the current user's planType with their Stripe subscription.
 *
 * Returns:
 *  - 'pro'  if user ends up marked Pro
 *  - 'free' if user ends up marked Free
 *  - null   on error / no user
 */
export async function syncPlanTypeFromStripe(options = {}) {
  const { silent = false } = options;

  try {
    const user = await getActiveUser();
    if (!user || !user.user_id) {
      if (!silent) console.warn('[planSync] No active user; skipping plan sync.');
      return null;
    }

    const currentPlanRaw = user.planType || 'free';
    const currentPlan = String(currentPlanRaw).toLowerCase();

    // If there is no Stripe customer ID at all, they cannot have a live subscription.
    if (!user.stripe_customer_id) {
      if (currentPlan === 'pro') {
        // Safety: downgrade stray Pro rows that don't have Stripe backing.
        try {
          const { error } = await supabase
            .from('users_extended_data')
            .update({ planType: 'free' })
            .eq('user_id', user.user_id);

          if (error) {
            if (!silent) {
              console.error('[planSync] Failed to downgrade planType to free (no stripe_customer_id):', error);
            }
          } else if (!silent) {
            console.info('[planSync] Downgraded planType from pro -> free (no stripe_customer_id).');
          }
        } catch (err) {
          if (!silent) {
            console.error('[planSync] Unexpected error downgrading planType:', err?.message || err);
          }
        }
        return 'free';
      }
      // Already free; nothing to do.
      return currentPlan;
    }

    // Call the Edge Function to see if there is an ACTIVE subscription for this customer.
    let info;
    try {
      const { data, error } = await supabase.functions.invoke('stripe_subscription_info', {
        body: { customer_id: user.stripe_customer_id },
      });
      if (error) throw error;
      info = data;
    } catch (err) {
      if (!silent) {
        console.warn('[planSync] Error calling stripe_subscription_info:', err?.message || err);
      }
      // Don't change anything if we can't confirm.
      return currentPlan;
    }

    // Per your settings.js usage: data.subscription is only set if there is an *active* subscription.
    const hasActiveSubscription = !!info?.subscription;
    const desiredPlan = hasActiveSubscription ? 'pro' : 'free';

    if (desiredPlan === currentPlan) {
      if (!silent) {
        console.info('[planSync] planType already in sync with Stripe:', desiredPlan);
      }
      return currentPlan;
    }

    // Persist the new planType
    try {
      const { error: updateError } = await supabase
        .from('users_extended_data')
        .update({ planType: desiredPlan })
        .eq('user_id', user.user_id);

      if (updateError) {
        if (!silent) {
          console.error('[planSync] Failed to update planType:', updateError);
        }
        return currentPlan;
      }

      if (!silent) {
        console.info(`[planSync] planType updated from ${currentPlan} -> ${desiredPlan} based on Stripe.`);
      }
      return desiredPlan;
    } catch (err) {
      if (!silent) {
        console.error('[planSync] Unexpected error updating planType:', err?.message || err);
      }
      return currentPlan;
    }
  } catch (err) {
    if (!silent) {
      console.error('[planSync] Unexpected error during plan sync:', err?.message || err);
    }
    return null;
  }
}

// Auto-run on any page that imports this module.
// Fire-and-forget; nothing critical in the app should depend on this finishing.
document.addEventListener('DOMContentLoaded', () => {
  syncPlanTypeFromStripe({ silent: true }).catch(() => {
    // swallow errors; this is a best-effort sync only
  });
});
