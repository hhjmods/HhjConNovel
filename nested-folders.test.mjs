import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStoryFolders, planStoryFolderPlacement, planStoryFolderRemoval } from './src/story/story-save-folders.js';
import { normalizeCollectionFolders, planCollectionFolderPlacement, planCollectionFolderRemoval } from './src/collections/collection-folders.js';
import { exportBundle, parseImportData } from './src/story/story-save-format.js';

for (const [label, normalize, move, remove] of [
  ['원고', normalizeStoryFolders, (folders, id, parentId) => planStoryFolderPlacement(folders, [id], '', parentId), planStoryFolderRemoval],
  ['콘묶음', normalizeCollectionFolders, (folders, id, parentId) => planCollectionFolderPlacement(folders, id, '', parentId), planCollectionFolderRemoval]
]) {
  test(`${label} 폴더는 두 단계까지만 만들고 이동한다`, () => {
    const folders = [{ id: 'a', name: '연재' }, { id: 'b', name: '보관' }, { id: 'e', name: '업로드' },
      { id: 'c', name: '미업로드', parentId: 'a' }, { id: 'd', name: '미업로드', parentId: 'b' }];
    assert.deepEqual(normalize({ items: [...folders, { id: 'bad', name: '3단', parentId: 'c' }] })
      .find(folder => folder.id === 'bad'), { id: 'bad', name: '3단', createdAt: 0 });
    assert.equal(move(folders, 'c', '').find(folder => folder.id === 'c').parentId, undefined);
    assert.equal(move(folders, 'e', 'a').find(folder => folder.id === 'e').parentId, 'a');
    assert.throws(() => move(folders, 'b', 'a'), /한 단계/);
    assert.throws(() => move(folders, 'c', 'b'), /같은 이름/);
    assert.throws(() => move(folders, 'a', 'c'), /한 단계/);
  });

  test(`${label} 상위 폴더 삭제 시 하위 폴더의 내용은 보존하거나 함께 삭제한다`, () => {
    const folders = [{ id: 'a', name: '연재' }, { id: 'b', name: '미업로드', parentId: 'a' }, { id: 'c', name: '미업로드' }];
    const items = [{ id: 'one', folderId: 'a' }, { id: 'two', folderId: 'b' }];
    const keep = remove(folders, items, 'a', false);
    assert.deepEqual(keep.document.items.map(folder => [folder.id, folder.name, folder.parentId || '']),
      [['b', '미업로드 (2)', ''], ['c', '미업로드', '']]);
    assert.deepEqual(keep.updates.map(item => item.id), ['one']);
    const deleted = remove(folders, items, 'a', true);
    assert.deepEqual(deleted.document.items.map(folder => folder.id), ['c']);
    assert.deepEqual(deleted.deleteIds, ['one', 'two']);
    const childOnly = remove(folders, items, 'b', false);
    assert.deepEqual(childOnly.updates.map(item => [item.id, item.folderId]), [['two', 'a'], ['one', 'a']]);
  });
}

test('원고 백업의 하위 폴더를 왕복하고 3단 백업을 거부한다', () => {
  const empty = { id: 's', name: '원고', story: { items: [{ id: 't', type: 'text', text: '본문' }] } };
  const bundle = exportBundle([], '', [{ name: '연재', saves: [], folders: [{ name: '미업로드', saves: [empty] }] }]);
  assert.equal(bundle.version, 2);
  const parsed = parseImportData(bundle);
  assert.equal(parsed.folders[0].folders[0].saves[0].name, '원고');
  bundle.folders[0].folders[0].folders = [{ name: '3단', saves: [] }];
  assert.throws(() => parseImportData(bundle), /두 단계/);
});

test('콘묶음 백업의 하위 폴더를 읽고 3단 백업을 거부한다', async () => {
  globalThis.document = { getElementById: () => null };
  globalThis.sessionStorage = { getItem: () => null };
  const { parseCollectionBackup } = await import('./src/collections/collection-backup.js');
  const { exportCollection } = await import('./src/model.js');
  const collection = exportCollection({ name: '캐릭터', items: [] }, new Map(), new Map());
  const bundle = { format: 'hhjcon-collections', version: 2, collections: [],
    folders: [{ name: '활협전', collections: [], folders: [{ name: '진영', collections: [collection] }] }] };
  assert.equal(parseCollectionBackup(bundle).folders[0].folders[0].collections[0].name, '캐릭터');
  bundle.folders[0].folders[0].folders = [{ name: '3단', collections: [] }];
  assert.throws(() => parseCollectionBackup(bundle), /두 단계/);
});
