import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createStoryBlockClipboardPayload,
  materializeStoryBlockClipboardPayload,
  parseStoryBlockClipboardPayload
} from '../src/story/story-block-clipboard.js';

test('선택한 원고 블록과 보조 값을 현재 원고 순서대로 복사한다', () => {
  const items = [
    { id: 'a', type: 'text', text: '첫째' },
    { id: 'b', type: 'con', conId: 'con:1', conRef: { sourceNo: '10', name: '콘' } },
    { id: 'c', type: 'text', text: '셋째' }
  ];
  const payload = createStoryBlockClipboardPayload(items, new Set(['c', 'a']), id => ({
    rich: { text: id, html: `<b>${id}</b>` }, breakCount: id === 'c' ? 3 : undefined, height: 120
  }));
  assert.deepEqual(payload.blocks.map(block => block.item.text), ['첫째', '셋째']);
  assert.equal(payload.blocks[1].metadata.breakCount, 3);
  assert.equal(payload.blocks[0].metadata.height, 120);
});

test('외부 클립보드 값은 지원하는 블록과 메타데이터만 정규화한다', () => {
  const payload = parseStoryBlockClipboardPayload(JSON.stringify({
    format: 'hhjcon-story-blocks', version: 1,
    blocks: [
      { item: { type: 'con', conId: 7, conRef: { sourceNo: 8, name: '테스트', extra: '제거' } }, metadata: { big: true } },
      { item: { type: 'text', text: '대사', extra: true }, metadata: { imageMemo: '메모', height: 9999 } },
      { item: { type: 'unknown' } }
    ]
  }));
  assert.equal(payload.blocks.length, 2);
  assert.deepEqual(payload.blocks[0].item, {
    type: 'con', conId: '7', conRef: { sourceNo: '8', packageId: '', sourcePackageId: '', name: '테스트', packageName: '' }
  });
  assert.equal(payload.blocks[1].metadata.height, 4000);
  assert.equal(payload.blocks[1].metadata.imageMemo, '메모');
});

test('붙여넣기는 매번 새 블록 ID를 만들고 원본 payload를 변경하지 않는다', () => {
  const payload = createStoryBlockClipboardPayload(
    [{ id: 'a', type: 'text', text: '복제' }], ['a'], () => ({ breakCount: 2 })
  );
  const original = structuredClone(payload);
  let sequence = 0;
  const result = materializeStoryBlockClipboardPayload(payload, () => `new-${++sequence}`);
  assert.deepEqual(result.items, [{ id: 'new-1', type: 'text', text: '복제' }]);
  assert.deepEqual(result.metadataEntries, [{ storyId: 'new-1', metadata: { breakCount: 2 } }]);
  assert.deepEqual(payload, original);
});
