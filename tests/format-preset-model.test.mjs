import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeFormatPreset, normalizeFormatPresets } from '../src/story/format-preset-model.js';

const fonts = ['Malgun Gothic', 'Arial'];
const sizes = ['12px', '28px'];

test('서식 프리셋은 지원하는 속성만 보존한다', () => {
  assert.deepEqual(normalizeFormatPreset({
    id: 'one', name: ' 강조 ', font: 'Arial', size: '28px', color: '#AABBCC',
    background: 'red', align: 'justifyCenter', bold: true, italic: false, unknown: true
  }, fonts, sizes), { id: 'one', name: '강조', font: 'Arial', size: '28px', color: '#aabbcc', align: 'justifyCenter', bold: true });
  assert.deepEqual(normalizeFormatPreset({ id: 'bad-align', name: '정렬', align: 'center', italic: true }, fonts, sizes), { id: 'bad-align', name: '정렬', italic: true });
  assert.equal(normalizeFormatPreset({ id: 'empty', name: '빈 프리셋' }, fonts, sizes), null);
});

test('잘못되거나 중복된 프리셋은 목록에서 제외한다', () => {
  assert.deepEqual(normalizeFormatPresets([
    { id: 'same', name: '첫째', bold: true },
    { id: 'same', name: '둘째', italic: true },
    { id: '../bad', name: '잘못됨', bold: true },
    null
  ], fonts, sizes), [{ id: 'same', name: '첫째', bold: true }]);
});
