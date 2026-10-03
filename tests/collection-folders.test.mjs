import test from 'node:test';
import assert from 'node:assert/strict';

import {
  makeCollectionFolderDocument,
  normalizeCollectionFolderId,
  normalizeCollectionFolders,
  planCollectionFolderPlacement,
  planCollectionFolderSelectionPlacement,
  planCollectionFolderRemoval,
  planCollectionPlacement,
  planCollectionSelectionPlacement,
  nextCollectionOrder,
  sortCollectionsInFolder,
  validateCollectionFolderName
} from '../src/collections/collection-folders.js';

const folders = [
  { id: 'f1', name: '첫 폴더', createdAt: 1 },
  { id: 'f2', name: '둘째 폴더', createdAt: 2 }
];

const collections = [
  { id: 'a', name: 'A', folderId: '', sortOrder: 0, createdAt: 1 },
  { id: 'b', name: 'B', folderId: '', sortOrder: 1, createdAt: 2 },
  { id: 'c', name: 'C', folderId: 'f1', sortOrder: 0, createdAt: 3 }
];

test('collection folders normalize invalid legacy data without moving valid folders', () => {
  assert.deepEqual(normalizeCollectionFolders({ items: [folders[0], folders[0], { id: '', name: '없음' }] }), [folders[0]]);
  assert.equal(normalizeCollectionFolderId('missing', folders), '');
  assert.equal(normalizeCollectionFolderId('f1', folders), 'f1');
  assert.throws(() => validateCollectionFolderName('첫 폴더', folders), /이미 있습니다/);
});

test('collection placement moves and reorders one collection without mutating input', () => {
  const moved = planCollectionPlacement(collections, folders, 'b', 'f1');
  assert.deepEqual(moved.map(item => [item.id, item.folderId, item.sortOrder]), [
    ['c', 'f1', 0], ['b', 'f1', 1]
  ]);
  const reordered = planCollectionPlacement(collections, folders, 'b', '', 'a');
  assert.deepEqual(reordered.map(item => item.id), ['b', 'a']);
  assert.equal(collections[1].folderId, '');
});

test('collection folder placement changes only folder order', () => {
  assert.deepEqual(planCollectionFolderPlacement(folders, 'f2', 'f1').map(folder => folder.id), ['f2', 'f1']);
  assert.deepEqual(planCollectionFolderPlacement(folders, 'f1', 'f2'), []);
});

test('folder removal either moves contained collections to root or deletes them', () => {
  const kept = planCollectionFolderRemoval(folders, collections, 'f1', false);
  assert.deepEqual(kept.updates.map(item => [item.id, item.folderId]), [['c', ''], ['a', ''], ['b', '']]);
  assert.deepEqual(kept.deleteIds, []);
  assert.deepEqual(kept.document.items.map(folder => folder.id), ['f2']);

  const removed = planCollectionFolderRemoval(folders, collections, 'f1', true);
  assert.deepEqual(removed.updates, []);
  assert.deepEqual(removed.deleteIds, ['c']);
});

test('collection folder document and sorting preserve the stored order', () => {
  assert.equal(makeCollectionFolderDocument(folders).id, 'collection-folders-v1');
  assert.deepEqual(sortCollectionsInFolder(collections, folders, '').map(item => item.id), ['a', 'b']);
});

test('new collections precede legacy collections without changing a manually ordered folder', () => {
  const legacy = [{ id: 'old', createdAt: 1 }, { id: 'new', createdAt: 2 }];
  assert.deepEqual(sortCollectionsInFolder(legacy, [], '').map(item => item.id), ['new', 'old']);
  assert.equal(nextCollectionOrder(legacy, [], ''), undefined);
  assert.equal(nextCollectionOrder(collections, folders, ''), -1);
  assert.deepEqual(sortCollectionsInFolder([{ id: 'new', sortOrder: -1, createdAt: 4 }, ...collections], folders, '')
    .map(item => item.id), ['new', 'a', 'b']);
});

test('multi-selection placement preserves selected order across folders and within a folder', () => {
  const items = [...collections, { id: 'd', name: 'D', folderId: '', sortOrder: 2, createdAt: 4 }];
  const moved = planCollectionSelectionPlacement(items, folders, ['a', 'b'], 'f1', 'c');
  assert.deepEqual(moved.map(item => [item.id, item.folderId]), [['a', 'f1'], ['b', 'f1'], ['c', 'f1']]);
  const reordered = planCollectionSelectionPlacement(items, folders, ['a', 'b'], '', 'd');
  assert.deepEqual(reordered, []);
  const folderOrder = planCollectionFolderSelectionPlacement([...folders, { id: 'f3', name: '셋째 폴더' }], ['f1', 'f2'], '');
  assert.deepEqual(folderOrder.map(folder => folder.id), ['f3', 'f1', 'f2']);
});

test('folder backup parses nested collections and keeps missing-con metadata', async () => {
  globalThis.document = { getElementById: () => null };
  globalThis.sessionStorage = { getItem: () => null };
  const { parseCollectionBackup } = await import('../src/collections/collection-backup.js');
  const { exportCollection } = await import('../src/model.js');
  const source = { name: '묶음', items: ['missing-con'], refMeta: { 'missing-con': {
    sourceNo: '123', packageName: '원본 묶음', name: '미보유 콘'
  } } };
  const encoded = exportCollection(source, new Map(), new Map());
  const parsed = parseCollectionBackup({ format: 'hhjcon-collections', version: 1, collections: [],
    folders: [{ name: '폴더', collections: [encoded] }] });
  assert.equal(parsed.folders[0].name, '폴더');
  assert.deepEqual(parsed.folders[0].collections[0].items, ['missing-con']);
  assert.equal(parsed.folders[0].collections[0].refMeta['missing-con'].packageName, '원본 묶음');
  assert.throws(() => parseCollectionBackup({ format: 'hhjcon-collections', version: 1, collections: [],
    folders: [{ name: '잘못된 폴더' }] }), /형식/);
});

test('collection backup import numbers duplicate names across root and folders', async () => {
  globalThis.document = { getElementById: () => null };
  globalThis.sessionStorage = { getItem: () => null };
  const { nameImportedCollections } = await import('../src/collections/collection-backup.js');
  const longName = '가'.repeat(40);
  const imported = [
    { name: '묶음', folderId: '' }, { name: '묶음', folderId: 'folder-id' },
    { name: 'FOLDER', folderId: '' }, { name: longName, folderId: '' }
  ];
  const named = nameImportedCollections(imported, ['묶음', '묶음 (2)', 'folder', longName]);
  assert.deepEqual(named.map(item => item.name), ['묶음 (3)', '묶음 (4)', 'FOLDER (2)', `${'가'.repeat(36)} (2)`]);
  assert.equal(named[1].folderId, 'folder-id');
  assert.equal(imported[0].name, '묶음');
});
