import assert from 'node:assert/strict';
import test from 'node:test';
import { placeFeatureTooltip } from '../src/ui/feature-tooltip-position.js';

test('below and centered when there is room', () => {
  assert.deepEqual(placeFeatureTooltip(
    { left: 100, width: 80, top: 40, bottom: 70 },
    { width: 120, height: 40 },
    { width: 400, height: 300 }
  ), { left: 80, top: 78 });
});

test('flips above near the bottom', () => {
  assert.deepEqual(placeFeatureTooltip(
    { left: 100, width: 80, top: 250, bottom: 280 },
    { width: 120, height: 40 },
    { width: 400, height: 300 }
  ), { left: 80, top: 202 });
});

test('clamps both horizontal edges', () => {
  const size = { width: 120, height: 40 };
  const viewport = { width: 200, height: 300 };
  assert.equal(placeFeatureTooltip({ left: 0, width: 20, top: 40, bottom: 60 }, size, viewport).left, 8);
  assert.equal(placeFeatureTooltip({ left: 190, width: 20, top: 40, bottom: 60 }, size, viewport).left, 72);
});

test('keeps tooltip visible when neither side has full space', () => {
  const result = placeFeatureTooltip(
    { left: 40, width: 20, top: 30, bottom: 50 },
    { width: 100, height: 90 },
    { width: 200, height: 120 }
  );
  assert.deepEqual(result, { left: 8, top: 22 });
});
