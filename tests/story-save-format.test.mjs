import assert from 'node:assert/strict';
import test from 'node:test';
import { BUNDLE_FORMAT, FORMAT, exportBundle, exportSave, parseImportData } from '../src/story/story-save-format.js';

const sample = () => ({
  name: '테스트 원고',
  story: { items: [
    { id: 'con-row', type: 'con', conId: 'con-1' },
    { id: 'text-row', type: 'text', text: '대사' }
  ] },
  metadata: { rich: { 'text-row': '<b>대사</b>', orphan: '제외' } },
  conRefs: { 'con-1': { sourceNo: '10', name: '콘 이름', packageName: '원본 묶음' } }
});

test('story save export and import preserve blocks, owned metadata, and con references', () => {
  const exported = exportSave(sample());
  assert.equal(exported.format, FORMAT);
  const { saves: [parsed] } = parseImportData(exported);
  assert.deepEqual(parsed.story.items[0].conRef, {
    sourceNo: '10', packageId: '', sourcePackageId: '', name: '콘 이름', packageName: '원본 묶음'
  });
  assert.deepEqual(parsed.metadata.rich, { 'text-row': '<b>대사</b>' });
});

test('story save bundles reuse the single-save format', () => {
  const bundle = exportBundle([sample(), { ...sample(), name: '두 번째' }]);
  assert.equal(bundle.format, BUNDLE_FORMAT);
  assert.deepEqual(parseImportData(bundle).saves.map(save => save.name), ['테스트 원고', '두 번째']);
  assert.deepEqual(parseImportData(bundle).folders, []);
});

test('story folder backups keep the folder name, save order, and empty folders', () => {
  const bundle = exportBundle([{ ...sample(), name: '첫 번째' }, { ...sample(), name: '두 번째' }], '자료');
  assert.equal(bundle.folderName, '자료');
  assert.deepEqual(parseImportData(bundle).folders[0].saves.map(save => save.name), ['첫 번째', '두 번째']);
  assert.deepEqual(parseImportData(exportBundle([], '빈 폴더')).folders, [{ name: '빈 폴더', saves: [] }]);
  assert.throws(() => parseImportData(exportBundle([])), /지원하지 않는 콘문학 백업/);
  assert.throws(() => parseImportData({ ...bundle, folderName: ' ' }), /지원하지 않는 콘문학 백업/);
});

test('mixed story backups keep root saves and multiple folders without flattening', () => {
  const mixed = exportBundle([sample()], '', [
    { name: '자료', saves: [{ ...sample(), name: '폴더 원고' }] },
    { name: '빈 폴더', saves: [] }
  ]);
  const parsed = parseImportData(mixed);
  assert.deepEqual(parsed.saves.map(save => save.name), ['테스트 원고']);
  assert.deepEqual(parsed.folders.map(folder => [folder.name, folder.saves.map(save => save.name)]), [
    ['자료', ['폴더 원고']], ['빈 폴더', []]
  ]);
  assert.throws(() => parseImportData({ ...mixed, folders: [{ name: '잘못된 폴더', saves: [{}] }] }), /지원하지 않는 콘문학 원고/);
  assert.throws(() => parseImportData({ ...mixed, folderName: '겹침' }), /지원하지 않는 콘문학 백업/);
});

test('story save import rejects duplicate block ids and other backup types', () => {
  const duplicate = exportSave(sample());
  duplicate.story.items[1].id = duplicate.story.items[0].id;
  assert.throws(() => parseImportData(duplicate), /올바르지 않은 원고 블록/);
  assert.throws(() => parseImportData({ format: 'hhjcon-editor-backup' }), /에디터 백업파일/);
});
