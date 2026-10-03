import { getAll, getOne, putOne } from '../db.js';
import { wrongBackupTypeMessage } from '../core/backup-format.js?v=20260910-1';
import { downloadJson, makeTimestampedBackupName, sanitizeDownloadName } from '../core/json-download.js?v=20260909-3';
import { COLLECTION_NAME_MAX_LENGTH, exportCollection, importCollectionFile } from '../model.js?v=20260912-1';
import { showToast } from '../ui/toast.js?v=20261003-1';
import { COLLECTION_FOLDER_DOCUMENT_ID, COLLECTION_FOLDER_NAME_MAX_LENGTH, collectionFolderTree, collectionFoldersIn, makeCollectionFolderDocument, nextCollectionOrder, normalizeCollectionFolders, sortCollectionsInFolder, validateCollectionFolderName } from './collection-folders.js?v=20261004-1';
import { nextAvailableStoryName } from '../story/story-save-folders.js?v=20261003-2';

const BUNDLE_FORMAT = 'hhjcon-collections';
const BUNDLE_VERSION = 1;

const exportButton = document.getElementById('exportCollectionBtn');
const importInput = document.getElementById('importCollectionInput');

function mapById(items) {
  return new Map(items.map(item => [item.id, item]));
}

export async function exportCollectionSelection(collectionIds, folderIds = []) {
  const [collections, cons, packages, folderDocument] = await Promise.all([
    getAll('collections'), getAll('cons'), getAll('packages'), getOne('documents', COLLECTION_FOLDER_DOCUMENT_ID)
  ]);
  const folders = normalizeCollectionFolders(folderDocument);
  const selectedFolders = folders.filter(folder => folderIds.includes(folder.id) && !folderIds.includes(folder.parentId));
  const containedIds = new Set(selectedFolders.flatMap(folder => collectionFolderTree(folders, folder.id))
    .flatMap(folder => sortCollectionsInFolder(collections, folders, folder.id).map(item => item.id)));
  const selected = collections.filter(item => collectionIds.includes(item.id) && !containedIds.has(item.id));
  if (!selected.length && !selectedFolders.length) throw new Error('내보낼 콘묶음이나 폴더를 하나 이상 선택하세요.');
  const consById = mapById(cons);
  const packagesById = mapById(packages);
  const encode = item => exportCollection(item, consById, packagesById);
  if (selected.length === 1 && !selectedFolders.length) {
    downloadJson(`${sanitizeDownloadName(selected[0].name, 'collection')}.hhjconset.json`, encode(selected[0]));
    return;
  }
  downloadJson(makeTimestampedBackupName('콘묶음_백업', '.hhjconset.json'), {
    format: BUNDLE_FORMAT,
    version: selectedFolders.some(folder => collectionFoldersIn(folders, folder.id).length) ? 2 : BUNDLE_VERSION,
    exportedAt: new Date().toISOString(),
    collections: selected.map(encode),
    folders: selectedFolders.map(folder => ({
      name: folder.name, collections: sortCollectionsInFolder(collections, folders, folder.id).map(encode),
      ...(collectionFoldersIn(folders, folder.id).length ? { folders: collectionFoldersIn(folders, folder.id).map(child => ({
        name: child.name, collections: sortCollectionsInFolder(collections, folders, child.id).map(encode)
      })) } : {})
    }))
  });
}

function activeCollectionName() {
  return document.querySelector('#collectionList .collection-row.active .collection-main span')?.textContent?.trim() || '';
}

function createExportDialog(collections) {
  const dialog = document.createElement('dialog');
  dialog.className = 'collection-backup-dialog';

  const form = document.createElement('form');
  form.method = 'dialog';

  const header = document.createElement('div');
  header.className = 'collection-backup-header';
  const title = document.createElement('strong');
  title.textContent = '내보낼 콘묶음 선택';
  const close = document.createElement('button');
  close.type = 'submit';
  close.value = 'cancel';
  close.className = 'icon-button';
  close.textContent = '×';
  header.append(title, close);

  const controls = document.createElement('div');
  controls.className = 'collection-backup-controls';
  const selectAll = document.createElement('button');
  selectAll.type = 'button';
  selectAll.textContent = '전체 선택';
  const clearAll = document.createElement('button');
  clearAll.type = 'button';
  clearAll.textContent = '선택 해제';
  controls.append(selectAll, clearAll);

  const list = document.createElement('div');
  list.className = 'collection-backup-list';
  const activeName = activeCollectionName();
  let preselected = false;

  collections.forEach((collection, index) => {
    const label = document.createElement('label');
    label.className = 'collection-backup-item';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = collection.id;
    if (!preselected && ((activeName && collection.name === activeName) || (!activeName && index === 0))) {
      checkbox.checked = true;
      preselected = true;
    }
    const name = document.createElement('span');
    name.textContent = collection.name;
    const count = document.createElement('small');
    count.textContent = `${collection.items.length}개`;
    label.append(checkbox, name, count);
    list.append(label);
  });

  const footer = document.createElement('div');
  footer.className = 'collection-backup-footer';
  const cancel = document.createElement('button');
  cancel.type = 'submit';
  cancel.value = 'cancel';
  cancel.textContent = '취소';
  const confirm = document.createElement('button');
  confirm.type = 'button';
  confirm.className = 'primary';
  confirm.textContent = '내보내기';
  footer.append(cancel, confirm);

  form.append(header, controls, list, footer);
  dialog.append(form);
  document.body.append(dialog);

  selectAll.addEventListener('click', () => list.querySelectorAll('input[type="checkbox"]').forEach(input => { input.checked = true; }));
  clearAll.addEventListener('click', () => list.querySelectorAll('input[type="checkbox"]').forEach(input => { input.checked = false; }));

  dialog.addEventListener('close', () => dialog.remove(), { once: true });

  return { dialog, list, confirm };
}

async function handleExport() {
  const [collections, cons, packages] = await Promise.all([
    getAll('collections'),
    getAll('cons'),
    getAll('packages')
  ]);

  collections.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  if (!collections.length) {
    alert('내보낼 콘묶음이 없습니다.');
    return;
  }

  const { dialog, list, confirm } = createExportDialog(collections);
  const consById = mapById(cons);
  const packagesById = mapById(packages);

  confirm.addEventListener('click', () => {
    const selectedIds = new Set([...list.querySelectorAll('input[type="checkbox"]:checked')].map(input => input.value));
    const selected = collections.filter(collection => selectedIds.has(collection.id));
    if (!selected.length) {
      alert('내보낼 콘묶음을 하나 이상 선택하세요.');
      return;
    }

    if (selected.length === 1) {
      const collection = selected[0];
      downloadJson(`${sanitizeDownloadName(collection.name, 'collection')}.hhjconset.json`, exportCollection(collection, consById, packagesById));
    } else {
      downloadJson(makeTimestampedBackupName('콘묶음_백업', '.hhjconset.json'), {
        format: BUNDLE_FORMAT,
        version: BUNDLE_VERSION,
        exportedAt: new Date().toISOString(),
        collections: selected.map(collection => exportCollection(collection, consById, packagesById))
      });
    }

    dialog.close();
  });

  dialog.showModal();
}

export function parseCollectionBackup(data) {
  const typeMessage = wrongBackupTypeMessage(data?.format, 'collection');
  if (typeMessage) throw new Error(typeMessage);
  if (data?.format === BUNDLE_FORMAT) {
    if (![BUNDLE_VERSION, 2].includes(Number(data.version)) || !Array.isArray(data.collections) || !Array.isArray(data.folders || [])
      || !data.collections.length && !(data.folders || []).length) {
      throw new Error('지원하지 않는 콘묶음 백업 파일입니다.');
    }
    return {
      collections: data.collections.map(item => importCollectionFile(item)),
      folders: (data.folders || []).map(folder => parseCollectionFolder(folder))
    };
  }
  return { collections: [importCollectionFile(data)], folders: [] };
}

function parseCollectionFolder(folder, depth = 0) {
  if (!Array.isArray(folder?.collections) || !Array.isArray(folder.folders || []) || depth > 0 && folder.folders?.length) {
    throw new Error('콘묶음 폴더 백업 형식이 올바르지 않습니다. 폴더는 두 단계까지만 불러올 수 있습니다.');
  }
  const children = (folder.folders || []).map(child => parseCollectionFolder(child, depth + 1));
  return { name: validateCollectionFolderName(folder.name, []), collections: folder.collections.map(item => importCollectionFile(item)),
    ...(children.length ? { folders: children } : {}) };
}

export function nameImportedCollections(collections, existingNames) {
  const names = [...existingNames];
  return collections.map(collection => {
    const name = nextAvailableStoryName(collection.name, names, COLLECTION_NAME_MAX_LENGTH, true);
    names.push(name);
    return { ...collection, name };
  });
}

async function handleImport() {
  const files = [...(importInput.files || [])];
  importInput.value = '';
  if (!files.length) return;

  const imported = [];
  const importedFolders = [];
  const failures = [];
  const renamed = [];

  for (const file of files) {
    try {
      const data = JSON.parse(await file.text());
      const parsed = parseCollectionBackup(data);
      imported.push(...parsed.collections);
      importedFolders.push(...parsed.folders);
    } catch (error) {
      failures.push(`${file.name}: ${error.message}`);
    }
  }

  const folderCount = importedFolders.reduce((count, folder) => count + 1 + (folder.folders?.length || 0), 0);
  const rootCount = imported.length;

  if (imported.length || importedFolders.length) {
    const existingCollections = await getAll('collections');
    const existingNames = existingCollections.map(collection => collection.name);
    const existing = normalizeCollectionFolders(await getOne('documents', COLLECTION_FOLDER_DOCUMENT_ID));
    const rootOrder = nextCollectionOrder(existingCollections, existing, '');
    const created = [];
    if (importedFolders.length) {
      const folderRenames = [];
      importedFolders.forEach(group => {
        const name = nextAvailableStoryName(group.name, collectionFoldersIn([...existing, ...created]).map(folder => folder.name), COLLECTION_FOLDER_NAME_MAX_LENGTH, true);
        const folder = { id: `collection-folder_${crypto.randomUUID()}`, name, createdAt: Date.now() };
        created.push(folder);
        if (group.name !== name) folderRenames.push(`[최상위][폴더] “${group.name}” → “${name}”`);
        group.collections.forEach((collection, sortOrder) => imported.push({ ...collection, folderId: folder.id, sortOrder }));
        (group.folders || []).forEach(child => {
          const childName = nextAvailableStoryName(child.name, collectionFoldersIn(created, folder.id).map(item => item.name), COLLECTION_FOLDER_NAME_MAX_LENGTH, true);
          const nested = { id: `collection-folder_${crypto.randomUUID()}`, name: childName, parentId: folder.id, createdAt: Date.now() };
          created.push(nested);
          if (child.name !== childName) folderRenames.push(`[${folder.name}][폴더] “${child.name}” → “${childName}”`);
          child.collections.forEach((collection, sortOrder) => imported.push({ ...collection, folderId: nested.id, sortOrder }));
        });
      });
      await putOne('documents', makeCollectionFolderDocument([...created, ...existing]));
      renamed.push(...folderRenames);
    }
    const namedImported = nameImportedCollections(imported, existingNames);
    const baseTime = existingCollections.reduce((latest, item) => Math.max(latest, item.createdAt || 0), Date.now());
    namedImported.forEach((collection, index) => {
      collection.createdAt = baseTime + namedImported.length - index;
      collection.updatedAt = collection.createdAt;
      if (index < rootCount && Number.isFinite(rootOrder)) collection.sortOrder = rootOrder - rootCount + 1 + index;
    });
    const { addImportedCollections } = await import('../app.js?v=20261004-1');
    await addImportedCollections(namedImported);
    namedImported.forEach((collection, index) => {
      if (collection.name !== imported[index].name) {
        const folder = created.find(item => item.id === collection.folderId);
        const parent = created.find(item => item.id === folder?.parentId);
        const path = [parent?.name, folder?.name].filter(Boolean).join(' / ') || '최상위';
        renamed.push(`[${path}][콘묶음] “${imported[index].name}” → “${collection.name}”`);
      }
    });
  }

  if (renamed.length) alert(`백업을 불러오며 중복된 이름이 다음과 같이 변경되었습니다.\n${renamed.join('\n')}`);
  if (failures.length) {
    alert(`${imported.length || importedFolders.length ? `${folderCount ? `${folderCount}개 폴더와 ` : ''}${imported.length}개 콘묶음을 불러왔습니다.\n\n` : ''}불러오지 못한 파일이 있습니다.\n${failures.map(message => `- ${message}`).join('\n')}`);
  }

  if (!imported.length && !importedFolders.length) return;

  showToast(`${folderCount ? `${folderCount}개 폴더와 ` : ''}${imported.length}개 콘묶음을 불러왔습니다.`);
  importInput.dispatchEvent(new Event('hhjcon:collection-imported'));
}

if (exportButton && importInput) {
  exportButton.addEventListener('click', handleExport);
  importInput.addEventListener('change', handleImport);
}
