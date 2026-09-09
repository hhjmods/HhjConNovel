import test from 'node:test';
import assert from 'node:assert/strict';

import { downloadJson } from '../src/core/json-download.js';

test('downloadJson serializes JSON and cleans up its temporary download resources', async () => {
  const originalDocument = globalThis.document;
  const originalCreateObjectUrl = URL.createObjectURL;
  const originalRevokeObjectUrl = URL.revokeObjectURL;
  const anchor = {
    href: '',
    download: '',
    clicked: false,
    removed: false,
    click() { this.clicked = true; },
    remove() { this.removed = true; }
  };
  let appended = null;
  let blob = null;
  let revoked = '';

  globalThis.document = {
    createElement(tag) {
      assert.equal(tag, 'a');
      return anchor;
    },
    body: {
      append(node) { appended = node; }
    }
  };
  URL.createObjectURL = value => {
    blob = value;
    return 'blob:test-json-download';
  };
  URL.revokeObjectURL = value => { revoked = value; };

  try {
    downloadJson('backup.json', { name: '테스트', count: 2 });

    assert.equal(anchor.href, 'blob:test-json-download');
    assert.equal(anchor.download, 'backup.json');
    assert.equal(appended, anchor);
    assert.equal(anchor.clicked, true);
    assert.equal(anchor.removed, true);
    assert.equal(revoked, 'blob:test-json-download');
    assert.equal(blob.type, 'application/json');
    assert.equal(await blob.text(), '{\n  "name": "테스트",\n  "count": 2\n}');
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
    URL.createObjectURL = originalCreateObjectUrl;
    URL.revokeObjectURL = originalRevokeObjectUrl;
  }
});
