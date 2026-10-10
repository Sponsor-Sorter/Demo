// Campaign values are not payment receipts or wallet balances.
export function summarizeCampaigns(offers = []) {
  const completed = offers.filter((offer) =>
    ["completed", "review_completed"].includes(offer.status),
  );
  const active = offers.filter((offer) =>
    ["pending", "accepted", "in_progress", "live"].includes(offer.status),
  );
  const accepted = offers.filter((offer) =>
    [
      "accepted",
      "in_progress",
      "live",
      "completed",
      "review_completed",
    ].includes(offer.status),
  );
  const completedValue = completed.reduce((sum, offer) => {
    const value = Number(offer.offer_amount);
    return sum + (Number.isFinite(value) && value >= 0 ? value : 0);
  }, 0);
  return {
    total: offers.length,
    active: active.length,
    completed: completed.length,
    completedValue,
    accepted: accepted.length,
  };
}
