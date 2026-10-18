export function settingsDropdownPosition(anchor, viewport, preferredWidth = 330) {
  const edge = 8, gap = 8;
  const width = Math.max(0, Math.min(preferredWidth, viewport.width - edge * 2));
  const top = anchor.bottom + gap;
  return {
    width,
    left: Math.max(edge, Math.min(anchor.right - width, viewport.width - width - edge)),
    top,
    maxHeight: Math.max(0, Math.min(330, viewport.height - top - edge)),
    visible: anchor.bottom > 0 && anchor.top < viewport.height && anchor.right > 0 && anchor.left < viewport.width,
  };
}

export function anchorSettingsDropdown(trigger, panel, win = window) {
  // Keep navigation selectors and transformed header ancestors out of the menu.
  const doc = panel.ownerDocument;
  if (doc.body && panel.parentElement !== doc.body) doc.body.appendChild(panel);
  if (doc.createElement && !doc.getElementById('settings-dropdown-layout')) {
    const style = doc.createElement('style');
    style.id = 'settings-dropdown-layout';
    style.textContent = `
#settings-dropdown { background:#111923!important;color:#edf3fa!important;padding:6px!important;border:1px solid #36516b!important;border-radius:12px!important;animation:none!important;transition:none!important;overscroll-behavior:contain; }
#settings-dropdown .dropdown-arrow { display:none!important; }
#settings-dropdown ul { display:block!important;list-style:none!important;padding:0!important;margin:0!important;width:100%!important;min-width:0!important;background:transparent!important;box-sizing:border-box!important; }
#settings-dropdown ul > li { display:flex;align-items:center!important;justify-content:space-between!important;gap:12px!important;width:100%!important;min-width:0!important;min-height:44px!important;margin:0!important;padding:0!important;background:none!important;box-sizing:border-box!important;float:none!important;transform:none!important;filter:none!important; }
#settings-dropdown .dropdown-item { display:block;width:100%!important;min-width:0!important;height:auto!important;min-height:44px!important;padding:10px 12px!important;margin:0!important;background:transparent!important;border:0!important;border-radius:6px!important;color:inherit!important;font:500 15px/1.4 system-ui,sans-serif!important;text-align:left!important;white-space:normal!important;box-sizing:border-box!important;cursor:pointer!important;transform:none!important;box-shadow:none!important; }
#settings-dropdown .dropdown-item:hover,#settings-dropdown .dropdown-item:focus-visible { background:#263c51!important;outline:2px solid #67baff!important;outline-offset:-2px!important; }
#settings-dropdown li > span { padding:8px 12px!important;margin:0!important;font:400 15px/1.4 system-ui,sans-serif!important;text-align:left!important; }
#settings-dropdown li > label.switch { display:inline-block!important;flex:0 0 42px!important;width:42px!important;height:24px!important;padding:0!important;margin:0 12px 0 0!important; }
`;
    (doc.head || doc.body).appendChild(style);
  }
  let frame = null;
  const close = () => { panel.style.display = 'none'; trigger.setAttribute('aria-expanded', 'false'); };
  const position = () => {
    if (panel.style.display !== 'block') return;
    const viewport = { width: win.innerWidth, height: win.innerHeight };
    const target = settingsDropdownPosition(trigger.getBoundingClientRect(), viewport);
    if (!target.visible || target.maxHeight < 40) { close(); return; }
    // Inline important properties override the older desktop/mobile offset rules.
    const properties = {
      position: 'fixed', top: `${target.top}px`, left: `${target.left}px`, right: 'auto',
      transform: 'none', margin: '0', width: `${target.width}px`, 'min-width': '0',
      'max-width': `${viewport.width - 16}px`, 'max-height': `${target.maxHeight}px`,
      'box-sizing': 'border-box', 'overflow-y': 'auto', 'z-index': 'var(--z-dropdown, 4000)',
    };
    for (const [key, value] of Object.entries(properties)) panel.style.setProperty(key, value, 'important');
  };
  const schedule = () => {
    if (frame !== null || panel.style.display !== 'block') return;
    frame = win.requestAnimationFrame(() => { frame = null; position(); });
  };
  const open = () => { panel.scrollTop = 0; panel.style.display = 'block'; trigger.setAttribute('aria-expanded', 'true'); position(); };
  const toggle = event => { event.stopPropagation(); panel.style.display === 'block' ? close() : open(); };
  const outside = event => { if (!panel.contains(event.target) && !trigger.contains(event.target)) close(); };
  const keydown = event => { if (event.key === 'Escape' && panel.style.display === 'block') { close(); trigger.focus(); } };
  trigger.setAttribute('aria-controls', panel.id);
  trigger.setAttribute('aria-expanded', 'false');
  trigger.addEventListener('click', toggle);
  panel.addEventListener?.('click', event => {
    if (event.target.closest?.('button, a')) close();
  });
  panel.ownerDocument.addEventListener('click', outside);
  panel.ownerDocument.addEventListener('keydown', keydown);
  win.addEventListener('scroll', schedule, { capture: true, passive: true });
  win.addEventListener('resize', schedule, { passive: true });
  win.visualViewport?.addEventListener('resize', schedule, { passive: true });
  win.visualViewport?.addEventListener('scroll', schedule, { passive: true });
  return { open, close, position };
}
