import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeStoryFolderId,
  normalizeStoryFolders,
  nextStorySaveOrder,
  planStoryFolderPlacement,
  planStoryFolderRemoval,
  planStoryFolderSelectionRemoval,
  planStorySavePlacement,
  sortStorySavesInFolder,
  validateStoryFolderName
} from '../src/story/story-save-folders.js';

test('원고 폴더 정규화와 기존 최상위 원고 호환', () => {
  const folders = normalizeStoryFolders({ items: [
    { id: 'a', name: ' 자료 ', createdAt: 1 },
    { id: 'a', name: '중복 ID' },
    { id: '', name: '잘못된 폴더' }
  ] });
  assert.deepEqual(folders, [{ id: 'a', name: '자료', createdAt: 1 }]);
  assert.equal(normalizeStoryFolderId('a', folders), 'a');
  assert.equal(normalizeStoryFolderId(undefined, folders), '');
  assert.equal(normalizeStoryFolderId('사라진-폴더', folders), '');
  assert.equal(validateStoryFolderName(' 새 폴더 ', folders), '새 폴더');
  assert.throws(() => validateStoryFolderName('자료', folders), /이미 있습니다/);
});

test('폴더 삭제 선택에 따라 원고를 보존하거나 함께 삭제한다', () => {
  const folders = [{ id: 'folder', name: '자료' }];
  const saves = [{ id: 'save', folderId: 'folder' }, { id: 'other' }];
  const keep = planStoryFolderRemoval(folders, saves, 'folder', false);
  assert.deepEqual(keep.document.items, []);
  assert.deepEqual(keep.updates, [{ id: 'save', folderId: '', sortOrder: 0 }, { id: 'other', folderId: '', sortOrder: 1 }]);
  assert.deepEqual(keep.deleteIds, []);
  const remove = planStoryFolderRemoval(folders, saves, 'folder', true);
  assert.deepEqual(remove.updates, []);
  assert.deepEqual(remove.deleteIds, ['save']);
  assert.equal(saves[0].folderId, 'folder');
  assert.throws(() => planStoryFolderRemoval([], saves, 'folder', true), /찾을 수 없습니다/);
});

test('선택한 폴더와 원고를 함께 삭제하거나 폴더 원고를 보존한다', () => {
  const folders = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }];
  const saves = [
    { id: 'a1', folderId: 'a', sortOrder: 0 }, { id: 'a2', folderId: 'a', sortOrder: 1 },
    { id: 'b1', folderId: 'b' }, { id: 'root1', updatedAt: 2 }, { id: 'root2', updatedAt: 1 }
  ];
  const keep = planStoryFolderSelectionRemoval(folders, saves, ['a', 'c'], ['root2'], false);
  assert.deepEqual(keep.document.items.map(folder => folder.id), ['b']);
  assert.deepEqual(keep.updates.map(save => [save.id, save.folderId, save.sortOrder]), [
    ['a1', '', 0], ['a2', '', 1], ['root1', '', 2]
  ]);
  assert.deepEqual(keep.deleteIds, ['root2']);
  const remove = planStoryFolderSelectionRemoval(folders, saves, ['a', 'c'], ['root2'], true);
  assert.deepEqual(remove.updates, []);
  assert.deepEqual(remove.deleteIds, ['root2', 'a1', 'a2']);
  assert.throws(() => planStoryFolderSelectionRemoval(folders, saves, ['missing'], [], true), /찾을 수 없습니다/);
  assert.throws(() => planStoryFolderSelectionRemoval(folders, saves, ['a'], ['missing'], true), /찾을 수 없습니다/);
});

test('폴더 하나와 체크한 여러 폴더의 순서를 바꾼다', () => {
  const folders = ['a', 'b', 'c', 'd'].map(id => ({ id, name: id }));
  assert.deepEqual(planStoryFolderPlacement(folders, ['a'], 'd').map(folder => folder.id), ['b', 'c', 'a', 'd']);
  assert.deepEqual(planStoryFolderPlacement(folders, ['a', 'b'], '').map(folder => folder.id), ['c', 'd', 'a', 'b']);
  assert.deepEqual(planStoryFolderPlacement(folders, ['a', 'b'], 'b'), []);
  assert.throws(() => planStoryFolderPlacement(folders, ['missing'], 'c'), /찾을 수 없습니다/);
  assert.equal(folders[0].id, 'a');
});

test('저장 원고를 재정렬하고 폴더로 넣거나 최상위로 뺀다', () => {
  const folders = [{ id: 'folder', name: '자료' }];
  const saves = [
    { id: 'a', updatedAt: 30 }, { id: 'b', updatedAt: 20 }, { id: 'c', updatedAt: 10 },
    { id: 'd', folderId: 'folder', updatedAt: 5 }
  ];
  assert.deepEqual(sortStorySavesInFolder(saves, folders, '').map(save => save.id), ['a', 'b', 'c']);
  assert.equal(nextStorySaveOrder(saves, folders, ''), undefined);
  const reorder = planStorySavePlacement(saves, folders, ['a'], '', 'c');
  assert.deepEqual(reorder.map(save => save.id), ['b', 'a', 'c']);
  assert.deepEqual(reorder.map(save => save.sortOrder), [0, 1, 2]);
  assert.deepEqual(planStorySavePlacement(reorder, folders, ['a'], '', 'c'), []);
  assert.deepEqual(planStorySavePlacement(reorder, folders, ['b', 'a'], '', 'a'), []);
  assert.equal(nextStorySaveOrder(reorder, folders, ''), -1);
  const intoFolder = planStorySavePlacement([...reorder, saves[3]], folders, ['a'], 'folder', 'd');
  assert.deepEqual(intoFolder.map(save => save.id), ['a', 'd']);
  const out = planStorySavePlacement([...reorder.filter(save => save.id !== 'a'), ...intoFolder], folders, ['a'], '', 'b');
  assert.deepEqual(out.map(save => save.id), ['a', 'b', 'c']);
  assert.equal(out[0].folderId, '');
  assert.throws(() => planStorySavePlacement(saves, folders, ['a'], 'missing'), /찾을 수 없습니다/);
  assert.equal(saves[0].sortOrder, undefined);
});
