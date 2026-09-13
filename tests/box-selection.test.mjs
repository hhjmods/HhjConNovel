import test from 'node:test';
import assert from 'node:assert/strict';

import { boxSelectionRect, clipBoxSelectionRect, isScrollbarPointer, planBoxSelection } from '../src/core/box-selection.js';

test('plain box selection replaces the previous selection', () => {
  assert.deepEqual(planBoxSelection(['a', 'b'], ['c', 'd']), ['c', 'd']);
});

test('toggle box selection adds unselected ids and removes selected ids', () => {
  assert.deepEqual(planBoxSelection(['a', 'b'], ['b', 'c'], true), ['a', 'c']);
});

test('box selection planning does not mutate its inputs', () => {
  const base = ['a', 'b'];
  const hits = ['b', 'c'];
  planBoxSelection(base, hits, true);
  assert.deepEqual(base, ['a', 'b']);
  assert.deepEqual(hits, ['b', 'c']);
});

test('scrollbar pointers are not treated as blank-space selection', () => {
  const container = {
    clientLeft: 1,
    clientTop: 1,
    clientWidth: 100,
    clientHeight: 80,
    getBoundingClientRect: () => ({ left: 10, top: 20 })
  };
  assert.equal(isScrollbarPointer(container, 110, 100), false);
  assert.equal(isScrollbarPointer(container, 111, 50), true);
  assert.equal(isScrollbarPointer(container, 50, 101), true);
});

test('box selection start follows content while the container scrolls', () => {
  assert.deepEqual(boxSelectionRect(100, 200, 240, 320, 0, 80), {
    left: 100,
    top: 120,
    right: 240,
    bottom: 320
  });
});

test('box selection display is clipped to the visible container', () => {
  assert.deepEqual(
    clipBoxSelectionRect(
      { left: 80, top: 40, right: 260, bottom: 360 },
      { left: 100, top: 100, right: 220, bottom: 300 }
    ),
    { left: 100, top: 100, right: 220, bottom: 300 }
  );
});
