import assert from 'node:assert/strict';
import test from 'node:test';
import { planDuplicateNameRepairs } from './src/story/story-save-folders.js';

test('older names and higher visible rows win; later duplicates get free numbered names', () => {
  const items = [
    { id: 'above', name: '원고', createdAt: 10 },
    { id: 'below', name: '원고', createdAt: 10 },
    { id: 'reserved', name: '원고 (2)', createdAt: 11 },
    { id: 'later', name: '원고', createdAt: 12 }
  ];
  const repairs = planDuplicateNameRepairs(items, 80);
  assert.deepEqual(repairs.map(({ item, after }) => [item.id, after]), [
    ['below', '원고 (3)'], ['later', '원고 (4)']
  ]);
  assert.equal(planDuplicateNameRepairs(items.map(item =>
    repairs.find(repair => repair.item.id === item.id)?.item || item), 80).length, 0);
});

test('collection names compare without case and keep the older item', () => {
  const repairs = planDuplicateNameRepairs([
    { id: 'newer', name: 'A', createdAt: 2 },
    { id: 'older', name: 'a', createdAt: 1 }
  ], 40, true);
  assert.deepEqual(repairs.map(({ item, after }) => [item.id, after]), [['newer', 'A (2)']]);
});
