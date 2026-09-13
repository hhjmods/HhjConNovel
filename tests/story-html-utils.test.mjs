import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DC_CON_DETAIL_ATTRIBUTE_LENGTH,
  DC_IMAGE_UPLOAD_HTML_LENGTH,
  buildDcConHtml,
  estimateDcHtmlCharCount,
  validDcConSource
} from '../src/story/story-html-utils.js';

test('DC con HTML accepts only the canonical HTTPS image endpoint', () => {
  assert.equal(validDcConSource('https://dcimg5.dcinside.com/dccon.php?no=123'), 'https://dcimg5.dcinside.com/dccon.php?no=123');
  for (const source of [
    'http://dcimg5.dcinside.com/dccon.php?no=123',
    'https://evil.example/dccon.php?no=123',
    'https://dcimg5.dcinside.com/other.php?no=123',
    'https://dcimg5.dcinside.com/dccon.php',
    'blob:https://dcimg5.dcinside.com/123'
  ]) assert.equal(validDcConSource(source), '');
});

test('DC con HTML preserves classes and escapes the visible name', () => {
  const item = { conId: 'fallback' };
  const con = { imageUrl: 'https://dcimg5.dcinside.com/dccon.php?no=123', name: '콘<&"' };
  const html = buildDcConHtml(item, con, true);
  assert.match(html, /class="written_dccon bigdccon"/);
  assert.match(html, /conalt="콘&lt;&amp;&quot;"/);
  assert.match(buildDcConHtml(item, con, false), /class="written_dccon"/);
  assert.match(buildDcConHtml(item, null, false), /미보유\/미동기화 디시콘/);
});

test('DC HTML estimate adds final detail attributes and replaces image markers', () => {
  assert.equal(DC_CON_DETAIL_ATTRIBUTE_LENGTH, 20);
  assert.equal(DC_IMAGE_UPLOAD_HTML_LENGTH, 296);
  assert.equal(estimateDcHtmlCharCount('1234567890', 2, 4, 1), 342);
});
