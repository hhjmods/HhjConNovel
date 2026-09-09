import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CON_IDS_MIME,
  STORY_BLOCK_MIME,
  STORY_IDS_MIME,
  hasStoryAreaPayload,
  readTransferIds,
  storyAreaDropEffect,
  transferHasType,
  writeConTransfer,
  writeStoryTransfer
} from '../src/story-dnd-utils.js';

class FakeDataTransfer {
  constructor() {
    this.data = new Map();
    this.types = [];
    this.effectAllowed = 'none';
  }

  getData(type) {
    return this.data.get(type) || '';
  }

  setData(type, value) {
    this.data.set(type, String(value));
    if (!this.types.includes(type)) this.types.push(type);
  }
}

test('readTransferIds parses valid string ids and rejects malformed payloads', () => {
  const transfer = new FakeDataTransfer();
  transfer.setData(CON_IDS_MIME, JSON.stringify(['a', '', 3, 'b']));
  assert.deepEqual(readTransferIds(transfer, CON_IDS_MIME), ['a', 'b']);

  transfer.setData(CON_IDS_MIME, '{broken');
  assert.deepEqual(readTransferIds(transfer, CON_IDS_MIME), []);
  assert.deepEqual(readTransferIds(null, CON_IDS_MIME), []);
});

test('writeConTransfer preserves the library copyMove contract', () => {
  const transfer = new FakeDataTransfer();
  assert.equal(writeConTransfer(transfer, ['con-1', '', 'con-2']), true);
  assert.equal(transfer.effectAllowed, 'copyMove');
  assert.equal(transfer.getData(CON_IDS_MIME), '["con-1","con-2"]');
  assert.equal(transfer.getData('text/plain'), 'con-1\ncon-2');
});

test('writeStoryTransfer preserves move, block, and optional plain-text contracts', () => {
  const transfer = new FakeDataTransfer();
  assert.equal(writeStoryTransfer(transfer, ['story-1', 'story-2'], { block: true, plainText: true }), true);
  assert.equal(transfer.effectAllowed, 'move');
  assert.equal(transfer.getData(STORY_IDS_MIME), '["story-1","story-2"]');
  assert.equal(transfer.getData(STORY_BLOCK_MIME), '1');
  assert.equal(transfer.getData('text/plain'), 'story-1\nstory-2');
});

test('payload writers reject missing transfers and empty id lists', () => {
  assert.equal(writeConTransfer(null, ['con-1']), false);
  assert.equal(writeConTransfer(new FakeDataTransfer(), []), false);
  assert.equal(writeStoryTransfer(null, ['story-1']), false);
  assert.equal(writeStoryTransfer(new FakeDataTransfer(), [null, '']), false);
});

test('story payload detection and drop effect follow the shared MIME contract', () => {
  const conTransfer = new FakeDataTransfer();
  writeConTransfer(conTransfer, ['con-1']);
  assert.equal(transferHasType(conTransfer, CON_IDS_MIME), true);
  assert.equal(hasStoryAreaPayload(conTransfer), true);
  assert.equal(storyAreaDropEffect(conTransfer), 'copy');

  const storyTransfer = new FakeDataTransfer();
  writeStoryTransfer(storyTransfer, ['story-1']);
  assert.equal(hasStoryAreaPayload(storyTransfer), true);
  assert.equal(storyAreaDropEffect(storyTransfer), 'move');

  const emptyTransfer = new FakeDataTransfer();
  assert.equal(hasStoryAreaPayload(emptyTransfer), false);
  assert.equal(storyAreaDropEffect(emptyTransfer), 'none');
  assert.equal(storyAreaDropEffect(emptyTransfer, true), 'move');
});
