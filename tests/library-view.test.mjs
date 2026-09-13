import test from 'node:test';
import assert from 'node:assert/strict';

import { selectVisibleCons } from '../src/library/library-view.js';

const base = {
  packages: [{ id: 'p1' }, { id: 'p2' }],
  cons: [
    { id: 'c2', name: '둘', packageId: 'p1', order: 2 },
    { id: 'c1', name: '하나', packageId: 'p1', order: 1 },
    { id: 'c3', name: '셋', packageId: 'p2', order: 1 }
  ],
  collections: [{ id: 'mine', items: ['c2', 'missing', 'c1'] }],
  activeTab: 'packages',
  activePackageId: 'p1',
  activeCollectionId: 'mine',
  search: ''
};

test('package view filters and orders cons without mutating stored order', () => {
  assert.deepEqual(selectVisibleCons(base).map(con => con.id), ['c1', 'c2']);
  assert.deepEqual(base.cons.map(con => con.id), ['c2', 'c1', 'c3']);
});

test('collection view preserves saved order and creates missing placeholders', () => {
  const result = selectVisibleCons({ ...base, activeTab: 'collections' });
  assert.deepEqual(result.map(con => con.id), ['c2', 'missing', 'c1']);
  assert.deepEqual(result[1], {
    id: 'missing', name: '미보유/미동기화 콘', packageId: '', thumbnailUrl: '', missing: true
  });
});

test('search filters by visible con name without matching internal ids', () => {
  assert.deepEqual(selectVisibleCons({ ...base, search: '하나' }).map(con => con.id), ['c1']);
  const numeric = {
    ...base,
    cons: [
      { id: 'dccon:hidden-11-token', name: '3', packageId: 'p1', order: 1 },
      { id: 'dccon:other-token', name: '11', packageId: 'p1', order: 2 }
    ],
    search: '11'
  };
  assert.deepEqual(selectVisibleCons(numeric).map(con => con.name), ['11']);
});
