import test from 'node:test';
import assert from 'node:assert/strict';

import { wrongBackupTypeMessage } from '../src/core/backup-format.js';

test('wrongBackupTypeMessage identifies known backup types without rejecting the expected type', () => {
  assert.equal(wrongBackupTypeMessage('hhjcon-collection', 'story'), '해당 파일은 콘묶음 백업파일입니다. 콘묶음 불러오기를 이용해주세요.');
  assert.equal(wrongBackupTypeMessage('hhjcon-story-saves', 'editor'), '해당 파일은 원고 백업파일입니다. 원고 백업 불러오기를 이용해주세요.');
  assert.equal(wrongBackupTypeMessage('hhjcon-editor-backup', 'collection'), '해당 파일은 에디터 백업파일입니다. 에디터 백업 불러오기를 이용해주세요.');
  assert.equal(wrongBackupTypeMessage('hhjcon-story-save', 'story'), '');
  assert.equal(wrongBackupTypeMessage('unknown', 'story'), '');
});
