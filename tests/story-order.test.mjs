import test from 'node:test';
import assert from 'node:assert/strict';

import { insertStoryItemsBefore, planStoryItemReorder, planStorySelectionStep } from '../src/story/story-order.js';

function storyItems(ids = ['a', 'b', 'c', 'd']) {
  return ids.map(id => ({ id, type: id === 'c' ? 'text' : 'con' }));
}

test('insertStoryItemsBefore inserts before a target or appends', () => {
  const inserted = [{ id: 'x', type: 'con' }, { id: 'y', type: 'con' }];
  assert.deepEqual(
    insertStoryItemsBefore(storyItems(), inserted, 'c').map(item => item.id),
    ['a', 'b', 'x', 'y', 'c', 'd']
  );
  assert.deepEqual(
    insertStoryItemsBefore(storyItems(), inserted).map(item => item.id),
    ['a', 'b', 'c', 'd', 'x', 'y']
  );
});

test('insertStoryItemsBefore appends when the target is missing', () => {
  assert.deepEqual(
    insertStoryItemsBefore(storyItems(), [{ id: 'x', type: 'con' }], 'missing').map(item => item.id),
    ['a', 'b', 'c', 'd', 'x']
  );
});

test('insertStoryItemsBefore does not mutate the source array', () => {
  const original = storyItems();
  const result = insertStoryItemsBefore(original, [], 'c');
  assert.deepEqual(original.map(item => item.id), ['a', 'b', 'c', 'd']);
  assert.notEqual(result, original);
});

test('planStoryItemReorder moves one item before the target', () => {
  const result = planStoryItemReorder(storyItems(), ['b'], 'd');
  assert.deepEqual(result.items.map(item => item.id), ['a', 'c', 'b', 'd']);
  assert.deepEqual(result.movingItems.map(item => item.id), ['b']);
});

test('planStoryItemReorder preserves current story order for a multi-selection', () => {
  const result = planStoryItemReorder(storyItems(), ['d', 'b'], 'c');
  assert.deepEqual(result.items.map(item => item.id), ['a', 'b', 'd', 'c']);
  assert.deepEqual(result.movingItems.map(item => item.id), ['b', 'd']);
});

test('planStoryItemReorder appends when the target is absent', () => {
  assert.deepEqual(
    planStoryItemReorder(storyItems(), ['b'], null).items.map(item => item.id),
    ['a', 'c', 'd', 'b']
  );
  assert.deepEqual(
    planStoryItemReorder(storyItems(), ['b'], 'missing').items.map(item => item.id),
    ['a', 'c', 'd', 'b']
  );
});

test('planStoryItemReorder returns null when no requested item exists', () => {
  assert.equal(planStoryItemReorder(storyItems(), ['missing'], 'b'), null);
});

test('planStoryItemReorder does not mutate the source array', () => {
  const original = storyItems();
  const snapshot = [...original];
  const result = planStoryItemReorder(original, ['b'], 'd');
  assert.deepEqual(original, snapshot);
  assert.notEqual(result.items, original);
});

test('planStorySelectionStep moves one item one boundary up or down', () => {
  assert.deepEqual(
    planStorySelectionStep(storyItems(), ['c'], -1).items.map(item => item.id),
    ['a', 'c', 'b', 'd']
  );
  assert.deepEqual(
    planStorySelectionStep(storyItems(), ['b'], 1).items.map(item => item.id),
    ['a', 'c', 'b', 'd']
  );
});

test('planStorySelectionStep moves a selection as one ordered group', () => {
  const items = storyItems(['a', 'b', 'c', 'd', 'e']);
  assert.deepEqual(
    planStorySelectionStep(items, ['c', 'b'], -1).items.map(item => item.id),
    ['b', 'c', 'a', 'd', 'e']
  );
  assert.deepEqual(
    planStorySelectionStep(items, ['c', 'b'], 1).items.map(item => item.id),
    ['a', 'd', 'b', 'c', 'e']
  );
});

test('planStorySelectionStep returns null at a boundary or for no movement', () => {
  assert.equal(planStorySelectionStep(storyItems(), ['a'], -1), null);
  assert.equal(planStorySelectionStep(storyItems(), ['d'], 1), null);
  assert.equal(planStorySelectionStep(storyItems(), ['b'], 0), null);
  assert.equal(planStorySelectionStep(storyItems(), ['missing'], 1), null);
});
