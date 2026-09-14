import test from 'node:test';
import assert from 'node:assert/strict';

test('drop capture preserves the guide boundary until target handlers finish', async () => {
  const originalDocument = globalThis.document;
  const handlers = new Map();
  const storyList = {
    dataset: {},
    addEventListener() {},
    querySelectorAll: () => [],
    querySelector: () => null,
    classList: { remove() {} }
  };
  globalThis.document = {
    getElementById: () => storyList,
    addEventListener(type, handler) { handlers.set(type, handler); }
  };

  try {
    await import('../src/story-slot-mode.js');
    for (const beforeId of ['4', '2', '']) {
      storyList.dataset.storyDropBeforeId = beforeId;
      handlers.get('drop')();
      // Native dispatch can drain microtasks between capture and target listeners.
      await Promise.resolve();
      assert.equal(storyList.dataset.storyDropBeforeId, beforeId);
      await new Promise(resolve => setTimeout(resolve, 0));
      assert.equal(Object.hasOwn(storyList.dataset, 'storyDropBeforeId'), false);
    }
    storyList.dataset.storyDropBeforeId = '4';
    handlers.get('dragend')();
    assert.equal(Object.hasOwn(storyList.dataset, 'storyDropBeforeId'), false);
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
});
