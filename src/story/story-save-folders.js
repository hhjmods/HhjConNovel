export const STORY_FOLDER_DOCUMENT_ID = 'story-save-folders-v1';
export const STORY_FOLDER_NAME_MAX_LENGTH = 40;

export function normalizeStoryFolders(documentValue) {
  const seen = new Set();
  return (Array.isArray(documentValue?.items) ? documentValue.items : []).flatMap(folder => {
    const id = String(folder?.id || '');
    const name = String(folder?.name || '').trim();
    if (!id || !name || seen.has(id)) return [];
    seen.add(id);
    return [{ id, name: name.slice(0, STORY_FOLDER_NAME_MAX_LENGTH), createdAt: Number(folder.createdAt) || 0 }];
  });
}

export function normalizeStoryFolderId(value, folders) {
  const id = String(value || '');
  return folders.some(folder => folder.id === id) ? id : '';
}

export function validateStoryFolderName(value, folders, ignoredId = '') {
  const name = String(value || '').trim();
  if (!name) throw new Error('원고 폴더 이름을 입력하세요.');
  if (name.length > STORY_FOLDER_NAME_MAX_LENGTH) throw new Error(`원고 폴더 이름은 ${STORY_FOLDER_NAME_MAX_LENGTH}자까지 입력할 수 있습니다.`);
  if (folders.some(folder => folder.id !== ignoredId && folder.name.toLocaleLowerCase('ko-KR') === name.toLocaleLowerCase('ko-KR'))) {
    throw new Error('같은 이름의 원고 폴더가 이미 있습니다.');
  }
  return name;
}

export function nextAvailableStoryName(value, names, maxLength = Infinity, caseInsensitive = false) {
  const base = String(value || '').trim().slice(0, maxLength);
  const key = name => caseInsensitive ? name.toLocaleLowerCase('ko-KR') : name;
  const used = new Set([...names].map(name => key(String(name))));
  let candidate = base;
  for (let number = 2; used.has(key(candidate)); number++) {
    const suffix = ` (${number})`;
    candidate = `${base.slice(0, maxLength - suffix.length)}${suffix}`;
  }
  return candidate;
}

export function makeStoryFolderDocument(folders) {
  return { id: STORY_FOLDER_DOCUMENT_ID, version: 1, items: structuredClone(folders), updatedAt: Date.now() };
}

export function sortStorySavesInFolder(saves, folders, folderId) {
  return saves.filter(save => normalizeStoryFolderId(save.folderId, folders) === folderId)
    .sort((a, b) => Number.isFinite(a.sortOrder) && Number.isFinite(b.sortOrder)
      ? a.sortOrder - b.sortOrder : (b.updatedAt || 0) - (a.updatedAt || 0));
}

export function nextStorySaveOrder(saves, folders, folderId) {
  const visible = sortStorySavesInFolder(saves, folders, folderId);
  return visible.length && visible.every(save => Number.isFinite(save.sortOrder))
    ? Math.min(...visible.map(save => save.sortOrder)) - 1 : undefined;
}

export function planStorySavePlacement(saves, folders, movingIds, targetFolderId, beforeId = '') {
  if (targetFolderId && !folders.some(folder => folder.id === targetFolderId)) throw new Error('이동할 원고 폴더를 찾을 수 없습니다.');
  const ids = new Set(movingIds);
  const moving = saves.filter(save => ids.has(save.id));
  if (moving.length !== ids.size) throw new Error('이동할 원고를 찾을 수 없습니다.');
  const target = sortStorySavesInFolder(saves, folders, targetFolderId);
  const remaining = target.filter(save => !ids.has(save.id));
  const anchor = ids.has(beforeId) ? target.slice(target.findIndex(save => save.id === beforeId) + 1)
    .find(save => !ids.has(save.id))?.id || '' : beforeId;
  const index = anchor ? remaining.findIndex(save => save.id === anchor) : remaining.length;
  if (index < 0) throw new Error('삽입할 원고 위치를 찾을 수 없습니다.');
  const orderedMoving = moving.sort((a, b) => {
    const aFolder = normalizeStoryFolderId(a.folderId, folders);
    const bFolder = normalizeStoryFolderId(b.folderId, folders);
    if (aFolder !== bFolder) return 0;
    const source = sortStorySavesInFolder(saves, folders, aFolder);
    return source.findIndex(save => save.id === a.id) - source.findIndex(save => save.id === b.id);
  });
  const next = [...remaining.slice(0, index), ...orderedMoving, ...remaining.slice(index)];
  if (next.length === target.length && next.every((save, i) => save.id === target[i].id)) return [];
  return next.map((save, sortOrder) => ({ ...save, folderId: targetFolderId, sortOrder }));
}

export function planStoryFolderPlacement(folders, movingIds, beforeId = '') {
  const ids = new Set(movingIds);
  const moving = folders.filter(folder => ids.has(folder.id));
  if (moving.length !== ids.size) throw new Error('이동할 원고 폴더를 찾을 수 없습니다.');
  const remaining = folders.filter(folder => !ids.has(folder.id));
  const anchor = ids.has(beforeId) ? folders.slice(folders.findIndex(folder => folder.id === beforeId) + 1)
    .find(folder => !ids.has(folder.id))?.id || '' : beforeId;
  const index = anchor ? remaining.findIndex(folder => folder.id === anchor) : remaining.length;
  if (index < 0) throw new Error('삽입할 원고 폴더를 찾을 수 없습니다.');
  const next = [...remaining.slice(0, index), ...moving, ...remaining.slice(index)];
  return next.every((folder, i) => folder.id === folders[i].id) ? [] : next;
}

export function planStoryFolderSelectionRemoval(folders, saves, folderIds, saveIds, deleteContents) {
  const selectedFolders = new Set(folderIds);
  const selectedSaves = new Set(saveIds);
  if (folders.filter(folder => selectedFolders.has(folder.id)).length !== selectedFolders.size) throw new Error('원고 폴더를 찾을 수 없습니다.');
  if (saves.filter(save => selectedSaves.has(save.id)).length !== selectedSaves.size) throw new Error('원고를 찾을 수 없습니다.');
  const contained = folders.filter(folder => selectedFolders.has(folder.id))
    .flatMap(folder => sortStorySavesInFolder(saves, folders, folder.id));
  const kept = deleteContents ? [] : contained.filter(save => !selectedSaves.has(save.id));
  const root = sortStorySavesInFolder(saves, folders, '').filter(save => !selectedSaves.has(save.id));
  return {
    document: makeStoryFolderDocument(folders.filter(folder => !selectedFolders.has(folder.id))),
    updates: kept.length ? [...kept, ...root].map((save, sortOrder) => ({ ...save, folderId: '', sortOrder })) : [],
    deleteIds: [...new Set([...selectedSaves, ...(deleteContents ? contained.map(save => save.id) : [])])]
  };
}

export function planStoryFolderRemoval(folders, saves, folderId, deleteContents) {
  return planStoryFolderSelectionRemoval(folders, saves, [folderId], [], deleteContents);
}
