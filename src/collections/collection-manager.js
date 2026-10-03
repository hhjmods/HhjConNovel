import { getAll, getOne, putOne } from '../db.js';
import { COLLECTION_NAME_MAX_LENGTH } from '../model.js?v=20260912-1';
import { copyCollectionsByIds, createNamedCollection, commitCollectionPlacements, deleteCollectionsByIds, renameCollectionById } from '../app.js?v=20261004-1';
import { COLLECTION_WARNING, chooseNameConflict, confirmNamedItemDeletion, createDialog, showConfirm, showPrompt } from '../ui/action-dialogs.js?v=20261004-1';
import { showToast } from '../ui/toast.js?v=20261003-1';
import { nextAvailableStoryName } from '../story/story-save-folders.js?v=20261003-2';
import { exportCollectionSelection } from './collection-backup.js?v=20261004-1';
import {
  COLLECTION_FOLDER_DOCUMENT_ID, COLLECTION_FOLDER_NAME_MAX_LENGTH, collectionFolderTree, collectionFoldersIn, makeCollectionFolderDocument,
  normalizeCollectionFolderId, normalizeCollectionFolders, planCollectionFolderSelectionPlacement,
  planCollectionFolderSelectionRemoval, planCollectionSelectionPlacement, sortCollectionsInFolder, validateCollectionFolderName
} from './collection-folders.js?v=20261004-1';

const manageButton = document.getElementById('manageCollectionsBtn');
const importInput = document.getElementById('importCollectionInput');
const collectionList = document.getElementById('collectionList');

function button(label, action, className = '') {
  const node = document.createElement('button');
  node.type = 'button';
  node.textContent = label;
  node.dataset.action = action;
  if (className) node.className = className;
  return node;
}

function selectedIds(ui, kind) {
  return [...ui.list.querySelectorAll(`input[data-kind="${kind}"]:checked`)].map(input => input.value);
}

function syncSelectAll(ui) {
  const inputs = [...ui.list.querySelectorAll('input[data-kind]')];
  const checked = inputs.filter(input => input.checked).length;
  ui.selectAll.disabled = !inputs.length;
  ui.selectAll.checked = !!inputs.length && checked === inputs.length;
  ui.selectAll.indeterminate = checked > 0 && checked < inputs.length;
}

function refreshSidebar() {
  collectionList?.dispatchEvent(new Event('hhjcon:library-navigation-rendered'));
}

function clearGuide(ui) {
  ui.dialog.querySelectorAll('.story-drop-before, .story-drop-after, .story-drop-folder, .story-drop-end, .story-drop-blocked')
    .forEach(node => node.classList.remove('story-drop-before', 'story-drop-after', 'story-drop-folder', 'story-drop-end', 'story-drop-blocked'));
}

function makeDialog() {
  const dialog = document.createElement('dialog');
  dialog.className = 'story-save-dialog collection-manager-dialog';
  dialog.innerHTML = `<div class="story-save-head"><div class="story-save-head-actions"><strong>콘묶음 관리</strong><button type="button" data-action="new-collection">+ 새 콘묶음</button><button type="button" data-action="new-folder">+ 새 폴더</button></div><button type="button" class="icon-button" data-action="close" aria-label="닫기">×</button></div>
    <div class="story-save-selection-tools"><div class="story-save-select-group"><input type="checkbox" aria-label="현재 목록 전체 선택"><details class="story-save-select-menu"><summary aria-label="선택 종류">▾</summary><div class="story-save-select-options"><button type="button" data-action="select-folders">폴더 선택</button><button type="button" data-action="select-collections">콘묶음 선택</button><button type="button" data-action="select-clear">선택 해제</button></div></details></div><button type="button" class="danger" data-action="delete-selected">선택 항목 삭제</button><button type="button" class="primary" data-action="export-selected">선택 항목 내보내기</button><button type="button" data-action="import">콘묶음 백업 불러오기</button><button type="button" data-action="copy">선택 복사</button><button type="button" data-action="paste" disabled>붙여넣기</button></div>
    <div class="story-save-location"><button type="button" data-action="up">← 최상위</button><span></span><div class="story-save-parent-drop" hidden>콘묶음을 놓으면 최상위로 이동</div></div>
    <div class="story-save-list"></div><div class="story-save-warning">(콘묶음은 브라우저 데이터 삭제 시 지워집니다. 중요한 콘묶음은 내보내기로 백업해 두세요.)</div>`;
  document.body.append(dialog);
  const ui = {
    dialog, list: dialog.querySelector('.story-save-list'), location: dialog.querySelector('.story-save-location span'),
    up: dialog.querySelector('[data-action="up"]'), parentDrop: dialog.querySelector('.story-save-parent-drop'),
    selectAll: dialog.querySelector('.story-save-select-group input'), menu: dialog.querySelector('.story-save-select-menu'),
    currentFolderId: '', clipboard: [], drag: null, folders: [], collections: []
  };
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('pointerdown', event => { if (!ui.menu.contains(event.target)) ui.menu.open = false; }, true);
  return ui;
}

async function render(ui) {
  const [collections, documentValue] = await Promise.all([getAll('collections'), getOne('documents', COLLECTION_FOLDER_DOCUMENT_ID)]);
  ui.collections = collections;
  ui.folders = normalizeCollectionFolders(documentValue);
  ui.currentFolderId = normalizeCollectionFolderId(ui.currentFolderId, ui.folders);
  const folder = ui.folders.find(item => item.id === ui.currentFolderId);
  const parent = ui.folders.find(item => item.id === folder?.parentId);
  ui.parentFolderId = parent?.id || '';
  ui.up.hidden = !folder;
  ui.up.textContent = `← ${parent?.name || '최상위'}`;
  ui.dialog.querySelector('[data-action="new-folder"]').hidden = Boolean(folder?.parentId);
  ui.parentDrop.hidden = true;
  ui.parentDrop.textContent = `놓으면 ${parent?.name || '최상위'}로 이동`;
  ui.location.replaceChildren('현재 위치: ');
  if (parent) {
    const parentName = document.createElement('span'); parentName.className = 'folder-path-parent'; parentName.textContent = parent.name;
    ui.location.append(parentName, ' / ');
  }
  const currentName = document.createElement('span'); currentName.className = 'folder-path-current'; currentName.textContent = folder?.name || '최상위';
  ui.location.append(currentName);
  ui.location.dataset.tooltipTitle = '현재 위치';
  ui.location.dataset.tooltipDescription = [parent?.name, folder?.name].filter(Boolean).join(' / ') || '최상위';
  ui.list.replaceChildren();

  const visibleFolders = folder?.parentId ? [] : collectionFoldersIn(ui.folders, ui.currentFolderId);
  visibleFolders.forEach(item => {
    const row = document.createElement('div'); row.className = 'story-folder-row'; row.draggable = true; row.dataset.kind = 'folder'; row.dataset.itemId = item.id;
    const check = document.createElement('input'); check.type = 'checkbox'; check.className = 'story-folder-check'; check.dataset.kind = 'folder'; check.value = item.id; check.setAttribute('aria-label', `${item.name} 폴더 선택`);
    const open = button('', 'open-folder', 'story-folder-main');
    const name = document.createElement('strong'); name.textContent = `📁 ${item.name}`;
    const children = collectionFoldersIn(ui.folders, item.id);
    const childIds = new Set(children.map(child => child.id));
    const count = document.createElement('small'); count.textContent = `콘묶음 ${sortCollectionsInFolder(collections, ui.folders, item.id).length}개`
      + (children.length ? ` · 폴더 ${children.length}개 · 폴더 속 콘묶음 ${collections.filter(collection => childIds.has(normalizeCollectionFolderId(collection.folderId, ui.folders))).length}개` : '');
    open.append(name, count);
    const actions = document.createElement('div'); actions.className = 'story-save-actions';
    actions.append(button('내보내기', 'export-folder'), button('이름 변경', 'rename-folder'), button('삭제', 'delete-folder', 'danger'));
    row.append(check, open, actions); ui.list.append(row);
  });

  const visible = sortCollectionsInFolder(collections, ui.folders, ui.currentFolderId);
  visible.forEach(item => {
    const row = document.createElement('div'); row.className = 'story-save-row'; row.draggable = true; row.dataset.kind = 'collection'; row.dataset.itemId = item.id;
    row.dataset.tooltipTitle = '콘묶음'; row.dataset.tooltipDescription = '저장된 콘묶음입니다. 드래그해서 순서를 바꾸거나 폴더에 넣고 뺄 수 있습니다.';
    const check = document.createElement('input'); check.type = 'checkbox'; check.className = 'story-save-check'; check.dataset.kind = 'collection'; check.value = item.id; check.setAttribute('aria-label', `${item.name} 콘묶음 선택`);
    const info = document.createElement('div'); info.className = 'story-save-info';
    const name = document.createElement('strong'); name.textContent = item.name;
    const count = document.createElement('small'); count.textContent = `콘 ${item.items.length}개`; info.append(name, count);
    const actions = document.createElement('div'); actions.className = 'story-save-actions';
    actions.append(button('열기', 'open-collection', 'primary'), button('내보내기', 'export-collection'), button('이름 변경', 'rename-collection'), button('삭제', 'delete-collection', 'danger'));
    row.append(check, info, actions); ui.list.append(row);
  });
  if (!visibleFolders.length && !visible.length) {
    const empty = document.createElement('div'); empty.className = 'story-save-empty';
    empty.textContent = folder ? '이 폴더에 콘묶음이 없습니다.' : '콘묶음 목록이 비어 있습니다.';
    ui.list.append(empty);
  }
  syncSelectAll(ui);
}

async function createFolder(ui) {
  const input = await showPrompt('새 콘묶음 폴더 이름을 입력하세요.', '', {
    title: '새 콘묶음 폴더', label: `폴더 이름 (최대 ${COLLECTION_FOLDER_NAME_MAX_LENGTH}자)`, confirmText: '만들기', maxLength: COLLECTION_FOLDER_NAME_MAX_LENGTH, note: COLLECTION_WARNING
  });
  if (input == null) return;
  let name = String(input).trim();
  let folders = normalizeCollectionFolders(await getOne('documents', COLLECTION_FOLDER_DOCUMENT_ID));
  const parentId = ui.currentFolderId;
  if (folders.find(folder => folder.id === parentId)?.parentId) throw new Error('폴더는 두 단계까지만 만들 수 있습니다.');
  const siblings = collectionFoldersIn(folders, parentId);
  const match = siblings.find(item => item.name.toLocaleLowerCase('ko-KR') === name.toLocaleLowerCase('ko-KR'));
  if (match) {
    const separate = nextAvailableStoryName(name, siblings.map(item => item.name), COLLECTION_FOLDER_NAME_MAX_LENGTH, true);
    const parent = folders.find(folder => folder.id === parentId);
    const location = parent ? `“${parent.name}” 폴더` : '최상위';
    const choice = await chooseNameConflict('콘묶음 폴더 이름 중복', `“${name}” 폴더가 이미 ${location}에 있습니다.\n폴더를 새로 만들지 않고 기존 폴더를 열거나 “${separate}”로 폴더를 새로 만들 수 있습니다.`,
      [{ id: match.id, label: match.name }], '기존 폴더 열기', '새로 만들기');
    if (!choice) return;
    if (choice.action === 'existing') { ui.currentFolderId = match.id; await render(ui); showToast(`기존 “${name}” 폴더를 열었습니다.`); return; }
    name = separate;
  }
  folders = normalizeCollectionFolders(await getOne('documents', COLLECTION_FOLDER_DOCUMENT_ID));
  if (parentId && !folders.some(folder => folder.id === parentId && !folder.parentId)) throw new Error('상위 폴더가 변경되었습니다.');
  name = validateCollectionFolderName(name, folders, '', parentId);
  await putOne('documents', makeCollectionFolderDocument([{
    id: `collection-folder_${crypto.randomUUID()}`, name, createdAt: Date.now(), ...(parentId ? { parentId } : {})
  }, ...folders]));
  refreshSidebar(); await render(ui);
  showToast(`“${name}” 콘묶음 폴더를 만들었습니다.`);
}

async function createCollection(ui) {
  const input = await showPrompt('새 콘묶음 이름을 입력하세요.', '', {
    title: '새 콘묶음', label: `콘묶음 이름 (최대 ${COLLECTION_NAME_MAX_LENGTH}자)`, confirmText: '만들기', maxLength: COLLECTION_NAME_MAX_LENGTH, note: COLLECTION_WARNING
  });
  if (input == null) return;
  let name = String(input).trim();
  if (!name) throw new Error('콘묶음 이름을 입력하세요.');
  const collections = await getAll('collections');
  const match = collections.find(item => item.name.toLocaleLowerCase('ko-KR') === name.toLocaleLowerCase('ko-KR'));
  if (match) {
    const folder = ui.folders.find(item => item.id === match.folderId);
    const parent = ui.folders.find(item => item.id === folder?.parentId);
    const location = [parent?.name, folder?.name].filter(Boolean).join(' / ');
    const separate = nextAvailableStoryName(name, collections.map(item => item.name), COLLECTION_NAME_MAX_LENGTH, true);
    const choice = await chooseNameConflict('콘묶음 이름 중복', `“${name}” 콘묶음이 이미 ${location ? `“${location}” 폴더` : '최상위'}에 있습니다.\n콘묶음을 새로 만들지 않고 기존 콘묶음을 열거나 “${separate}”로 콘묶음을 새로 만들 수 있습니다.`,
      [{ id: match.id, label: `${match.name} · 콘 ${match.items.length}개` }], '기존 콘묶음 열기', '새로 만들기');
    if (!choice) return;
    if (choice.action === 'existing') { await openCollection(ui, match.id); return; }
    name = separate;
  }
  if ((await getAll('collections')).some(item => item.name.toLocaleLowerCase('ko-KR') === name.toLocaleLowerCase('ko-KR'))) throw new Error('같은 이름의 콘묶음이 새로 생겼습니다. 다시 확인해주세요.');
  await createNamedCollection(name, ui.currentFolderId);
  await render(ui);
}

async function openCollection(ui, id) {
  const target = [...collectionList.querySelectorAll('.collection-row')].find(row => row.dataset.collectionId === id)?.querySelector('.collection-main');
  if (!target) throw new Error('열 콘묶음을 찾을 수 없습니다.');
  ui.dialog.close(); target.click();
}

function chooseFolderDeletion(name, containedCount, childCount = 0, selectedCollectionCount = 0) {
  const { dialog, body, footer } = createDialog('콘묶음 폴더 삭제', 'warning');
  const message = document.createElement('p'); message.className = 'hhj-ui-dialog-message';
  const subject = typeof name === 'number' ? `선택한 폴더 ${name}개` : `“${name}” 폴더`;
  message.textContent = `${subject}를 삭제합니다.\n폴더 안에 하위 폴더 ${childCount}개와 콘묶음 ${containedCount}개가 있습니다. 어떻게 처리할까요?`
    + (selectedCollectionCount ? `\n별도로 체크한 콘묶음 ${selectedCollectionCount}개는 삭제됩니다.` : '');
  body.append(message);
  const cancel = button('취소', 'cancel'); const keep = button('폴더 안 내용 남기기', 'keep', 'primary'); const remove = button('폴더 안 내용도 삭제', 'remove', 'danger-action');
  keep.dataset.tooltipTitle = '폴더 안 내용 남기기';
  keep.dataset.tooltipDescription = '폴더 안의 내용물은 같이 삭제되지 않고 상위 폴더로 이동합니다.\n만약 이동할 때 이름이 겹치는 폴더가 존재한다면 "이름 (2)" 처럼 폴더 이름에 번호가 붙습니다.';
  remove.dataset.tooltipTitle = '폴더 안 내용도 삭제';
  remove.dataset.tooltipDescription = '폴더 안의 내용물도 같이 지웁니다.';
  footer.append(cancel, keep, remove);
  footer.addEventListener('click', event => { const action = event.target.dataset.action; if (action) dialog.close(action); });
  return new Promise(resolve => {
    dialog.addEventListener('close', () => resolve(['keep', 'remove'].includes(dialog.returnValue) ? dialog.returnValue : null), { once: true });
    dialog.showModal(); queueMicrotask(() => cancel.focus());
  });
}

async function deleteItems(ui, collectionIds, folderIds, folderRow = false) {
  if (!collectionIds.length && !folderIds.length) throw new Error('삭제할 콘묶음이나 폴더를 하나 이상 선택하세요.');
  const [collections, doc] = await Promise.all([getAll('collections'), getOne('documents', COLLECTION_FOLDER_DOCUMENT_ID)]);
  const folders = normalizeCollectionFolders(doc);
  const selectedFolders = folders.filter(folder => folderIds.includes(folder.id));
  const selectedCollections = collections.filter(item => collectionIds.includes(item.id));
  if (selectedFolders.length !== folderIds.length || selectedCollections.length !== collectionIds.length) throw new Error('선택한 항목이 변경되었습니다. 다시 확인해주세요.');
  const affectedFolders = folders.filter(folder => folderIds.includes(folder.id) || folderIds.includes(folder.parentId));
  const affectedIds = new Set(affectedFolders.map(folder => folder.id));
  const contained = collections.filter(item => affectedIds.has(item.folderId));
  const childCount = affectedFolders.length - selectedFolders.length;
  const choice = contained.length || childCount
    ? await chooseFolderDeletion(folderIds.length === 1 ? selectedFolders[0].name : folderIds.length, contained.length, childCount, collectionIds.length) : 'keep';
  if (!choice) return;
  const total = new Set([...collectionIds, ...(choice === 'remove' ? contained.map(item => item.id) : [])]).size;
  const subject = folderIds.length ? `폴더 ${folderIds.length}개와 콘묶음 ${total}개` : `콘묶음 ${total}개`;
  const removeFolderContents = folderIds.length && choice === 'remove';
  const folderDetails = contained.length || childCount
    ? `\n폴더안의 하위 폴더 ${childCount}개와 콘묶음 ${contained.length}개는 ${choice === 'remove' ? '함께 삭제합니다.' : '상위 폴더로 옮겨 보존합니다.'}` : '';
  const message = folderRow && choice === 'keep' && (contained.length || childCount)
    ? `“${selectedFolders[0].name}” 폴더를 삭제합니다.\n삭제된 항목은 복구할 수 없습니다.\n폴더안의 하위 폴더 ${childCount}개와 콘묶음 ${contained.length}개는 상위 폴더로 옮겨 보존합니다.\n정말 삭제하시겠습니까?`
    : folderIds.length && !folderRow
    ? `선택된 폴더 ${folderIds.length}개와 콘묶음 ${collectionIds.length}개를 삭제합니다.\n삭제된 항목은 복구할 수 없습니다.${folderDetails}\n정말 삭제하시겠습니까?`
    : removeFolderContents
    ? `${folderIds.length === 1 ? `“${selectedFolders[0].name}” 폴더` : `선택한 폴더 ${folderIds.length}개`}와 하위 폴더 ${childCount}개, 콘묶음 ${total}개를 함께 삭제합니다.\n삭제된 콘묶음은 복구할 수 없습니다.\n정말 삭제하시겠습니까?`
    : folderRow
    ? `“${selectedFolders[0].name}” 빈 콘묶음 폴더를 삭제할까요?`
    : `${subject}를 삭제할까요?${choice === 'keep' && (contained.length || childCount) ? `\n폴더 안 내용은 상위 폴더로 옮깁니다.` : ''}\n삭제한 항목은 복구할 수 없습니다.`;
  const confirmed = !folderIds.length && collectionIds.length === 1
    ? await confirmNamedItemDeletion(selectedCollections[0].name, '콘묶음')
    : await showConfirm(message, removeFolderContents && folderRow
      ? { title: '폴더와 콘묶음 삭제', confirmText: '모두 삭제', danger: true }
      : { title: folderRow ? '콘묶음 폴더 삭제' : '선택 항목 삭제', confirmText: removeFolderContents ? '모두 삭제' : '삭제', danger: true });
  if (!confirmed) return;
  const [latestCollections, latestDoc] = await Promise.all([getAll('collections'), getOne('documents', COLLECTION_FOLDER_DOCUMENT_ID)]);
  const latestFolders = normalizeCollectionFolders(latestDoc);
  const watched = [...selectedCollections, ...contained];
  if (affectedFolders.length !== latestFolders.filter(folder => folderIds.includes(folder.id) || folderIds.includes(folder.parentId)).length
    || affectedFolders.some(item => !latestFolders.some(folder => folder.id === item.id && folder.name === item.name && folder.parentId === item.parentId))
    || watched.some(item => !latestCollections.some(current => current.id === item.id && current.updatedAt === item.updatedAt && current.folderId === item.folderId))) {
    throw new Error('선택한 항목이 변경되었습니다. 다시 확인한 뒤 삭제해주세요.');
  }
  const plan = planCollectionFolderSelectionRemoval(latestFolders, latestCollections, folderIds, collectionIds, choice === 'remove');
  if (plan.updates.length) await commitCollectionPlacements(plan.updates);
  if (plan.deleteIds.length) await deleteCollectionsByIds(plan.deleteIds);
  if (folderIds.length) await putOne('documents', plan.document);
  refreshSidebar(); await render(ui);
  showToast(`${subject}를 삭제했습니다.`);
}

async function renameItem(ui, kind, id) {
  if (kind === 'collection') {
    const current = ui.collections.find(item => item.id === id);
    if (!current) return;
    const input = await showPrompt('새 콘묶음 이름을 입력하세요.', current.name, {
      title: '콘묶음 이름 변경', label: `콘묶음 이름 (최대 ${COLLECTION_NAME_MAX_LENGTH}자)`, confirmText: '변경', maxLength: COLLECTION_NAME_MAX_LENGTH
    });
    if (input != null) { await renameCollectionById(id, input); await render(ui); }
    return;
  }
  const current = ui.folders.find(item => item.id === id);
  if (!current) return;
  const input = await showPrompt('새 콘묶음 폴더 이름을 입력하세요.', current.name, {
    title: '콘묶음 폴더 이름 변경', label: `폴더 이름 (최대 ${COLLECTION_FOLDER_NAME_MAX_LENGTH}자)`, confirmText: '변경', maxLength: COLLECTION_FOLDER_NAME_MAX_LENGTH
  });
  if (input == null) return;
  const folders = normalizeCollectionFolders(await getOne('documents', COLLECTION_FOLDER_DOCUMENT_ID));
  if (!folders.some(item => item.id === id && item.name === current.name)) throw new Error('폴더가 변경되었습니다. 다시 확인해주세요.');
  const name = validateCollectionFolderName(input, folders, id, current.parentId || '');
  await putOne('documents', makeCollectionFolderDocument(folders.map(item => item.id === id ? { ...item, name } : item)));
  refreshSidebar(); await render(ui);
}

async function moveCollections(ui, ids, folderId, beforeId = '') {
  const [collections, doc] = await Promise.all([getAll('collections'), getOne('documents', COLLECTION_FOLDER_DOCUMENT_ID)]);
  const folders = normalizeCollectionFolders(doc);
  const updates = planCollectionSelectionPlacement(collections, folders, ids, folderId, beforeId);
  if (updates.length) await commitCollectionPlacements(updates);
  await render(ui);
}

async function moveFolders(ui, ids, beforeId = '', parentId = ui.currentFolderId) {
  const folders = normalizeCollectionFolders(await getOne('documents', COLLECTION_FOLDER_DOCUMENT_ID));
  const next = planCollectionFolderSelectionPlacement(folders, ids, beforeId, parentId);
  if (next.length) { await putOne('documents', makeCollectionFolderDocument(next)); refreshSidebar(); }
  await render(ui);
}

function installDrag(ui) {
  let controlPress = false;
  ui.list.addEventListener('pointerdown', event => {
    controlPress = !!event.target.closest('[data-item-id]') && !!event.target.closest('input, .story-save-actions');
  });
  ui.list.addEventListener('dragstart', event => {
    const row = event.target.closest('[data-item-id]');
    if (!row || !event.dataTransfer || controlPress) { event.preventDefault(); return; }
    const kind = row.dataset.kind;
    const checked = selectedIds(ui, kind);
    const ids = checked.includes(row.dataset.itemId) ? (kind === 'folder' ? collectionFoldersIn(ui.folders, ui.currentFolderId) : sortCollectionsInFolder(ui.collections, ui.folders, ui.currentFolderId))
      .filter(item => checked.includes(item.id)).map(item => item.id) : [row.dataset.itemId];
    ui.drag = { kind, ids };
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(kind === 'folder' ? 'application/x-hhj-collection-folder' : 'application/x-hhj-collection', row.dataset.itemId);
    ui.parentDrop.hidden = !ui.currentFolderId;
  });
  ui.dialog.addEventListener('dragend', () => { ui.drag = null; ui.parentDrop.hidden = true; clearGuide(ui); });
  const guide = event => {
    if (!ui.drag) return;
    const folder = event.target.closest('.story-folder-row');
    const collection = event.target.closest('.story-save-row');
    const parent = event.target.closest('.story-save-parent-drop');
    const list = event.target === ui.list || event.target.closest('.story-save-empty');
    if (ui.drag.kind === 'folder' ? !folder && !parent && !list : !folder && !collection && !parent && !list) return;
    event.preventDefault(); event.dataTransfer.dropEffect = 'move'; clearGuide(ui);
    const row = folder || collection;
    if (parent || folder && ui.drag.kind === 'collection') (parent || folder).classList.add('story-drop-folder');
    else if (folder && ui.drag.kind === 'folder' && !ui.currentFolderId
      && event.clientY >= folder.getBoundingClientRect().top + folder.getBoundingClientRect().height * .25
      && event.clientY <= folder.getBoundingClientRect().bottom - folder.getBoundingClientRect().height * .25
      && !ui.drag.ids.includes(folder.dataset.itemId)) {
      folder.classList.add(ui.drag.ids.some(id => collectionFoldersIn(ui.folders, id).length)
        ? 'story-drop-blocked' : 'story-drop-folder');
    }
    else if (row) row.classList.add(event.clientY < row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2 ? 'story-drop-before' : 'story-drop-after');
    else ui.list.classList.add('story-drop-end');
  };
  ui.dialog.addEventListener('dragenter', guide);
  ui.dialog.addEventListener('dragover', guide);
  ui.dialog.addEventListener('drop', event => {
    if (!ui.drag) return;
    const folder = event.target.closest('.story-folder-row');
    const collection = event.target.closest('.story-save-row');
    const parent = event.target.closest('.story-save-parent-drop');
    const list = event.target === ui.list || event.target.closest('.story-save-empty');
    if (ui.drag.kind === 'folder' ? !folder && !parent && !list : !folder && !collection && !parent && !list) return;
    event.preventDefault(); event.stopPropagation();
    const { kind, ids } = ui.drag;
    ui.drag = null; ui.parentDrop.hidden = true; clearGuide(ui);
    const before = row => event.clientY < row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2;
    if (kind === 'folder') {
      const visible = collectionFoldersIn(ui.folders, ui.currentFolderId);
      const index = folder ? visible.findIndex(item => item.id === folder.dataset.itemId) : -1;
      const bounds = folder?.getBoundingClientRect();
      const nest = folder && !ui.currentFolderId && event.clientY >= bounds.top + bounds.height * .25
        && event.clientY <= bounds.bottom - bounds.height * .25 && !ids.includes(folder.dataset.itemId);
      const targetParentId = parent ? ui.parentFolderId : nest ? folder.dataset.itemId : ui.currentFolderId;
      const beforeId = folder && !nest ? before(folder) ? folder.dataset.itemId : visible[index + 1]?.id || '' : '';
      moveFolders(ui, ids, beforeId, targetParentId).catch(error => alert(`폴더를 이동할 수 없습니다.\n${error.message || error}`));
    } else {
      const targetFolderId = folder?.dataset.itemId || (parent ? ui.parentFolderId : ui.currentFolderId);
      const visible = sortCollectionsInFolder(ui.collections, ui.folders, ui.currentFolderId);
      const index = collection ? visible.findIndex(item => item.id === collection.dataset.itemId) : -1;
      const beforeId = collection ? before(collection) ? collection.dataset.itemId : visible[index + 1]?.id || '' : '';
      moveCollections(ui, ids, targetFolderId, beforeId).catch(error => alert(error.message || error));
    }
  });
}

async function openManager() {
  const ui = makeDialog();
  const fail = (task, label) => Promise.resolve().then(task).catch(error => {
    const message = String(error.message || error);
    alert(message.startsWith(`${label}\n`) ? message : `${label}\n${message}`);
  });
  const onImport = () => fail(() => { ui.currentFolderId = ''; return render(ui); }, '목록을 표시할 수 없습니다.');
  importInput?.addEventListener('hhjcon:collection-imported', onImport);
  ui.dialog.addEventListener('close', () => importInput?.removeEventListener('hhjcon:collection-imported', onImport), { once: true });
  ui.selectAll.addEventListener('change', () => {
    ui.list.querySelectorAll('input[data-kind]').forEach(input => { input.checked = ui.selectAll.checked; });
    syncSelectAll(ui);
  });
  ui.list.addEventListener('change', event => { if (event.target.matches('input[data-kind]')) syncSelectAll(ui); });
  ui.dialog.addEventListener('keydown', event => {
    if (event.target.closest('input, textarea, [contenteditable="true"]')) return;
    if (!(event.ctrlKey || event.metaKey) || !['c', 'v'].includes(event.key.toLowerCase())) return;
    event.preventDefault();
    ui.dialog.querySelector(`[data-action="${event.key.toLowerCase() === 'c' ? 'copy' : 'paste'}"]`).click();
  });
  ui.dialog.addEventListener('click', event => {
    const action = event.target.closest('button[data-action]')?.dataset.action;
    if (!action) return;
    const row = event.target.closest('[data-item-id]');
    const id = row?.dataset.itemId;
    if (action === 'close') ui.dialog.close();
    else if (action === 'up') { ui.currentFolderId = ui.parentFolderId; fail(() => render(ui), '목록을 표시할 수 없습니다.'); }
    else if (action === 'open-folder') { ui.currentFolderId = id; fail(() => render(ui), '폴더를 열 수 없습니다.'); }
    else if (action === 'open-collection') fail(() => openCollection(ui, id), '콘묶음을 열 수 없습니다.');
    else if (action === 'new-folder') fail(() => createFolder(ui), '폴더를 만들 수 없습니다.');
    else if (action === 'new-collection') fail(() => createCollection(ui), '콘묶음을 만들 수 없습니다.');
    else if (action === 'rename-folder' || action === 'rename-collection') fail(() => renameItem(ui, row.dataset.kind, id), '이름을 바꿀 수 없습니다.');
    else if (action === 'delete-folder' || action === 'delete-collection') fail(() => deleteItems(ui, action === 'delete-collection' ? [id] : [], action === 'delete-folder' ? [id] : [], action === 'delete-folder'), '항목을 삭제할 수 없습니다.');
    else if (action === 'delete-selected') fail(() => deleteItems(ui, selectedIds(ui, 'collection'), selectedIds(ui, 'folder')), '항목을 삭제할 수 없습니다.');
    else if (action === 'export-folder' || action === 'export-collection') fail(() => exportCollectionSelection(action === 'export-collection' ? [id] : [], action === 'export-folder' ? [id] : []), '항목을 내보낼 수 없습니다.');
    else if (action === 'export-selected') fail(() => exportCollectionSelection(selectedIds(ui, 'collection'), selectedIds(ui, 'folder')), '항목을 내보낼 수 없습니다.');
    else if (action === 'import') importInput?.click();
    else if (action === 'select-folders' || action === 'select-collections' || action === 'select-clear') {
      ui.list.querySelectorAll('input[data-kind]').forEach(input => { input.checked = action === `select-${input.dataset.kind === 'folder' ? 'folders' : 'collections'}`; });
      ui.menu.open = false; syncSelectAll(ui);
    } else if (action === 'copy') {
      ui.clipboard = selectedIds(ui, 'collection');
      if (!ui.clipboard.length) return alert('복사할 콘묶음을 선택하세요. 폴더 자체는 복사하지 않습니다.');
      ui.dialog.querySelector('[data-action="paste"]').disabled = false;
      showToast(`${ui.clipboard.length}개 콘묶음을 복사했습니다. 원하는 폴더에서 붙여넣으세요.`);
    } else if (action === 'paste') fail(async () => {
      const copies = await copyCollectionsByIds(ui.clipboard, ui.currentFolderId);
      await render(ui); showToast(`${copies.length}개 콘묶음을 붙여넣었습니다.`);
    }, '콘묶음을 붙여넣을 수 없습니다.');
  });
  installDrag(ui);
  await render(ui);
  ui.dialog.showModal();
}

manageButton?.addEventListener('click', () => openManager().catch(error => alert(`콘묶음 관리창을 열 수 없습니다.\n${error.message || error}`)));
