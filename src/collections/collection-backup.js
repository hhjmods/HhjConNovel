import { getAll, putMany } from '../db.js';
import { wrongBackupTypeMessage } from '../core/backup-format.js?v=20260910-1';
import { downloadJson, makeTimestampedBackupName, sanitizeDownloadName } from '../core/json-download.js?v=20260909-3';
import { exportCollection, importCollectionFile } from '../model.js?v=20260912-1';
import { saveToastForReload } from '../ui/toast.js?v=20260909-2';

const BUNDLE_FORMAT = 'hhjcon-collections';
const BUNDLE_VERSION = 1;

const exportButton = document.getElementById('exportCollectionBtn');
const importInput = document.getElementById('importCollectionInput');

function mapById(items) {
  return new Map(items.map(item => [item.id, item]));
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

  collections.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
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

function importData(data) {
  const typeMessage = wrongBackupTypeMessage(data?.format, 'collection');
  if (typeMessage) throw new Error(typeMessage);
  if (data?.format === BUNDLE_FORMAT) {
    if (Number(data.version) !== BUNDLE_VERSION || !Array.isArray(data.collections) || !data.collections.length) {
      throw new Error('지원하지 않는 콘묶음 백업 파일입니다.');
    }
    return data.collections.map(item => importCollectionFile(item));
  }
  return [importCollectionFile(data)];
}

async function handleImport() {
  const files = [...(importInput.files || [])];
  importInput.value = '';
  if (!files.length) return;

  const imported = [];
  const failures = [];

  for (const file of files) {
    try {
      const data = JSON.parse(await file.text());
      imported.push(...importData(data));
    } catch (error) {
      failures.push(`${file.name}: ${error.message}`);
    }
  }

  if (imported.length) {
    const baseTime = Date.now();
    imported.forEach((collection, index) => {
      collection.createdAt = baseTime + index;
      collection.updatedAt = baseTime + index;
    });
    await putMany('collections', imported);
  }

  if (failures.length) {
    alert(`${imported.length ? `${imported.length}개 콘묶음을 불러왔습니다.\n\n` : ''}불러오지 못한 파일이 있습니다.\n${failures.map(message => `- ${message}`).join('\n')}`);
  }

  if (!imported.length) return;

  saveToastForReload(`${imported.length}개 콘묶음을 불러왔습니다.`);
  location.reload();
}

if (exportButton && importInput) {
  exportButton.addEventListener('click', handleExport);
  importInput.addEventListener('change', handleImport);
}
