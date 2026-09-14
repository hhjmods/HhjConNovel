import test from 'node:test';
import assert from 'node:assert/strict';

import { STORY_BLOCK_MIME } from '../src/story-dnd-utils.js';
import {
  STORY_CREATE_MIME,
  readStoryCreateText,
  writeStoryCreateTransfer
} from '../src/story/story-create-payload.js';

class FakeDataTransfer {
  constructor() {
    this.data = new Map();
    this.types = [];
    this.effectAllowed = 'none';
  }

  getData(type) { return this.data.get(type) || ''; }
  setData(type, value) {
    this.data.set(type, String(value));
    if (!this.types.includes(type)) this.types.push(type);
  }
}

test('story creation payload preserves empty dialogue and sentinel text', () => {
  for (const text of ['', '\uE000HHJCON_BREAK\uE001', '\uE000HHJCON_IMAGE\uE001']) {
    const transfer = new FakeDataTransfer();
    assert.equal(writeStoryCreateTransfer(transfer, text), true);
    assert.equal(transfer.effectAllowed, 'copy');
    assert.equal(transfer.getData(STORY_BLOCK_MIME), '1');
    assert.equal(readStoryCreateText(transfer), text);
  }
});

test('story creation payload rejects absent or malformed transfer data', () => {
  const transfer = new FakeDataTransfer();
  transfer.setData(STORY_CREATE_MIME, '{broken');
  assert.equal(readStoryCreateText(transfer), null);
  assert.equal(readStoryCreateText(null), null);
  assert.equal(writeStoryCreateTransfer(null, ''), false);
});
