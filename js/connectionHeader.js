import { connectionGridRoutes as routes } from './connectionGridRoutes.js?v=20261011-grid4';

import { updateGridTrail } from './gridLineTrail.mjs?v=20261017-lines1';
import './headerFeaturedAccounts.mjs?v=20261017-featured1';

// Build junctions from the paths traced over the original grid artwork.
const junctions = new Map();
function junction(x, y) {
  const key = `${x},${y}`;
  if (!junctions.has(key)) junctions.set(key, { x, y, neighbours: new Set() });
  return junctions.get(key);
}
for (const route of routes) {
  let previous;
  let x = 0, y = 0;
  for (const match of route.matchAll(/([MHV])([\d.]+)(?:\s+([\d.]+))?/g)) {
    if (match[1] === 'M') { x = +match[2]; y = +match[3]; previous = junction(x, y); continue; }
    if (match[1] === 'H') x = +match[2]; else y = +match[2];
    const next = junction(x, y);
    if (previous !== next) { previous.neighbours.add(next); next.neighbours.add(previous); }
    previous = next;
  }
}
const nodes = [...junctions.values()].filter(node => node.neighbours.size);
const pick = items => items[Math.floor(Math.random() * items.length)];
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const stylesheet = document.createElement('link');
stylesheet.rel = 'stylesheet';
stylesheet.href = new URL('../connection-header.css?v=20261018-calm1', import.meta.url).href;
document.head.append(stylesheet);

for (const header of document.querySelectorAll('header.navbar1, header.header, header.admin-site-header')) {
  header.classList.add('connection-header');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 2222 888');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.classList.add('connection-artwork');
  const layer = document.createElement('div');
  layer.className = 'connection-grid';
  layer.setAttribute('aria-hidden', 'true');
  layer.append(svg);
  header.prepend(layer);
  const shape = (className, tag = 'circle') => {
    const element = document.createElementNS(svg.namespaceURI, tag);
    element.setAttribute('class', className);
    svg.append(element);
    return element;
  };
  const lights = Array.from({ length: 28 }, () => ({ element: shape('grid-travelling-line', 'path') }));
  const pulses = [];
  svg.dataset.connections = '0';
  svg.dataset.connectionRestarts = '0';
  let visibleNodes = nodes;
  function resize() {
    const { width, height } = header.getBoundingClientRect();
    visibleNodes = nodes.filter(n => n.x >= 80 && n.x <= width + 80 && n.y >= 888 - height && n.y <= 888);
    if (!visibleNodes.length) visibleNodes = nodes;
  }
  function turn(light) {
    const options = [...light.node.neighbours];
    const forward = options.filter(n => n !== light.previous);
    light.target = pick(forward.length && Math.random() < 0.88 ? forward : options);
  }
  function spawn(light) {
    const elsewhere = visibleNodes.filter(n => Math.hypot(n.x - light.x, n.y - light.y) > 90);
    const candidates = elsewhere.length ? elsewhere : visibleNodes;
    const active = lights.filter(other => other !== light && !other.waiting && Number.isFinite(other.x));
    // Prefer open areas instead of letting respawns cluster around busy junctions.
    let best = pick(candidates), clearance = -1;
    for (let attempt = 0; attempt < 48; attempt++) {
      const candidate = pick(candidates);
      const distance = active.reduce((nearest, other) => Math.min(nearest, Math.hypot(candidate.x - other.x, candidate.y - other.y)), Infinity);
      if (distance > clearance) { best = candidate; clearance = distance; }
    }
    light.node = best;
    light.previous = null;
    light.x = light.node.x; light.y = light.node.y;
    light.speed = 12 + Math.random() * 10;
    light.waiting = false;
    light.grace = 0.8 + Math.random();
    turn(light);
    light.trail = [{ x: light.x, y: light.y }];
    light.life = 28 + Math.random() * 28;
    light.element.setAttribute('d', updateGridTrail(light.trail, light.x, light.y));
    light.element.style.opacity = '0';
  }
  resize();
  lights.forEach(spawn);
  const observer = new ResizeObserver(resize);
  observer.observe(header);
  let frame = 0, last = 0;
  function tick(now) {
    frame = requestAnimationFrame(tick);
    if (now - last < 32) return; // Cap decorative work at about 30 frames/second.
    const dt = Math.min((now - (last || now)) / 1000, 0.06);
    last = now;
    for (const light of lights) {
      if (light.waiting) continue;
      light.life -= dt;
      if (light.life <= 0) { spawn(light); continue; }
      light.grace = Math.max(0, light.grace - dt);
      let remaining = light.speed * dt;
      while (remaining > 0) {
        const dx = light.target.x - light.x, dy = light.target.y - light.y;
        const distance = Math.hypot(dx, dy);
        if (distance <= remaining) {
          light.x = light.target.x; light.y = light.target.y;
          remaining -= distance;
          updateGridTrail(light.trail, light.x, light.y);
          light.previous = light.node; light.node = light.target;
          turn(light);
        } else {
          light.x += dx / distance * remaining; light.y += dy / distance * remaining;
          remaining = 0;
        }
      }
      light.element.setAttribute('d', updateGridTrail(light.trail, light.x, light.y));
      light.element.style.opacity = String(Math.min(0.5, 1.8 - light.grace));
    }
    // Spatial buckets keep collision checks small for the bounded line travellers.
    const buckets = new Map();
    for (const light of lights) {
      if (light.waiting || light.grace > 0) continue;
      const bx = Math.floor(light.x / 5), by = Math.floor(light.y / 5);
      let partner;
      for (let x = bx - 1; x <= bx + 1 && !partner; x++) {
        for (let y = by - 1; y <= by + 1 && !partner; y++) {
          partner = (buckets.get(`${x},${y}`) || []).find(other => !other.waiting && Math.hypot(light.x - other.x, light.y - other.y) < 3.5);
        }
      }
      if (partner) {
        svg.dataset.connections = String(Number(svg.dataset.connections) + 1);
        light.waiting = partner.waiting = true;
        light.element.style.opacity = partner.element.style.opacity = '0';
        const element = shape('grid-connection-pulse');
        element.setAttribute('cx', (light.x + partner.x) / 2);
        element.setAttribute('cy', (light.y + partner.y) / 2);
        pulses.push({ element, age: 0, pair: [light, partner] });
      } else {
        const key = `${bx},${by}`;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(light);
      }
    }
    for (let i = pulses.length - 1; i >= 0; i--) {
      const pulse = pulses[i];
      pulse.age += dt;
      pulse.element.setAttribute('r', String(1.6 + Math.sin(Math.PI * pulse.age) * 1.1));
      pulse.element.style.opacity = String(Math.max(0, 0.25 * (1 - pulse.age * pulse.age)));
      if (pulse.age >= 1) {
        pulse.element.remove();
        pulse.pair.forEach(spawn);
        svg.dataset.connectionRestarts = String(Number(svg.dataset.connectionRestarts) + 2);
        pulses.splice(i, 1);
      }
    }
  }
  function sync() {
    cancelAnimationFrame(frame);
    last = 0;
    layer.hidden = motion.matches;
    if (!document.hidden && !motion.matches) frame = requestAnimationFrame(tick);
  }
  document.addEventListener('visibilitychange', sync);
  motion.addEventListener('change', sync);
  sync();
}
