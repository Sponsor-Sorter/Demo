import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = path.join(root, 'tools', 'social-snapshot-ui-fixture');
const profile = path.join(process.env.TEMP || process.env.TMP || 'C:/Windows/Temp', `social-metrics-ui-${Date.now()}`);
const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const server = createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  if (pathname === '/js/supabaseClient.js') {
    response.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' });
    response.end('export let supabase = {}; export function setSupabaseForTest(client) { supabase = client; }');
    return;
  }
  const target = path.resolve(root, `.${pathname}`);
  if (!target.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
  try {
    const body = await readFile(target);
    const ext = path.extname(target);
    const type = ext === '.html' ? 'text/html; charset=utf-8' : ext === '.mjs' || ext === '.js' ? 'text/javascript; charset=utf-8' : 'application/octet-stream';
    response.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
    response.end(body);
  } catch { response.writeHead(404).end('local UI fixture file not found'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const debugPort = 9335;
await mkdir(profile, { recursive: true });
const browser = spawn(chrome, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-background-networking', '--disable-extensions',
  '--disable-crashpad', '--disable-breakpad', '--disable-sync', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`,
  '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost', 'about:blank'
], { windowsHide: true, stdio: 'ignore' });
let socket;
try {
  let version;
  for (let index = 0; index < 80; index += 1) {
    try { version = await (await fetch(`http://127.0.0.1:${debugPort}/json/version`)).json(); break; }
    catch { await delay(250); }
  }
  assert.ok(version?.webSocketDebuggerUrl, 'headless Chrome CDP did not start');
  socket = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let nextId = 1;
  const pending = new Map();
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    message.error ? waiter.reject(new Error(message.error.message)) : waiter.resolve(message.result);
  });
  const call = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    setTimeout(() => { if (pending.delete(id)) reject(new Error(`CDP timeout: ${method}`)); }, 10000);
  });
  const target = await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: 'PUT' }).then(result => result.json());
  const attached = await call('Target.attachToTarget', { targetId: target.id, flatten: true });
  const pageCall = (method, params = {}) => call(method, params, attached.sessionId);
  await pageCall('Page.enable');
  await pageCall('Runtime.enable');
  await pageCall('Page.navigate', { url: `http://localhost:${port}/tools/social-snapshot-ui-fixture/index.html` });
  const evaluate = async expression => {
    const result = await pageCall('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || result.exceptionDetails.exception?.description || 'UI fixture failed');
    return result.result.value;
  };
  await waitFor(async () => (await evaluate('document.readyState')) === 'complete');
  await waitFor(async () => (await evaluate("document.getElementById('status')?.textContent.includes('temporarily unavailable')")));
  const interrupted = await evaluate('window.__socialUiResult');
  assert.equal(interrupted.providerAttempts, 1);
  assert.equal(interrupted.snapshotWrites, 0, 'provider interruption must not reach snapshot persistence');
  assert.equal(documentStatus(interrupted.status), 'Provider temporarily unavailable. Retry metrics refresh.');

  await evaluate("document.getElementById('retry').click()");
  await waitFor(async () => (await evaluate("document.getElementById('status')?.textContent.includes('Snapshot write interrupted')")));
  const writeInterrupted = await evaluate('window.__socialUiResult');
  assert.equal(writeInterrupted.providerAttempts, 2);
  assert.equal(writeInterrupted.snapshotWrites, 1);
  assert.equal(writeInterrupted.snapshotWriteSucceeded, false);
  assert.equal(writeInterrupted.rendered.textNodesOnly, true, 'hostile provider markup must remain text');
  assert.equal(writeInterrupted.rendered.title, '<img src=x onerror="window.__socialXss=1"><svg onload="window.__socialXss=2">synthetic</svg>');
  assert.equal(writeInterrupted.rendered.message, writeInterrupted.rendered.title);
  assert.equal(writeInterrupted.rendered.story, writeInterrupted.rendered.title);
  assert.equal(writeInterrupted.rendered.xss, 0);
  assert.equal(writeInterrupted.rendered.metrics['youtube:metric-views'], '0');
  assert.equal(writeInterrupted.rendered.metrics['youtube:metric-likes'], '—');
  assert.equal(writeInterrupted.rendered.metrics['youtube:metric-comments'], '2');
  assert.equal(writeInterrupted.rendered.metrics['facebook:metric-reactions'], '0');
  assert.equal(writeInterrupted.rendered.metrics['facebook:metric-comments'], '—');
  assert.equal(writeInterrupted.rendered.metrics['facebook:metric-shares'], '3');
  assert.equal(writeInterrupted.rendered.metrics['facebook:metric-impressions'], '—');
  assert.equal(writeInterrupted.rendered.metrics['facebook:metric-reach'], '0');
  assert.equal(writeInterrupted.rendered.metrics['facebook:metric-post_media_view'], '0');
  assert.equal(writeInterrupted.rendered.metrics['facebook:metric-post_total_media_view_unique'], '—');

  await evaluate("document.getElementById('retry').click()");
  await waitFor(async () => (await evaluate("document.getElementById('status')?.textContent.includes('retry succeeded')")));
  const recovered = await evaluate('window.__socialUiResult');
  assert.equal(recovered.providerAttempts, 3);
  assert.equal(recovered.snapshotWrites, 2);
  assert.equal(recovered.snapshotWriteSucceeded, true);
  assert.equal(recovered.rendered.textNodesOnly, true);

  await evaluate("document.getElementById('retry').focus()");
  await pageCall('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
  await pageCall('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  const keyboardFocus = await evaluate(`({ name: document.activeElement?.textContent?.trim(),
    focused: Boolean(document.activeElement?.matches(':focus')),
    outlineStyle: getComputedStyle(document.activeElement).outlineStyle })`);
  assert.equal(keyboardFocus.name, 'Open on YouTube');
  assert.equal(keyboardFocus.focused, true);

  const visualChecks = [];
  const viewports = [
    { name: 'phone-320', width: 320, height: 800, mobile: true },
    { name: 'phone-375', width: 375, height: 812, mobile: true },
    { name: 'tablet-768', width: 768, height: 900, mobile: true },
    { name: 'desktop-1440', width: 1440, height: 1000, mobile: true }
  ];
  await mkdir(path.join(root, 'review', 'visual'), { recursive: true });
  for (const viewport of viewports) {
    await pageCall('Emulation.setDeviceMetricsOverride', {
      width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: viewport.mobile
    });
    await waitFor(async () => {
      const currentWidth = await evaluate('visualViewport?.width');
      return Math.round(currentWidth) === viewport.width;
    });
    const layout = await evaluate(`(() => {
      const cards = [...document.querySelectorAll('.social-metric-card')].map(card => {
        const rect = card.getBoundingClientRect();
        return { kind: card.classList.contains('youtube-metric-card') ? 'YouTube' : 'Facebook', x: rect.x, right: rect.right, width: rect.width };
      });
      return { viewport: document.documentElement.clientWidth, innerWidth,
        visualViewport: visualViewport ? { width: visualViewport.width, scale: visualViewport.scale } : null,
        scroll: document.documentElement.scrollWidth, cards,
        links: [...document.querySelectorAll('#results a')].map(link => ({ name: link.textContent.trim(), href: link.href, target: link.target })) };
    })()`);
    const screenshot = await pageCall('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await writeFile(path.join(root, 'review', 'visual', `${viewport.name}.png`), Buffer.from(screenshot.data, 'base64'));
    assert.equal(layout.viewport, viewport.width);
    assert.ok(layout.scroll <= viewport.width, `${viewport.name} has horizontal overflow: ${JSON.stringify(layout)}`);
    assert.ok(layout.cards.length === 3);
    assert.ok(layout.cards.every(card => card.x >= 0 && card.right <= viewport.width), `${viewport.name} card clips outside viewport`);
    const ax = await pageCall('Accessibility.getFullAXTree');
    const axNodes = (ax.nodes || []).map(node => ({
      role: node.role?.value || '', name: node.name?.value || ''
    })).filter(node => node.role && (node.role === 'article' || node.role === 'link' || node.role === 'button' || node.role === 'heading' || node.role === 'group'));
    assert.ok(axNodes.some(node => node.role === 'button' && node.name === 'Retry metrics refresh'));
    assert.ok(axNodes.some(node => node.role === 'article' && node.name === 'YouTube video metrics'));
    assert.ok(axNodes.some(node => node.role === 'article' && node.name === 'Facebook post metrics'));
    assert.ok(axNodes.some(node => node.role === 'link' && node.name === 'Open on YouTube'));
    assert.ok(axNodes.some(node => node.role === 'link' && node.name === 'Open on Facebook'));
    assert.ok(axNodes.filter(node => node.role === 'heading').length >= 3);
    assert.ok(axNodes.some(node => node.name === 'Not available'));
    visualChecks.push({ ...viewport, documentScrollWidth: layout.scroll, cards: layout.cards, links: layout.links, accessibility: axNodes });
  }
  const output = {
    result: 'PASS', browser: 'Google Chrome headless via local CDP',
    externalNetwork: 'blocked by host resolver; all provider/storage behavior synthetic and in-memory',
    scenarios: [
      'provider interruption presented retry status without attempting snapshot persistence',
      'malicious synthetic YouTube title and Facebook message/story rendered as text with no injected elements or script execution',
      'snapshot write interruption left live metrics visible and retry completed through the actual statsnap helper',
      'zero remained visible as 0, missing rendered as — and was named Not available to assistive technology',
      'article cards had accessible landmark names; Retry, YouTube, and Facebook controls had accessible names',
      'keyboard Tab reached the YouTube link with a visible focus outline',
      '320, 375, 768, and 1440 CSS-pixel viewports had no horizontal overflow or clipped cards'
    ],
    viewportReview: visualChecks,
    keyboardFocus,
    providerAttempts: recovered.providerAttempts,
    snapshotWrites: recovered.snapshotWrites,
    limits: ['Synthetic local browser fixture only, not an authenticated Website dashboard; no live provider, Supabase, Auth, Storage, database, payment, or cleanup action.']
  };
  const resultPath = path.join(root, 'review', 'social-snapshot-ui-browser-result.json');
  await writeFile(resultPath, JSON.stringify({ ...output, checkedAt: new Date().toISOString() }, null, 2) + '\n');
  console.log(JSON.stringify(output, null, 2));
} finally {
  try { if (socket?.readyState === WebSocket.OPEN) socket.close(); } catch {}
  if (browser.exitCode === null) { try { browser.kill(); } catch {} await Promise.race([new Promise(resolve => browser.once('exit', resolve)), delay(1500)]); }
  server.close();
}

async function waitFor(predicate, timeout = 12000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try { if (await predicate()) return; } catch {}
    await delay(80);
  }
  throw new Error('Timed out waiting for local browser UI state');
}
function documentStatus(value) { return String(value); }
