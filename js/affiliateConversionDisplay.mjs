// Stored conversion.commission is a historical percentage, never dollar earnings.
function decimal(value) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!/^\d+(?:\.\d+)?$/.test(text) || text.length > 30) return null;
  const [whole, fraction = ''] = text.split('.');
  if (fraction.length > 12) return null;
  return { units: BigInt(whole + fraction), scale: 10n ** BigInt(fraction.length) };
}

export function conversionDisplay(row) {
  const amount = decimal(row.amount ?? 10);
  const percent = decimal(row.commission);
  if (!amount || !percent || percent.units > 100n * percent.scale) return { rate: null, earned: null };
  // Dollar amount times percent directly gives cents. Round each row half-up,
  // matching PostgreSQL numeric round(...,2) for these nonnegative amounts.
  const divisor = amount.scale * percent.scale;
  const numerator = amount.units * percent.units;
  const cents = (2n * numerator + divisor) / (2n * divisor);
  if (cents > BigInt(Number.MAX_SAFE_INTEGER)) return { rate: null, earned: null };
  return { rate: Number(row.commission), earned: Number(cents) / 100 };
}

export function affiliateReferralUrl(code, origin) {
  const url = new URL('/signup.html', origin);
  url.searchParams.set('ref', String(code));
  return url.href;
}

export function applicationHasSnapshot(application) {
  const snapshot = application?.stats_snapshot;
  return !!snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot) && Object.keys(snapshot).length > 0;
}

export function usersNeedingAudience(applications) {
  return [...new Set(applications.filter(application => !applicationHasSnapshot(application)).map(application => application.user_id).filter(Boolean))];
}
