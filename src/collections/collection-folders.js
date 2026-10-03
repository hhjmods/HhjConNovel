export const COLLECTION_FOLDER_DOCUMENT_ID = 'collection-folders-v1';
export const COLLECTION_FOLDER_NAME_MAX_LENGTH = 40;

export function normalizeCollectionFolders(documentValue) {
  const seen = new Set();
  const items = (Array.isArray(documentValue?.items) ? documentValue.items : []).flatMap(folder => {
    const id = String(folder?.id || '');
    const name = String(folder?.name || '').trim();
    if (!id || !name || seen.has(id)) return [];
    seen.add(id);
    return [{ id, name: name.slice(0, COLLECTION_FOLDER_NAME_MAX_LENGTH), createdAt: Number(folder.createdAt) || 0,
      parentId: String(folder.parentId || '') }];
  });
  const byId = new Map(items.map(folder => [folder.id, folder]));
  return items.map(({ parentId, ...folder }) => parentId && byId.has(parentId) && !byId.get(parentId).parentId
    ? { ...folder, parentId } : folder);
}

export const collectionFoldersIn = (folders, parentId = '') => folders.filter(folder => (folder.parentId || '') === parentId);
export const collectionFolderTree = (folders, id) => folders.filter(folder => folder.id === id || folder.parentId === id);

export function normalizeCollectionFolderId(value, folders) {
  const id = String(value || '');
  return folders.some(folder => folder.id === id) ? id : '';
}

export function validateCollectionFolderName(value, folders, ignoredId = '', parentId = '') {
  const name = String(value || '').trim();
  if (!name) throw new Error('콘묶음 폴더 이름을 입력하세요.');
  if (name.length > COLLECTION_FOLDER_NAME_MAX_LENGTH) {
    throw new Error(`콘묶음 폴더 이름은 ${COLLECTION_FOLDER_NAME_MAX_LENGTH}자까지 입력할 수 있습니다.`);
  }
  if (collectionFoldersIn(folders, parentId).some(folder => folder.id !== ignoredId
    && folder.name.toLocaleLowerCase('ko-KR') === name.toLocaleLowerCase('ko-KR'))) {
    throw new Error('같은 이름의 콘묶음 폴더가 이미 있습니다.');
  }
  return name;
}

export function makeCollectionFolderDocument(folders) {
  return {
    id: COLLECTION_FOLDER_DOCUMENT_ID,
    version: 1,
    items: structuredClone(folders),
    updatedAt: Date.now()
  };
}

export function sortCollectionsInFolder(collections, folders, folderId) {
  return collections.filter(collection => normalizeCollectionFolderId(collection.folderId, folders) === folderId)
    .sort((a, b) => Number.isFinite(a.sortOrder) && Number.isFinite(b.sortOrder)
      ? a.sortOrder - b.sortOrder : (b.createdAt || 0) - (a.createdAt || 0));
}

export function nextCollectionOrder(collections, folders, folderId) {
  const visible = sortCollectionsInFolder(collections, folders, folderId);
  return visible.length && visible.every(collection => Number.isFinite(collection.sortOrder))
    ? Math.min(...visible.map(collection => collection.sortOrder)) - 1 : undefined;
}

export function planCollectionPlacement(collections, folders, collectionId, targetFolderId, beforeId = '') {
  if (targetFolderId && !folders.some(folder => folder.id === targetFolderId)) {
    throw new Error('이동할 콘묶음 폴더를 찾을 수 없습니다.');
  }
  const moving = collections.find(collection => collection.id === collectionId);
  if (!moving) throw new Error('이동할 콘묶음을 찾을 수 없습니다.');
  const target = sortCollectionsInFolder(collections, folders, targetFolderId);
  const remaining = target.filter(collection => collection.id !== collectionId);
  const anchor = beforeId === collectionId
    ? target.slice(target.findIndex(collection => collection.id === collectionId) + 1)[0]?.id || ''
    : beforeId;
  const index = anchor ? remaining.findIndex(collection => collection.id === anchor) : remaining.length;
  if (index < 0) throw new Error('삽입할 콘묶음 위치를 찾을 수 없습니다.');
  const next = [...remaining.slice(0, index), moving, ...remaining.slice(index)];
  if (normalizeCollectionFolderId(moving.folderId, folders) === targetFolderId
    && next.length === target.length
    && next.every((collection, itemIndex) => collection.id === target[itemIndex].id)) return [];
  return next.map((collection, sortOrder) => ({ ...collection, folderId: targetFolderId, sortOrder }));
}

export function planCollectionSelectionPlacement(collections, folders, collectionIds, targetFolderId, beforeId = '') {
  if (targetFolderId && !folders.some(folder => folder.id === targetFolderId)) throw new Error('이동할 콘묶음 폴더를 찾을 수 없습니다.');
  const ids = new Set(collectionIds);
  const moving = collectionIds.map(id => collections.find(collection => collection.id === id)).filter(Boolean);
  if (moving.length !== ids.size) throw new Error('이동할 콘묶음을 찾을 수 없습니다.');
  const target = sortCollectionsInFolder(collections, folders, targetFolderId);
  const remaining = target.filter(collection => !ids.has(collection.id));
  const anchor = ids.has(beforeId) ? target.slice(target.findIndex(item => item.id === beforeId) + 1).find(item => !ids.has(item.id))?.id || '' : beforeId;
  const index = anchor ? remaining.findIndex(item => item.id === anchor) : remaining.length;
  if (index < 0) throw new Error('삽입할 콘묶음 위치를 찾을 수 없습니다.');
  const next = [...remaining.slice(0, index), ...moving, ...remaining.slice(index)];
  if (next.length === target.length && next.every((item, i) => item.id === target[i].id && normalizeCollectionFolderId(item.folderId, folders) === targetFolderId)) return [];
  return next.map((item, sortOrder) => ({ ...item, folderId: targetFolderId, sortOrder }));
}

export function planCollectionFolderPlacement(folders, folderId, beforeId = '', targetParentId = undefined) {
  return planCollectionFolderSelectionPlacement(folders, [folderId], beforeId,
    targetParentId === undefined ? folders.find(folder => folder.id === folderId)?.parentId || '' : targetParentId);
}

export function planCollectionFolderSelectionPlacement(folders, folderIds, beforeId = '', targetParentId = '') {
  const ids = new Set(folderIds);
  const moving = folders.filter(folder => ids.has(folder.id));
  if (moving.length !== ids.size) throw new Error('이동할 콘묶음 폴더를 찾을 수 없습니다.');
  const parent = folders.find(folder => folder.id === targetParentId);
  if (targetParentId && (!parent || parent.parentId || ids.has(targetParentId))
    || targetParentId && moving.some(folder => collectionFoldersIn(folders, folder.id).length)) {
    throw new Error('폴더는 최상위 폴더 아래에 한 단계까지만 넣을 수 있습니다.');
  }
  if (collectionFoldersIn(folders, targetParentId).some(folder => !ids.has(folder.id)
    && moving.some(item => item.name.toLocaleLowerCase('ko-KR') === folder.name.toLocaleLowerCase('ko-KR')))) {
    throw new Error('이동할 위치에 같은 이름의 콘묶음 폴더가 이미 있습니다.');
  }
  const target = collectionFoldersIn(folders, targetParentId);
  const remaining = target.filter(folder => !ids.has(folder.id));
  const anchor = ids.has(beforeId) ? target.slice(target.findIndex(item => item.id === beforeId) + 1).find(item => !ids.has(item.id))?.id || '' : beforeId;
  const index = anchor ? remaining.findIndex(folder => folder.id === anchor) : remaining.length;
  if (index < 0) throw new Error('삽입할 콘묶음 폴더 위치를 찾을 수 없습니다.');
  const nextTarget = [...remaining.slice(0, index), ...moving, ...remaining.slice(index)]
    .map(({ parentId, ...folder }) => targetParentId ? { ...folder, parentId: targetParentId } : folder);
  const next = [...folders.filter(folder => !ids.has(folder.id) && (folder.parentId || '') !== targetParentId), ...nextTarget];
  return next.every((folder, i) => folder.id === folders[i].id && folder.parentId === folders[i].parentId) ? [] : next;
}

export function planCollectionFolderSelectionRemoval(folders, collections, folderIds, collectionIds, deleteContents) {
  const selectedFolders = new Set(folderIds);
  const selectedCollections = new Set(collectionIds);
  if (folders.filter(folder => selectedFolders.has(folder.id)).length !== selectedFolders.size) throw new Error('콘묶음 폴더를 찾을 수 없습니다.');
  if (collections.filter(item => selectedCollections.has(item.id)).length !== selectedCollections.size) throw new Error('콘묶음을 찾을 수 없습니다.');
  const descendants = new Set(folders.filter(folder => selectedFolders.has(folder.parentId)).map(folder => folder.id));
  const removed = deleteContents ? new Set([...selectedFolders, ...descendants]) : selectedFolders;
  const parentOf = id => {
    let parentId = folders.find(folder => folder.id === id)?.parentId || '';
    while (selectedFolders.has(parentId)) parentId = folders.find(folder => folder.id === parentId)?.parentId || '';
    return parentId;
  };
  const movedByParent = new Map();
  if (!deleteContents) {
    for (const folder of folders.filter(item => selectedFolders.has(item.id))) {
      const target = parentOf(folder.id);
      const moved = sortCollectionsInFolder(collections, folders, folder.id).filter(item => !selectedCollections.has(item.id));
      movedByParent.set(target, [...(movedByParent.get(target) || []), ...moved]);
    }
  }
  const updates = [...movedByParent].flatMap(([parentId, moved]) => [
    ...moved, ...sortCollectionsInFolder(collections, folders, parentId).filter(item => !selectedCollections.has(item.id))
  ].map((item, sortOrder) => ({ ...item, folderId: parentId, sortOrder })));
  const keptFolders = folders.filter(folder => !removed.has(folder.id));
  const namesByParent = new Map();
  for (const folder of keptFolders.filter(item => !selectedFolders.has(item.parentId))) {
    const parentId = folder.parentId || '';
    namesByParent.set(parentId, [...(namesByParent.get(parentId) || []), folder.name]);
  }
  const nextFolders = keptFolders.map(folder => {
    if (!selectedFolders.has(folder.parentId)) return folder;
    const parentId = parentOf(folder.id);
    const names = namesByParent.get(parentId) || [];
    let name = folder.name;
    for (let number = 2; names.some(item => item.toLocaleLowerCase('ko-KR') === name.toLocaleLowerCase('ko-KR')); number++) {
      const suffix = ` (${number})`;
      name = `${folder.name.slice(0, COLLECTION_FOLDER_NAME_MAX_LENGTH - suffix.length)}${suffix}`;
    }
    namesByParent.set(parentId, [...names, name]);
    const promoted = { ...folder, name };
    if (parentId) promoted.parentId = parentId;
    else delete promoted.parentId;
    return promoted;
  });
  return {
    document: makeCollectionFolderDocument(nextFolders),
    updates,
    deleteIds: [...new Set([...selectedCollections, ...(deleteContents
      ? collections.filter(item => removed.has(item.folderId)).map(item => item.id) : [])])]
  };
}

export function planCollectionFolderRemoval(folders, collections, folderId, deleteContents) {
  return planCollectionFolderSelectionRemoval(folders, collections, [folderId], [], deleteContents);
}
