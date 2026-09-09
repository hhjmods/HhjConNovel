import test from 'node:test';
import assert from 'node:assert/strict';

test('reload toast is restored once and new messages can be saved', async () => {
  const originalDocument = globalThis.document;
  const originalSessionStorage = globalThis.sessionStorage;
  const originalSetTimeout = globalThis.setTimeout;
  const timers = [];
  const values = new Map([['hhjcon-reload-toast', '복원 알림']]);
  const classes = new Set();
  const toast = {
    textContent: '',
    classList: { add: value => classes.add(value), remove: value => classes.delete(value) }
  };

  globalThis.document = {
    getElementById: () => toast
  };
  globalThis.sessionStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key)
  };
  globalThis.setTimeout = callback => { timers.push(callback); return timers.length; };

  try {
    const { saveToastForReload } = await import('../src/ui/toast.js?test=reload');
    assert.equal(values.has('hhjcon-reload-toast'), false);
    assert.equal(timers.length, 1);
    timers.shift()();
    assert.equal(toast.textContent, '복원 알림');
    assert.equal(classes.has('show'), true);
    saveToastForReload('다음 알림');
    assert.equal(values.get('hhjcon-reload-toast'), '다음 알림');
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
    if (originalSessionStorage === undefined) delete globalThis.sessionStorage;
    else globalThis.sessionStorage = originalSessionStorage;
    globalThis.setTimeout = originalSetTimeout;
  }
});
