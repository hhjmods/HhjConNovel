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
  const [parsed] = parseImportData(exported);
  assert.deepEqual(parsed.story.items[0].conRef, {
    sourceNo: '10', packageId: '', sourcePackageId: '', name: '콘 이름', packageName: '원본 묶음'
  });
  assert.deepEqual(parsed.metadata.rich, { 'text-row': '<b>대사</b>' });
});

test('story save bundles reuse the single-save format', () => {
  const bundle = exportBundle([sample(), { ...sample(), name: '두 번째' }]);
  assert.equal(bundle.format, BUNDLE_FORMAT);
  assert.deepEqual(parseImportData(bundle).map(save => save.name), ['테스트 원고', '두 번째']);
});

test('story save import rejects duplicate block ids and other backup types', () => {
  const duplicate = exportSave(sample());
  duplicate.story.items[1].id = duplicate.story.items[0].id;
  assert.throws(() => parseImportData(duplicate), /올바르지 않은 원고 블록/);
  assert.throws(() => parseImportData({ format: 'hhjcon-editor-backup' }), /에디터 백업파일/);
});
