import test from 'node:test';
import assert from 'node:assert/strict';

import { clamp, hexToHsv, hsvToHex, normalizeHex } from '../src/story/color-utils.js';

test('clamp keeps values within the requested range', () => {
  assert.equal(clamp(-1), 0);
  assert.equal(clamp(0.4), 0.4);
  assert.equal(clamp(2), 1);
  assert.equal(clamp(400, 0, 360), 360);
});

test('normalizeHex accepts long and short hex colors', () => {
  assert.equal(normalizeHex(' #Aa00Ff '), '#aa00ff');
  assert.equal(normalizeHex('#AbC'), '#aabbcc');
  assert.equal(normalizeHex('red'), '');
});

test('hexToHsv converts primary colors and falls back safely', () => {
  assert.deepEqual(hexToHsv('#ff0000'), { h: 0, s: 1, v: 1 });
  assert.deepEqual(hexToHsv('#00ff00'), { h: 120, s: 1, v: 1 });
  assert.deepEqual(hexToHsv('#0000ff'), { h: 240, s: 1, v: 1 });
  assert.deepEqual(hexToHsv('invalid'), { h: 0, s: 0, v: 0 });
});

test('hsvToHex preserves the hue slider endpoints and round trips colors', () => {
  assert.equal(hsvToHex(0, 1, 1), '#ff0000');
  assert.equal(hsvToHex(360, 1, 1), '#ff0000');
  for (const color of ['#336699', '#ffffff', '#000000', '#aabbcc']) {
    const { h, s, v } = hexToHsv(color);
    assert.equal(hsvToHex(h, s, v), color);
  }
});
