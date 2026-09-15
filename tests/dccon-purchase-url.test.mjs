import test from 'node:test';
import assert from 'node:assert/strict';
import { makeDcconPurchaseUrl } from '../src/collections/dccon-purchase-url.js';

test('DCCon purchase URL opens the package search result and detail hash', () => {
  assert.equal(
    makeDcconPurchaseUrl({ packageName: '럽온유 방종콘', sourcePackageId: '175116' }),
    'https://dccon.dcinside.com/new/1/title/%EB%9F%BD%EC%98%A8%EC%9C%A0%20%EB%B0%A9%EC%A2%85%EC%BD%98#175116'
  );
});

test('DCCon purchase URL rejects incomplete or nonnumeric metadata', () => {
  assert.equal(makeDcconPurchaseUrl({ packageName: '묶음' }), '');
  assert.equal(makeDcconPurchaseUrl({ packageName: '묶음', sourcePackageId: 'dc:1' }), '');
});
