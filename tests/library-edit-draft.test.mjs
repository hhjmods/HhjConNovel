import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createCollectionEditDraft,
  deleteCollectionEditSelection,
  prepareCollectionEditDrag,
  reorderCollectionEditDraft,
  selectCollectionEditDraft
} from '../src/library/library-edit-draft.js';

test('collection edit draft keeps selection, order, and anchor together', () => {
  const original = createCollectionEditDraft('collection-1', ['a', 'b', 'c'], ['b', 'missing']);
  assert.deepEqual(original.items, ['a', 'b', 'c']);
  assert.deepEqual([...original.selectedIds], ['b']);
  assert.equal(original.anchorId, 'b');

  const selected = selectCollectionEditDraft(original, 'c', { toggle: true });
  assert.deepEqual([...selected.selectedIds], ['b', 'c']);
  assert.equal(selected.anchorId, 'c');
  assert.deepEqual([...original.selectedIds], ['b']);
});

test('collection edit drag selects its fallback and preserves visible order', () => {
  const original = createCollectionEditDraft('collection-1', ['a', 'b', 'c'], ['c', 'a']);
  assert.deepEqual(prepareCollectionEditDrag(original, 'c').ids, ['a', 'c']);

  const prepared = prepareCollectionEditDrag(original, 'b');
  assert.deepEqual(prepared.ids, ['b']);
  assert.deepEqual([...prepared.draft.selectedIds], ['b']);
  assert.equal(prepared.draft.anchorId, 'b');
});

test('collection edit reorder and deletion do not mutate the previous draft', () => {
  const original = createCollectionEditDraft('collection-1', ['a', 'b', 'c'], ['b']);
  const reordered = reorderCollectionEditDraft(original, ['b'], null);
  assert.deepEqual(reordered.items, ['a', 'c', 'b']);
  assert.deepEqual(original.items, ['a', 'b', 'c']);
  assert.equal(reorderCollectionEditDraft(reordered, ['b'], 'b'), reordered);

  const removed = deleteCollectionEditSelection(reordered);
  assert.deepEqual(removed.items, ['a', 'c']);
  assert.equal(removed.selectedIds.size, 0);
  assert.equal(removed.anchorId, null);
  assert.deepEqual(reordered.items, ['a', 'c', 'b']);
});
