import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { nextVersionUrl } from '../src/ui/update-check.js';

test('새 버전은 기존 주소와 해시를 보존한 캐시 무효화 주소를 만든다', () => {
  assert.equal(
    nextVersionUrl('https://example.com/editor/?tab=1#story', '1.0.0', '1.0.1'),
    'https://example.com/editor/?tab=1&hhjcon-version=1.0.1#story'
  );
});

test('같은 버전이나 이미 시도한 버전은 다시 새로고침하지 않는다', () => {
  assert.equal(nextVersionUrl('https://example.com/', '1.0.0', '1.0.0'), '');
  assert.equal(nextVersionUrl('https://example.com/?hhjcon-version=1.0.1', '1.0.0', '1.0.1'), '');
  assert.equal(nextVersionUrl('https://example.com/', '1.0.0', '<script>'), '');
});

test('index와 version.json의 현재 버전이 일치한다', () => {
  const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const manifest = JSON.parse(fs.readFileSync(new URL('../version.json', import.meta.url), 'utf8'));
  assert.ok(index.includes(`<meta name="hhjcon-app-version" content="${manifest.version}">`));
});
