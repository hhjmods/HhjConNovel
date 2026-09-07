import test from 'node:test';
import assert from 'node:assert/strict';

import { planOrderedSelection } from '../src/core/selection.js';

const order = ['a', 'b', 'c', 'd'];

test('plain click selects only the target and makes it the anchor', () => {
  assert.deepEqual(
    planOrderedSelection(order, new Set(['a', 'b']), 'a', 'c'),
    { ids: ['c'], anchorId: 'c' }
  );
});

test('toggle click adds or removes the target without mutating the input selection', () => {
  const selected = new Set(['a', 'b']);
  assert.deepEqual(
    planOrderedSelection(order, selected, 'a', 'c', { toggle: true }),
    { ids: ['a', 'b', 'c'], anchorId: 'c' }
  );
  assert.deepEqual(
    planOrderedSelection(order, selected, 'a', 'b', { toggle: true }),
    { ids: ['a'], anchorId: 'b' }
  );
  assert.deepEqual([...selected], ['a', 'b']);
});

test('range click selects the visible interval and keeps the existing anchor', () => {
  assert.deepEqual(
    planOrderedSelection(order, new Set(['a']), 'b', 'd', { range: true }),
    { ids: ['b', 'c', 'd'], anchorId: 'b' }
  );
  assert.deepEqual(
    planOrderedSelection(order, new Set(['d']), 'd', 'b', { range: true }),
    { ids: ['b', 'c', 'd'], anchorId: 'd' }
  );
});

test('additive range click merges the interval with the current selection', () => {
  assert.deepEqual(
    planOrderedSelection(order, new Set(['a']), 'c', 'd', { toggle: true, range: true }),
    { ids: ['a', 'c', 'd'], anchorId: 'c' }
  );
});

test('range click with an invalid anchor falls back to normal click behavior', () => {
  assert.deepEqual(
    planOrderedSelection(order, new Set(['a']), 'missing', 'c', { range: true }),
    { ids: ['c'], anchorId: 'c' }
  );
});
