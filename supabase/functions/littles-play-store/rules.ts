export const PACKAGE = 'com.meadowmarket.littles';
export const PRODUCT = 'ml_plus';
export const BASE_PLAN = 'monthly';
const allowed = new Set(['SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD', 'SUBSCRIPTION_STATE_CANCELED']);
export function validateSubscription(purchase: any, account: string, now = Date.now()) {
  if (!purchase || purchase.externalAccountIdentifiers?.obfuscatedExternalAccountId !== account) throw new Error('PURCHASE_ACCOUNT_MISMATCH');
  const lines = purchase.lineItems?.filter((line: any) => line.productId === PRODUCT && line.offerDetails?.basePlanId === BASE_PLAN);
  if (!lines?.length) throw new Error('PURCHASE_PRODUCT_MISMATCH');
  const inactiveWithoutExpiry = ['SUBSCRIPTION_STATE_PENDING', 'SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED'].includes(purchase.subscriptionState);
  const expires = inactiveWithoutExpiry ? 0 : Math.max(...lines.map((line: any) => Date.parse(line.expiryTime)));
  if (!Number.isFinite(expires) || typeof purchase.subscriptionState !== 'string') throw new Error('PURCHASE_NOT_VERIFIED');
  return { state: purchase.subscriptionState, expires: new Date(expires).toISOString(),
    active: allowed.has(purchase.subscriptionState) && expires > now,
    acknowledged: purchase.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED',
    test: purchase.testPurchase !== undefined, order: purchase.latestOrderId || null };
}
export function effectivePlus(paid: boolean, complimentary: boolean) {
  return { active: paid || complimentary, paid, complimentary };
}
export function parseNotification(raw: string) {
  if (raw.length > 32768) throw new Error('INVALID_NOTIFICATION');
  const message = JSON.parse(raw)?.message;
  if (!message || typeof message.data !== 'string' || message.data.length > 24000) throw new Error('INVALID_NOTIFICATION');
  const data = JSON.parse(atob(message.data));
  if (data.testNotification) return null;
  if (data.packageName !== PACKAGE) throw new Error('WRONG_PACKAGE');
  const token = data.subscriptionNotification?.purchaseToken || data.voidedPurchaseNotification?.purchaseToken;
  if (typeof token !== 'string' || token.length < 10 || token.length > 4096) throw new Error('INVALID_NOTIFICATION');
  return token;
}
