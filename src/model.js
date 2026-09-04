export const COLLECTION_FILE_FORMAT = 'hhjcon-collection';
export const COLLECTION_FILE_VERSION = 1;

export function makeId(prefix = 'id') {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function makeStableConId(packageId, sourceNo) {
  return `dccon:${String(packageId)}:${String(sourceNo)}`;
}

export function normalizeSyncPayload(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('동기화 데이터가 객체가 아닙니다.');
  const rawPackages = Array.isArray(payload.packages) ? payload.packages : [];
  const rawCons = Array.isArray(payload.cons) ? payload.cons : [];
  const packages = rawPackages.map((pkg, order) => {
    if (pkg.id == null) throw new Error('패키지 id가 없습니다.');
    return {
      id: String(pkg.id),
      name: String(pkg.name || `DC콘 ${order + 1}`),
      sourcePackageId: String(pkg.sourcePackageId ?? pkg.id),
      order,
      updatedAt: Date.now()
    };
  });
  const packageIds = new Set(packages.map(pkg => pkg.id));
  const cons = rawCons.map((con, order) => {
    if (con.packageId == null || con.sourceNo == null) throw new Error('콘에는 packageId와 sourceNo가 필요합니다.');
    const packageId = String(con.packageId);
    if (!packageIds.has(packageId)) throw new Error(`등록되지 않은 packageId: ${packageId}`);
    return {
      id: String(con.id || makeStableConId(packageId, con.sourceNo)),
      packageId,
      sourceNo: String(con.sourceNo),
      name: String(con.name || `${order + 1}`),
      imageUrl: String(con.imageUrl || ''),
      thumbnailUrl: String(con.thumbnailUrl || con.imageUrl || ''),
      order: Number.isFinite(con.order) ? con.order : order,
      updatedAt: Date.now()
    };
  });
  return { account: payload.account || null, packages, cons, syncedAt: Date.now() };
}

export function createCollection(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) throw new Error('콘묶음 이름을 입력하세요.');
  return { id: makeId('collection'), name: trimmed, items: [], createdAt: Date.now(), updatedAt: Date.now() };
}

export function addUniqueIds(collection, ids) {
  const next = [...collection.items];
  const existing = new Set(next);
  let added = 0;
  ids.forEach(id => {
    if (!existing.has(id)) {
      existing.add(id);
      next.push(id);
      added += 1;
    }
  });
  return { collection: { ...collection, items: next, updatedAt: Date.now() }, added };
}

export function reorderIds(collection, movingIds, beforeId = null) {
  const moving = new Set(movingIds);
  const selectedInOrder = collection.items.filter(id => moving.has(id));
  if (!selectedInOrder.length) return collection;
  const remaining = collection.items.filter(id => !moving.has(id));
  let insertAt = beforeId ? remaining.indexOf(beforeId) : remaining.length;
  if (insertAt < 0) insertAt = remaining.length;
  remaining.splice(insertAt, 0, ...selectedInOrder);
  return { ...collection, items: remaining, updatedAt: Date.now() };
}

export function removeIds(collection, ids) {
  const remove = new Set(ids);
  return { ...collection, items: collection.items.filter(id => !remove.has(id)), updatedAt: Date.now() };
}

export function exportCollection(collection, consById, packagesById) {
  const refs = collection.items.map(id => {
    const con = consById.get(id);
    const pkg = con ? packagesById.get(con.packageId) : null;
    return con ? {
      id: con.id,
      packageId: con.packageId,
      sourcePackageId: pkg?.sourcePackageId || con.packageId,
      sourceNo: con.sourceNo,
      name: con.name
    } : { id };
  });
  return {
    format: COLLECTION_FILE_FORMAT,
    version: COLLECTION_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    collection: { name: collection.name, items: [...collection.items] },
    refs
  };
}

export function importCollectionFile(data) {
  if (!data || data.format !== COLLECTION_FILE_FORMAT || data.version !== COLLECTION_FILE_VERSION) {
    throw new Error('지원하지 않는 콘묶음 파일입니다.');
  }
  const name = String(data.collection?.name || '가져온 콘묶음').trim() || '가져온 콘묶음';
  const items = Array.isArray(data.collection?.items) ? data.collection.items.filter(id => typeof id === 'string') : [];
  return { id: makeId('collection'), name, items: [...new Set(items)], createdAt: Date.now(), updatedAt: Date.now() };
}
