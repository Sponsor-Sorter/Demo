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
  const open = () => { panel.style.display = 'block'; trigger.setAttribute('aria-expanded', 'true'); position(); };
  const toggle = event => { event.stopPropagation(); panel.style.display === 'block' ? close() : open(); };
  const outside = event => { if (!panel.contains(event.target) && !trigger.contains(event.target)) close(); };
  const keydown = event => { if (event.key === 'Escape' && panel.style.display === 'block') { close(); trigger.focus(); } };
  trigger.setAttribute('aria-controls', panel.id);
  trigger.setAttribute('aria-expanded', 'false');
  trigger.addEventListener('click', toggle);
  panel.ownerDocument.addEventListener('click', outside);
  panel.ownerDocument.addEventListener('keydown', keydown);
  win.addEventListener('scroll', schedule, { capture: true, passive: true });
  win.addEventListener('resize', schedule, { passive: true });
  win.visualViewport?.addEventListener('resize', schedule, { passive: true });
  win.visualViewport?.addEventListener('scroll', schedule, { passive: true });
  return { open, close, position };
}
