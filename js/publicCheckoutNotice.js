export function showPublicCheckoutUnavailable(offerData, options = {}) {
  const injectedStorage = Object.hasOwn(options, 'storage');
  const statusElement = options.statusElement ?? globalThis.document?.getElementById('offerCheckoutStatus');
  let draftSaved = false;
  try {
    const storage = injectedStorage ? options.storage : globalThis.localStorage;
    storage.setItem('pendingOfferData', JSON.stringify(offerData));
    draftSaved = true;
  } catch (_) {
    // Storage may be blocked or full; report that without stopping the form flow.
  }

  if (statusElement) {
    statusElement.textContent = draftSaved
      ? 'Card checkout is temporarily unavailable. Your offer draft is saved in this browser. You can copy your details before leaving, or contact support for help.'
      : 'Card checkout is temporarily unavailable, and this browser could not save your offer draft. Copy your details before leaving, or contact support for help.';
    statusElement.hidden = false;
  }

  return draftSaved;
}
