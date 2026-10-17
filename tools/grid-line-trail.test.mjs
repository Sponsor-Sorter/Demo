import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { updateGridTrail } from '../js/gridLineTrail.mjs';

test('line follows grid corner without diagonal shortcut', () => {
  const points = [];
  updateGridTrail(points, 0, 0);
  updateGridTrail(points, 20, 0);
  assert.equal(updateGridTrail(points, 20, 20), 'M6.00 0.00 L20.00 0.00 L20.00 20.00');
});
test('old trail segments are discarded as line travels', () => {
  const points = [];
  for (let x = 0; x < 10000; x++) updateGridTrail(points, x, 0);
  assert.ok(points.length <= 36);
  assert.equal(points.at(-1).x - points[0].x, 34);
});
test('stationary traveller does not grow trail history', () => {
  const points = [];
  for (let i = 0; i < 100; i++) updateGridTrail(points, 12, 10);
  assert.equal(points.length, 1);
});
test('decoration is bounded, noninteractive and respects reduced motion', async () => {
  const source = await readFile(new URL('../js/connectionHeader.js', import.meta.url), 'utf8');
  assert.match(source, /length: 28/);
  assert.match(source, /shape\('grid-travelling-line', 'path'\)/);
  assert.match(source, /aria-hidden', 'true'/);
  assert.match(source, /if \(!document.hidden && !motion.matches\)/);
  assert.match(source, /pulse.pair.forEach\(spawn\)/);
  assert.doesNotMatch(source, /grid-light|element.setAttribute\('c[xy]', light/);
});
