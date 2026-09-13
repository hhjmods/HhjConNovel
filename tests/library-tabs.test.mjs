import test from 'node:test';
import assert from 'node:assert/strict';

import { closeLibraryView, openLibraryView, reconcileLibraryViews } from '../src/library/library-tabs.js';

const views = [
  { type: 'packages', id: 'a', name: 'A' },
  { type: 'collections', id: 'b', name: 'B' },
  { type: 'packages', id: 'c', name: 'C' }
];

test('opening a view adds or updates one tab without mutating the input', () => {
  const added = openLibraryView(views, 'packages:a', { type: 'collections', id: 7, name: '새 묶음' });
  assert.deepEqual(added.views.at(-1), { type: 'collections', id: '7', name: '새 묶음' });
  assert.equal(added.activeViewKey, 'collections:7');
  const updated = openLibraryView(views, 'packages:a', { type: 'collections', id: 'b', name: '바뀐 이름' });
  assert.equal(updated.views.length, 3);
  assert.equal(updated.views[1].name, '바뀐 이름');
  assert.equal(views[1].name, 'B');
});

test('closing the active tab selects the tab at the same position or the previous tab', () => {
  const middle = closeLibraryView(views, 'collections:b', 'collections:b');
  assert.equal(middle.activeViewKey, 'packages:c');
  assert.equal(middle.nextView.name, 'C');
  const last = closeLibraryView(views, 'packages:c', 'packages:c');
  assert.equal(last.activeViewKey, 'collections:b');
  assert.equal(last.nextView.name, 'B');
});

test('closing an inactive or final tab preserves a consistent active state', () => {
  const inactive = closeLibraryView(views, 'packages:a', 'collections:b');
  assert.equal(inactive.activeViewKey, 'packages:a');
  assert.equal(inactive.nextView, null);
  const final = closeLibraryView([views[0]], 'packages:a', 'packages:a');
  assert.deepEqual(final.views, []);
  assert.equal(final.activeViewKey, '');
  assert.equal(final.nextView, null);
});

test('restoring tabs removes unavailable views and repairs the active tab', () => {
  const restored = reconcileLibraryViews(views, 'collections:b', [{ id: 'a' }, { id: 'c' }], []);
  assert.deepEqual(restored.views.map(view => view.id), ['a', 'c']);
  assert.equal(restored.activeViewKey, 'packages:a');
  assert.equal(restored.openedDefault, false);
  assert.equal(views.length, 3);
});

test('the first package opens only when default restoration is requested', () => {
  const packages = [{ id: 9, name: '기본 묶음' }];
  const firstRun = reconcileLibraryViews([], '', packages, [], true);
  assert.deepEqual(firstRun.views, [{ type: 'packages', id: '9', name: '기본 묶음' }]);
  assert.equal(firstRun.activeViewKey, 'packages:9');
  assert.equal(firstRun.openedDefault, true);
  assert.deepEqual(reconcileLibraryViews([], '', packages, [], false).views, []);
});
