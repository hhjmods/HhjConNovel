import test from 'node:test';
import assert from 'node:assert/strict';

import { downloadJson, makeDatedDefaultName, makeTimestampedBackupName, sanitizeDownloadName } from '../src/core/json-download.js';

test('sanitizeDownloadName replaces reserved filename characters', () => {
  assert.equal(sanitizeDownloadName('원고<>이름::백업', 'backup'), '원고_이름_백업');
});

test('sanitizeDownloadName uses the caller fallback and preserves the 80-character limit', () => {
  assert.equal(sanitizeDownloadName('', '에디터 백업'), '에디터 백업');
  assert.equal(sanitizeDownloadName('가'.repeat(81), 'backup'), '가'.repeat(80));
});

test('makeTimestampedBackupName preserves the local timestamp and requested suffix', () => {
  const date = new Date(2026, 8, 9, 7, 5, 3);
  assert.equal(makeTimestampedBackupName('콘문학_백업', '.hhjconstories.json', date), '콘문학_백업_20260909-070503.hhjconstories.json');
});

test('makeDatedDefaultName preserves the readable local date format', () => {
  const date = new Date(2026, 8, 9, 7, 5, 3);
  assert.equal(makeDatedDefaultName('콘문학', date), '콘문학 2026-09-09 0705');
});

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
