import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeAfterBreakCount } from '../src/story/story-html.js';

test('콘 뒤 줄바꿈 수는 0 이상의 정수로 정규화한다', () => {
  assert.equal(normalizeAfterBreakCount(0), 0);
  assert.equal(normalizeAfterBreakCount('3'), 3);
  assert.equal(normalizeAfterBreakCount(2.9), 2);
  assert.equal(normalizeAfterBreakCount(-1), 0);
  assert.equal(normalizeAfterBreakCount('invalid'), 0);
});
