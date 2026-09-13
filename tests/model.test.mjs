import test from 'node:test';
import assert from 'node:assert/strict';

import {
  COLLECTION_FILE_FORMAT,
  COLLECTION_FILE_VERSION,
  COLLECTION_NAME_MAX_LENGTH,
  addUniqueIds,
  applyCollectionItemDraft,
  createCollection,
  exportCollection,
  importCollectionFile,
  makeStableConId,
  normalizeSyncPayload,
  preserveCollectionRefMeta,
  preserveStoryConRefs,
  reorderOrderedIds,
  reorderIds
} from '../src/model.js';

function collection(items = ['a', 'b', 'c', 'd']) {
  return {
    id: 'collection-1',
    name: '테스트',
    items,
    refMeta: {},
    createdAt: 1,
    updatedAt: 1
  };
}

test('makeStableConId uses package id and sourceNo as the stable identity', () => {
  assert.equal(makeStableConId(12, 34), 'dccon:12:34');
});

test('createCollection enforces the collection name length limit', () => {
  assert.equal(createCollection('가'.repeat(COLLECTION_NAME_MAX_LENGTH)).name.length, COLLECTION_NAME_MAX_LENGTH);
  assert.throws(
    () => createCollection('가'.repeat(COLLECTION_NAME_MAX_LENGTH + 1)),
    new RegExp(`최대 ${COLLECTION_NAME_MAX_LENGTH}자`)
  );
});

test('normalizeSyncPayload normalizes ids and derives a stable con id', () => {
  const result = normalizeSyncPayload({
    account: { id: 'user' },
    packages: [{ id: 7, name: '묶음' }],
    cons: [{ packageId: 7, sourceNo: 42, name: '콘' }]
  });

  assert.equal(result.packages[0].id, '7');
  assert.equal(result.packages[0].sourcePackageId, '7');
  assert.equal(result.cons[0].id, 'dccon:7:42');
  assert.equal(result.cons[0].packageId, '7');
  assert.equal(result.cons[0].sourceNo, '42');
  assert.equal(result.cons[0].detailId, '');
  assert.deepEqual(result.account, { id: 'user' });
  assert.ok(Number.isFinite(result.syncedAt));
});

test('normalizeSyncPayload rejects malformed package references', () => {
  assert.throws(
    () => normalizeSyncPayload({ packages: [], cons: [{ packageId: 'missing', sourceNo: '1' }] }),
    /packageId/
  );
  assert.throws(() => normalizeSyncPayload(null), /객체/);
});

test('normalizeSyncPayload preserves explicit ids and normalizes optional legacy fields', () => {
  const result = normalizeSyncPayload({
    packages: [{ id: 'pkg', name: '', sourcePackageId: 99 }],
    cons: [{
      id: 'custom-id',
      packageId: 'pkg',
      sourceNo: 7,
      detailIdx: 123,
      imageUrl: 'full.png',
      order: 9
    }]
  });

  assert.equal(result.packages[0].name, 'DC콘 1');
  assert.equal(result.packages[0].sourcePackageId, '99');
  assert.equal(result.cons[0].id, 'custom-id');
  assert.equal(result.cons[0].detailId, '123');
  assert.equal(result.cons[0].thumbnailUrl, 'full.png');
  assert.equal(result.cons[0].order, 9);
});

test('normalizeSyncPayload rejects missing package and con identity fields', () => {
  assert.throws(() => normalizeSyncPayload({ packages: [{}], cons: [] }), /패키지 id/);
  assert.throws(
    () => normalizeSyncPayload({ packages: [{ id: 'pkg' }], cons: [{ packageId: 'pkg' }] }),
    /sourceNo/
  );
});

test('normalizeSyncPayload treats omitted package and con arrays as empty', () => {
  const result = normalizeSyncPayload({ account: { id: 'empty-user' } });
  assert.deepEqual(result.packages, []);
  assert.deepEqual(result.cons, []);
  assert.deepEqual(result.account, { id: 'empty-user' });
});

test('createCollection trims the name and rejects an empty name', () => {
  const result = createCollection('  새 콘묶음  ');
  assert.equal(result.name, '새 콘묶음');
  assert.match(result.id, /^collection_/);
  assert.deepEqual(result.items, []);
  assert.throws(() => createCollection('   '));
});

test('addUniqueIds appends only ids that are not already present', () => {
  const original = collection(['a', 'b']);
  const result = addUniqueIds(original, ['b', 'c', 'c', 'd']);
  assert.deepEqual(result.collection.items, ['a', 'b', 'c', 'd']);
  assert.equal(result.added, 2);
  assert.deepEqual(original.items, ['a', 'b']);
});

test('preserveCollectionRefMeta stores source metadata for an owned con', () => {
  const original = collection(['owned']);
  const cons = new Map([['owned', {
    id: 'owned', packageId: 'pkg', sourceNo: '42', name: '테스트 콘'
  }]]);
  const packages = new Map([['pkg', {
    id: 'pkg', sourcePackageId: 'source-pkg', name: '테스트 묶음'
  }]]);

  const result = preserveCollectionRefMeta(original, cons, packages);
  assert.deepEqual(result.refMeta.owned, {
    packageId: 'pkg',
    sourcePackageId: 'source-pkg',
    sourceNo: '42',
    name: '테스트 콘',
    packageName: '테스트 묶음'
  });
  assert.deepEqual(original.refMeta, {});
});

test('preserveCollectionRefMeta keeps saved metadata when a con is no longer owned', () => {
  const original = {
    ...collection(['missing']),
    refMeta: { missing: { sourceNo: '9', name: '이전 콘', packageName: '이전 묶음' } }
  };
  assert.equal(preserveCollectionRefMeta(original, new Map(), new Map()), original);
  assert.equal(original.refMeta.missing.packageName, '이전 묶음');
});

test('preserveCollectionRefMeta reuses the collection when owned metadata is already current', () => {
  const meta = {
    packageId: 'pkg', sourcePackageId: 'source-pkg', sourceNo: '42', name: '테스트 콘', packageName: '테스트 묶음'
  };
  const original = { ...collection(['owned']), refMeta: { owned: meta } };
  const cons = new Map([['owned', { id: 'owned', packageId: 'pkg', sourceNo: '42', name: '테스트 콘' }]]);
  const packages = new Map([['pkg', { id: 'pkg', sourcePackageId: 'source-pkg', name: '테스트 묶음' }]]);

  assert.equal(preserveCollectionRefMeta(original, cons, packages), original);
});

test('preserveStoryConRefs keeps con names after the synced account changes', () => {
  const story = { id: 'current', items: [{ id: 'story-1', type: 'con', conId: 'owned' }], updatedAt: 1 };
  const cons = new Map([['owned', { id: 'owned', packageId: 'pkg', sourceNo: '42', name: '테스트 콘' }]]);
  const packages = new Map([['pkg', { id: 'pkg', sourcePackageId: 'source-pkg', name: '테스트 묶음' }]]);

  const preserved = preserveStoryConRefs(story, cons, packages);
  assert.deepEqual(preserved.items[0].conRef, {
    packageId: 'pkg', sourcePackageId: 'source-pkg', sourceNo: '42', name: '테스트 콘', packageName: '테스트 묶음'
  });
  assert.equal(preserveStoryConRefs(preserved, new Map(), new Map()), preserved);
  assert.equal(story.items[0].conRef, undefined);
});

test('reorderIds moves one or several ids while preserving story order', () => {
  assert.deepEqual(reorderIds(collection(), ['b'], 'd').items, ['a', 'c', 'b', 'd']);
  assert.deepEqual(reorderIds(collection(), ['d', 'b'], 'c').items, ['a', 'b', 'd', 'c']);
  assert.deepEqual(reorderIds(collection(), ['b', 'd'], null).items, ['a', 'c', 'b', 'd']);
});

test('reorderOrderedIds preserves source order without mutating its input', () => {
  const original = ['a', 'b', 'c', 'd'];
  assert.deepEqual(reorderOrderedIds(original, ['d', 'b'], 'c'), ['a', 'b', 'd', 'c']);
  assert.deepEqual(original, ['a', 'b', 'c', 'd']);
});

test('reorderOrderedIds returns the input array when the resulting order is unchanged', () => {
  const original = ['a', 'b', 'c'];
  assert.equal(reorderOrderedIds(original, ['b'], 'c'), original);
  assert.equal(reorderOrderedIds(original, ['missing'], 'c'), original);
});

test('reorderIds leaves the original object untouched when no moving id exists', () => {
  const original = collection();
  assert.equal(reorderIds(original, ['missing'], 'b'), original);
  assert.deepEqual(original.items, ['a', 'b', 'c', 'd']);
});

test('reorderIds appends when the requested target does not exist', () => {
  assert.deepEqual(reorderIds(collection(), ['b'], 'missing').items, ['a', 'c', 'd', 'b']);
});

test('applyCollectionItemDraft reorders, removes, and deduplicates existing ids', () => {
  const original = {
    ...collection(['a', 'b', 'c']),
    refMeta: { a: { name: 'A' }, b: { name: 'B' }, c: { name: 'C' } }
  };
  const result = applyCollectionItemDraft(original, ['c', 'a', 'c', 'unknown']);
  assert.deepEqual(result.items, ['c', 'a']);
  assert.deepEqual(result.refMeta, { a: { name: 'A' }, c: { name: 'C' } });
  assert.deepEqual(original.items, ['a', 'b', 'c']);
});

test('applyCollectionItemDraft returns the original collection when nothing changed', () => {
  const original = collection(['a', 'b']);
  assert.equal(applyCollectionItemDraft(original, ['a', 'b']), original);
});

test('collection export preserves owned and missing con references', () => {
  const original = {
    ...collection(['owned', 'missing']),
    refMeta: {
      missing: {
        packageId: 'pkg-missing',
        sourcePackageId: 'source-missing',
        sourceNo: '99',
        name: '미보유 콘',
        packageName: '미보유 묶음'
      }
    }
  };
  const cons = new Map([['owned', {
    id: 'owned',
    packageId: 'pkg-owned',
    sourceNo: '10',
    name: '보유 콘'
  }]]);
  const packages = new Map([['pkg-owned', {
    id: 'pkg-owned',
    sourcePackageId: 'source-owned',
    name: '보유 묶음'
  }]]);

  const result = exportCollection(original, cons, packages);
  assert.equal(result.format, COLLECTION_FILE_FORMAT);
  assert.equal(result.version, COLLECTION_FILE_VERSION);
  assert.deepEqual(result.collection.items, ['owned', 'missing']);
  assert.deepEqual(result.refs.map(ref => ref.sourceNo), ['10', '99']);
  assert.deepEqual(result.packages.map(pkg => pkg.sourcePackageId), ['source-owned', 'source-missing']);
});

test('collection export emits one package row for cons from the same source package', () => {
  const original = collection(['a', 'b']);
  const cons = new Map([
    ['a', { id: 'a', packageId: 'pkg', sourceNo: '1', name: 'A' }],
    ['b', { id: 'b', packageId: 'pkg', sourceNo: '2', name: 'B' }]
  ]);
  const packages = new Map([['pkg', { id: 'pkg', sourcePackageId: 'source-pkg', name: '공통 묶음' }]]);

  const result = exportCollection(original, cons, packages);
  assert.equal(result.packages.length, 1);
  assert.equal(result.packages[0].sourcePackageId, 'source-pkg');
});

test('collection import supports versions 1 and 2 and removes duplicate ids', () => {
  const versionTwo = importCollectionFile({
    format: COLLECTION_FILE_FORMAT,
    version: 2,
    collection: { name: '가져온 묶음', items: ['a', 'a', 'b'] },
    packages: [{ packageId: 'pkg', sourcePackageId: 'source', name: '패키지' }],
    refs: [{ id: 'a', packageId: 'pkg', sourcePackageId: 'source', sourceNo: '1', name: 'A' }]
  });
  assert.deepEqual(versionTwo.items, ['a', 'b']);
  assert.equal(versionTwo.refMeta.a.packageName, '패키지');

  const versionOne = importCollectionFile({
    format: COLLECTION_FILE_FORMAT,
    version: 1,
    collection: { name: '구버전', items: ['old'] }
  });
  assert.deepEqual(versionOne.items, ['old']);
});

test('collection import truncates an overlong external name', () => {
  const result = importCollectionFile({
    format: COLLECTION_FILE_FORMAT,
    version: 2,
    collection: { name: '가'.repeat(COLLECTION_NAME_MAX_LENGTH + 10), items: [] }
  });
  assert.equal(result.name, '가'.repeat(COLLECTION_NAME_MAX_LENGTH));
});

test('collection import rejects unsupported formats and versions', () => {
  assert.throws(() => importCollectionFile({ format: 'wrong', version: 2 }), /지원하지 않는/);
  assert.throws(() => importCollectionFile({ format: COLLECTION_FILE_FORMAT, version: 99 }), /지원하지 않는/);
});

test('collection import filters invalid items and resolves package names by source id', () => {
  const result = importCollectionFile({
    format: COLLECTION_FILE_FORMAT,
    version: 2,
    collection: { name: '  ', items: ['a', 1, null, 'a'] },
    packages: [{ sourcePackageId: 'source', name: '원본 묶음' }, null],
    refs: [
      { id: 'a', sourcePackageId: 'source', sourceNo: 3 },
      { id: 'orphan', sourcePackageId: 'source', sourceNo: 4 },
      { id: 1, sourcePackageId: 'source' },
      null
    ]
  });

  assert.equal(result.name, '가져온 콘묶음');
  assert.deepEqual(result.items, ['a']);
  assert.equal(result.refMeta.a.packageName, '원본 묶음');
  assert.equal(result.refMeta.a.sourceNo, '3');
  assert.equal(result.refMeta.orphan, undefined);
  assert.equal(result.refMeta['1'], undefined);
});
