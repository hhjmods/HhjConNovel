import test from 'node:test';
import assert from 'node:assert/strict';

import { edgeScrollDelta, nearestRectIndex, pointerIsAfterRect } from '../src/story/story-dnd-geometry.js';

const rects = [
  { left: 0, right: 100, top: 0, bottom: 100 },
  { left: 120, right: 220, top: 0, bottom: 100 },
  { left: 0, right: 220, top: 120, bottom: 220 }
];

test('nearestRectIndex finds the containing or nearest rectangle', () => {
  assert.equal(nearestRectIndex(rects, 180, 50), 1);
  assert.equal(nearestRectIndex(rects, 110, 50), 0);
  assert.equal(nearestRectIndex(rects, 80, 150), 2);
});

test('nearestRectIndex returns -1 when no rectangles exist', () => {
  assert.equal(nearestRectIndex([], 10, 10), -1);
});

test('pointerIsAfterRect follows the visual flow axis', () => {
  const rect = { left: 100, top: 200, width: 80, height: 60 };
  assert.equal(pointerIsAfterRect(rect, 'x', 139, 230), false);
  assert.equal(pointerIsAfterRect(rect, 'x', 140, 230), true);
  assert.equal(pointerIsAfterRect(rect, 'y', 140, 229), false);
  assert.equal(pointerIsAfterRect(rect, 'y', 140, 230), true);
});

test('edgeScrollDelta is idle in the center and outside the scroll lane', () => {
  const rect = { left: 50, right: 250, top: 100, bottom: 500 };
  assert.equal(edgeScrollDelta(150, 300, rect), 0);
  assert.equal(edgeScrollDelta(21, 100, rect), 0);
  assert.equal(edgeScrollDelta(null, null, rect), 0);
});

test('edgeScrollDelta preserves increasing top and bottom edge speed', () => {
  const rect = { left: 50, right: 250, top: 100, bottom: 500 };
  assert.equal(edgeScrollDelta(150, 100, rect), -14);
  assert.equal(edgeScrollDelta(150, 72, rect), -20);
  assert.equal(edgeScrollDelta(150, 500, rect), 14);
  assert.equal(edgeScrollDelta(150, 528, rect), 20);
});
