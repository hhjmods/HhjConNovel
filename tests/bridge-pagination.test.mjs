import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const bridge = readFileSync(new URL('../bridge/hhjcon-dc-bridge.user.js', import.meta.url), 'utf8');

async function syncThroughBridge(lastPage) {
  const origin = 'https://hhjmods.github.io';
  const requestedPages = [];
  let onMessage;
  let resolveResult;
  const result = new Promise(resolve => { resolveResult = resolve; });
  const pageWindow = {
    addEventListener(type, listener) { if (type === 'message') onMessage = listener; },
    postMessage(message) { if (message.type === 'HHJCON_DC_SYNC_RESULT') resolveResult(message); }
  };
  const context = {
    URL, URLSearchParams, console,
    unsafeWindow: pageWindow,
    window: pageWindow,
    location: { hostname: 'hhjmods.github.io', origin },
    document: { documentElement: null },
    GM_xmlhttpRequest(options) {
      if (options.method === 'GET') {
        options.onload({ status: 200, responseText: '<input name="ci_t" value="test-token">' });
        return;
      }
      const page = Number(new URLSearchParams(options.data).get('page'));
      requestedPages.push(page);
      options.onload({
        status: 200,
        responseText: JSON.stringify({
          target: 'icon',
          max_page: lastPage,
          list: page <= lastPage ? [{
            package_idx: page + 1,
            package_name: `묶음 ${page}`,
            detail: [{ title: `콘 ${page}`, list_img: `https://dcimg5.dcinside.com/dccon.php?no=con${page}` }]
          }] : []
        })
      });
    }
  };
  runInNewContext(bridge, context);
  onMessage({
    source: pageWindow,
    origin,
    data: {
      type: 'HHJCON_DC_SYNC_REQUEST',
      requestId: 'test',
      writeUrl: 'https://gall.dcinside.com/mgallery/board/write/?id=legendofmortal'
    }
  });
  return { requestedPages, response: await result };
}

test('한 페이지만 보유한 계정도 0페이지에서 콘을 동기화한다', async () => {
  const { requestedPages, response } = await syncThroughBridge(0);
  assert.deepEqual(requestedPages, [0]);
  assert.equal(response.error, null);
  assert.equal(response.payload.cons.length, 1);
});

test('여러 페이지의 보유 콘을 첫 페이지부터 마지막 페이지까지 읽는다', async () => {
  const { requestedPages, response } = await syncThroughBridge(2);
  assert.deepEqual(requestedPages, [0, 1, 2]);
  assert.equal(response.error, null);
  assert.equal(response.payload.cons.length, 3);
});

test('지원 범위를 넘는 목록은 일부만 저장하지 않고 실패한다', async () => {
  const { requestedPages, response } = await syncThroughBridge(31);
  assert.deepEqual(requestedPages, [0]);
  assert.match(response.error, /페이지를 초과/);
  assert.equal(response.payload, null);
});
