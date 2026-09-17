import { applyMany, deleteOne, getAll, getOne, putMany, putOne } from '../db.js?v=20260915-1';
import { downloadJson, makeDatedDefaultName, makeTimestampedBackupName, sanitizeDownloadName } from '../core/json-download.js?v=20260909-3';
import { chooseNameConflict, createDialog, showConfirm, showPrompt } from '../ui/action-dialogs.js?v=20260917-2';
import { saveToastForReload, showToast } from '../ui/toast.js?v=20260909-2';
import { FORMAT, VERSION, exportBundle, exportSave, filtered, normalizeConRef, parseImportData } from './story-save-format.js?v=20260915-2';
import {
  makeStoryFolderDocument,
  nextAvailableStoryName,
  nextStorySaveOrder,
  normalizeStoryFolderId,
  normalizeStoryFolders,
  planStoryFolderPlacement,
  planStoryFolderRemoval,
  planStoryFolderSelectionRemoval,
  planStorySavePlacement,
  sortStorySavesInFolder,
  STORY_FOLDER_DOCUMENT_ID,
  STORY_FOLDER_NAME_MAX_LENGTH,
  validateStoryFolderName
} from './story-save-folders.js?v=20260917-1';

const PREFIX = 'story-save:';
const DOCS = {
  rich: 'rich-text-v1',
  display: 'con-display-v1',
  breaks: 'break-count-v1',
  memo: 'image-marker-memo-v1'
};
const HEIGHT_KEY = 'hhjcon-rich-text-heights-v1';
const NAME_KEY = 'hhjcon-story-save-name';
const FOLDER_KEY = 'hhjcon-story-save-folder';
const STORY_WARNING = '(저장한 원고는 브라우저 데이터 삭제시 지워집니다. 원고 내보내기로 백업을 해두십시오.)';
const storyList = document.getElementById('storyList');
const editorActions = document.querySelector('.editor-header > div:last-child');
const clearButton = document.getElementById('clearStoryBtn');
let storyNameInput = null;

function rememberSaveTarget(name, folderId = '') {
  if (storyNameInput) {
    storyNameInput.value = name;
    storyNameInput.dataset.folderId = folderId;
  }
  try {
    localStorage.setItem(NAME_KEY, name);
    localStorage.setItem(FOLDER_KEY, folderId);
  } catch { /* 저장소를 사용할 수 없어도 현재 화면에서는 이름을 유지한다. */ }
}

const clone = value => structuredClone(value);
const asObject = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};

function readHeights(ids) {
  try {
    return filtered(JSON.parse(localStorage.getItem(HEIGHT_KEY) || '{}'), ids);
  } catch {
    return {};
  }
}

async function getSaves() {
  return (await getAll('documents'))
    .filter(v => v?.format === FORMAT && Number(v.version) === VERSION && String(v.id || '').startsWith(PREFIX))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

async function getFolders() {
  return normalizeStoryFolders(await getOne('documents', STORY_FOLDER_DOCUMENT_ID));
}

async function captureSave(name, folderId = '', oldSave = null, sortOrder = undefined) {
  await new Promise(resolve => setTimeout(resolve, 220));
  const [story, rich, display, breaks, memo, cons, packages] = await Promise.all([
    getOne('documents', 'current'), getOne('documents', DOCS.rich), getOne('documents', DOCS.display),
    getOne('documents', DOCS.breaks), getOne('documents', DOCS.memo), getAll('cons'), getAll('packages')
  ]);
  const items = clone(Array.isArray(story?.items) ? story.items : []);
  if (!items.length) throw new Error('저장할 원고가 없습니다.');
  const ids = new Set(items.map(item => item.id));
  const conMap = new Map(cons.map(con => [con.id, con]));
  const packageMap = new Map(packages.map(pkg => [pkg.id, pkg]));
  const conRefs = {};
  items.forEach(item => {
    if (item.type !== 'con') return;
    const con = conMap.get(item.conId);
    const pkg = con ? packageMap.get(con.packageId) : null;
    const ref = con ? {
      sourceNo: String(con.sourceNo || ''),
      packageId: String(con.packageId || ''),
      sourcePackageId: String(pkg?.sourcePackageId || con.packageId || ''),
      name: String(con.name || ''),
      packageName: String(pkg?.name || '')
    } : normalizeConRef(item.conRef);
    if (ref) conRefs[item.conId] = ref;
  });
  const now = Date.now();
  return {
    id: oldSave?.id || `${PREFIX}${crypto.randomUUID()}`,
    format: FORMAT,
    version: VERSION,
    name,
    folderId,
    ...(Number.isFinite(sortOrder) ? { sortOrder } : {}),
    createdAt: oldSave?.createdAt || now,
    updatedAt: now,
    story: { items, updatedAt: Number(story?.updatedAt) || now },
    metadata: {
      rich: filtered(rich?.items, ids),
      display: filtered(display?.items, ids),
      breaks: filtered(breaks?.items, ids),
      memo: filtered(memo?.items, ids),
      heights: readHeights(ids)
    },
    conRefs
  };
}

function makeImportedSave(parsed, names, folderId = '', sortOrder = undefined) {
  const name = nextAvailableStoryName(parsed.name, names);
  names.add(name);
  const now = Date.now();
  return {
    id: `${PREFIX}${crypto.randomUUID()}`,
    format: FORMAT,
    version: VERSION,
    name,
    folderId,
    ...(Number.isFinite(sortOrder) ? { sortOrder } : {}),
    createdAt: now,
    updatedAt: now,
    story: parsed.story,
    metadata: parsed.metadata,
    conRefs: parsed.conRefs
  };
}

async function storeImportedSave(parsed, names) {
  const sortOrder = nextStorySaveOrder(await getSaves(), await getFolders(), '');
  await putOne('documents', makeImportedSave(parsed, names, '', sortOrder));
}

function doc(id, items) {
  return { id, version: 1, items: clone(asObject(items)), updatedAt: Date.now() };
}

async function loadSave(save) {
  const current = await getOne('documents', 'current');
  if (current?.items?.length) {
    const ok = await showConfirm('현재 작성 중인 원고가 선택한 저장 원고로 교체됩니다.\n남겨둘 현재 버전이 있다면 먼저 원고 저장을 해주세요.\n\n계속 불러올까요?', {
      title: '원고 불러오기', confirmText: '불러오기', tone: 'warning'
    });
    if (!ok) return;
  }
  await new Promise(resolve => setTimeout(resolve, 220));
  const cons = await getAll('cons');
  const byId = new Map(cons.map(con => [con.id, con]));
  const byNo = new Map(cons.filter(con => con.sourceNo).map(con => [String(con.sourceNo), con]));
  const story = clone(save.story);
  story.items.forEach(item => {
    if (item.type !== 'con') return;
    const ref = normalizeConRef(item.conRef || save.conRefs?.[item.conId]);
    if (ref) item.conRef = ref;
    if (byId.has(item.conId)) return;
    const match = ref?.sourceNo ? byNo.get(String(ref.sourceNo)) : null;
    if (match) item.conId = match.id;
  });
  story.id = 'current';
  story.updatedAt = Date.now();
  const m = asObject(save.metadata);
  await Promise.all([
    putOne('documents', story), putOne('documents', doc(DOCS.rich, m.rich)), putOne('documents', doc(DOCS.display, m.display)),
    putOne('documents', doc(DOCS.breaks, m.breaks)), putOne('documents', doc(DOCS.memo, m.memo))
  ]);
  localStorage.setItem(HEIGHT_KEY, JSON.stringify(asObject(m.heights)));
  rememberSaveTarget(save.name, save.folderId || '');
  saveToastForReload(`“${save.name}” 원고를 불러왔습니다.`);
  location.reload();
}

function createFolderSelect(folders, initialFolderId = '') {
  const choices = [{ id: '', name: '최상위' }, ...folders];
  let value = normalizeStoryFolderId(initialFolderId, folders);
  let activeIndex = Math.max(0, choices.findIndex(choice => choice.id === value));
  const field = document.createElement('div');
  field.className = 'hhj-ui-dialog-field story-folder-field';
  const label = document.createElement('span');
  label.textContent = '저장 위치';
  const select = document.createElement('div');
  select.className = 'story-folder-select';
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'story-folder-select-trigger';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  const list = document.createElement('div');
  const listId = `story-folder-list-${crypto.randomUUID()}`;
  list.id = listId;
  list.className = 'story-folder-select-list';
  list.setAttribute('role', 'listbox');
  list.hidden = true;
  trigger.setAttribute('aria-controls', listId);
  const options = choices.map((choice, index) => {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'story-folder-select-option';
    option.setAttribute('role', 'option');
    option.dataset.value = choice.id;
    option.textContent = choice.name;
    option.addEventListener('click', () => choose(index));
    option.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        activeIndex = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1
          : (activeIndex + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
        options[activeIndex].focus();
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        choose(index);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close(true);
      }
    });
    list.append(option);
    return option;
  });

  function update() {
    trigger.textContent = choices.find(choice => choice.id === value)?.name || '최상위';
    options.forEach((option, index) => option.setAttribute('aria-selected', String(choices[index].id === value)));
  }

  function open() {
    list.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    activeIndex = Math.max(0, choices.findIndex(choice => choice.id === value));
    queueMicrotask(() => options[activeIndex].focus());
  }

  function close(refocus = false) {
    list.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (refocus) trigger.focus();
  }

  function choose(index) {
    activeIndex = index;
    value = choices[index].id;
    update();
    close(true);
  }

  trigger.addEventListener('click', () => list.hidden ? open() : close());
  trigger.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (list.hidden) open();
    } else if (event.key === 'Escape' && !list.hidden) {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  });
  const closeOutside = event => { if (!select.contains(event.target)) close(); };
  document.addEventListener('pointerdown', closeOutside, true);
  update();
  select.append(trigger, list);
  field.append(label, select);
  return { element: field, getValue: () => value, dispose: () => document.removeEventListener('pointerdown', closeOutside, true) };
}

function appendStoryWarning(body) {
  const note = document.createElement('p');
  note.className = 'hhj-ui-dialog-note';
  note.textContent = STORY_WARNING;
  body.append(note);
}

function showSavePrompt(folders, initialName = '', initialFolderId = '') {
  const { dialog, body, footer } = createDialog('원고 저장');
  const message = document.createElement('p');
  message.className = 'hhj-ui-dialog-message';
  message.textContent = '저장할 콘문학 이름과 위치를 선택하세요.';
  const field = document.createElement('label');
  field.className = 'hhj-ui-dialog-field';
  const label = document.createElement('span');
  label.textContent = '원고 이름';
  const input = document.createElement('input');
  input.type = 'text';
  input.value = initialName || makeDatedDefaultName('콘문학');
  input.maxLength = 80;
  const error = document.createElement('div');
  error.className = 'hhj-ui-dialog-error';
  field.append(label, input, error);
  const folderSelect = createFolderSelect(folders, initialFolderId);
  body.append(message, field, folderSelect.element);
  appendStoryWarning(body);
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.textContent = '취소';
  const confirm = document.createElement('button');
  confirm.type = 'button';
  confirm.className = 'primary';
  confirm.textContent = '저장';
  footer.append(cancel, confirm);
  const submit = () => {
    const name = input.value.trim();
    if (!name) {
      error.textContent = '콘문학 이름을 입력하세요.';
      input.focus();
      return;
    }
    dialog.dataset.name = name;
    dialog.dataset.folderId = folderSelect.getValue();
    dialog.close('confirm');
  };
  cancel.addEventListener('click', () => dialog.close('cancel'));
  confirm.addEventListener('click', submit);
  input.addEventListener('input', () => { error.textContent = ''; });
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.isComposing) {
      event.preventDefault();
      submit();
    }
  });
  return new Promise(resolve => {
    dialog.addEventListener('close', () => {
      folderSelect.dispose();
      resolve(dialog.returnValue === 'confirm' ? { name: dialog.dataset.name, folderId: dialog.dataset.folderId || '' } : null);
    }, { once: true });
    dialog.showModal();
    queueMicrotask(() => { input.focus(); input.select(); });
  });
}

async function saveCurrent() {
  const folders = await getFolders();
  const draftName = storyNameInput?.value.trim() || '';
  const input = await showSavePrompt(folders, draftName,
    draftName ? normalizeStoryFolderId(storyNameInput.dataset.folderId, folders) : '');
  if (!input) return false;
  const { name, folderId } = input;
  const saves = await getSaves();
  const matches = saves.filter(save => save.name === name);
  let targetName = name;
  let targetFolderId = folderId;
  let oldSave = null;
  if (matches.length) {
    const separateName = nextAvailableStoryName(name, saves.map(save => save.name), 80);
    const targets = matches.map(save => ({ id: save.id,
      label: `${folders.find(folder => folder.id === save.folderId)?.name || '최상위'} · ${save.story?.items?.length || 0}블록 · ${new Date(save.updatedAt).toLocaleString('ko-KR')} · ${save.id.slice(-6)}` }));
    const locations = [...new Set(matches.map(save => {
      const folder = folders.find(folder => folder.id === save.folderId);
      return folder ? `“${folder.name}” 폴더` : '최상위';
    }))];
    const where = locations.length === 1 ? `${locations[0]}에 있습니다.` : `다음 위치에 있습니다: ${locations.join(', ')}.`;
    const choice = await chooseNameConflict('원고 이름 중복',
      `“${name}” 원고가 이미 ${where}\n덮어쓰면 기존 원고의 저장 위치가 유지됩니다. 별도 저장을 선택하면 “${separateName}”로 저장합니다.`,
      targets, '덮어쓰기', '별도 저장');
    if (!choice) return false;
    if (choice.action === 'separate') targetName = separateName;
    else {
      oldSave = matches.find(save => save.id === choice.id);
      targetFolderId = normalizeStoryFolderId(oldSave.folderId, folders);
    }
  }
  try {
    if (targetFolderId && !(await getFolders()).some(folder => folder.id === targetFolderId)) {
      throw new Error('저장할 폴더가 변경되었습니다. 다시 저장해주세요.');
    }
    const sortOrder = oldSave?.sortOrder ?? nextStorySaveOrder(saves, folders, targetFolderId);
    const record = await captureSave(targetName, targetFolderId, oldSave, sortOrder);
    const latestSaves = await getSaves();
    if (oldSave) {
      const latest = latestSaves.find(save => save.id === oldSave.id);
      if (!latest || latest.name !== oldSave.name || latest.folderId !== oldSave.folderId || latest.updatedAt !== oldSave.updatedAt) {
        throw new Error('덮어쓸 원고가 변경되었습니다. 다시 확인한 뒤 저장해주세요.');
      }
    } else if (latestSaves.some(save => save.name === targetName)) {
      throw new Error('같은 이름의 원고가 새로 생겼습니다. 다시 저장해주세요.');
    }
    await putOne('documents', record);
    rememberSaveTarget(targetName, targetFolderId);
    showToast(oldSave ? `“${targetName}” 원고를 덮어썼습니다.` : `“${targetName}” 원고를 저장했습니다.`);
    return true;
  } catch (error) {
    alert(error.message || '원고를 저장할 수 없습니다.');
    return false;
  }
}

function stats(save) {
  const items = save.story?.items || [];
  const cons = items.filter(v => v.type === 'con').length;
  const texts = items.filter(v => v.type === 'text').length;
  return `${items.length}블록 · 콘 ${cons} · 텍스트 ${texts} · ${new Date(save.updatedAt).toLocaleString('ko-KR')}`;
}

function confirmStoryDeletion(firstLine) {
  return showConfirm(`${firstLine}\n삭제된 원고는 복구할 수 없습니다.\n정말 삭제하시겠습니까?`, {
    title: '원고 삭제', confirmText: '삭제', danger: true
  });
}

function chooseStoryFolderDeletion(name, count, selectedSaveCount = 0) {
  const { dialog, body, footer } = createDialog('원고 폴더 삭제', 'danger');
  const message = document.createElement('p');
  message.className = 'hhj-ui-dialog-message';
  const subject = typeof name === 'number' ? `선택한 원고 폴더 ${name}개` : `“${name}” 폴더`;
  message.textContent = `${subject}를 삭제합니다.\n폴더 안의 원고 ${count}개를 어떻게 처리할까요?`
    + (selectedSaveCount ? `\n별도로 체크한 원고 ${selectedSaveCount}개는 삭제됩니다.` : '');
  body.append(message);
  const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = '취소';
  const keep = document.createElement('button'); keep.type = 'button'; keep.textContent = '폴더 안 원고 남기기';
  const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'danger-action'; remove.textContent = '폴더 안 원고도 삭제';
  footer.append(cancel, keep, remove);
  cancel.addEventListener('click', () => dialog.close('cancel'));
  keep.addEventListener('click', () => dialog.close('keep'));
  remove.addEventListener('click', () => dialog.close('remove'));
  return new Promise(resolve => {
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'keep' || dialog.returnValue === 'remove' ? dialog.returnValue : null), { once: true });
    dialog.showModal();
    queueMicrotask(() => cancel.focus());
  });
}

function makeDialog() {
  const dialog = document.createElement('dialog');
  dialog.className = 'story-save-dialog';
  const head = document.createElement('div');
  head.className = 'story-save-head';
  head.innerHTML = '<strong>원고 목록</strong>';
  const headActions = document.createElement('div');
  headActions.className = 'story-save-head-actions';
  const close = document.createElement('button');
  close.type = 'button'; close.className = 'icon-button'; close.textContent = '×'; close.title = '닫기';
  const save = document.createElement('button'); save.type = 'button'; save.className = 'primary'; save.textContent = '현재 원고 저장';
  const newFolder = document.createElement('button'); newFolder.type = 'button'; newFolder.textContent = '+ 새 폴더';
  headActions.append(head.querySelector('strong'), save, newFolder);
  head.append(headActions, close);

  const deleteSelected = document.createElement('button'); deleteSelected.type = 'button'; deleteSelected.className = 'danger'; deleteSelected.textContent = '선택 항목 삭제';

  const selectionTools = document.createElement('div');
  selectionTools.className = 'story-save-selection-tools';
  const selectGroup = document.createElement('div'); selectGroup.className = 'story-save-select-group';
  const selectAll = document.createElement('input'); selectAll.type = 'checkbox'; selectAll.setAttribute('aria-label', '현재 목록 전체 선택');
  const selectionMenu = document.createElement('details'); selectionMenu.className = 'story-save-select-menu';
  const summary = document.createElement('summary'); summary.textContent = '▾'; summary.setAttribute('aria-label', '선택 종류');
  const options = document.createElement('div'); options.className = 'story-save-select-options';
  for (const [action, text] of [['folders', '폴더 선택'], ['saves', '원고 선택'], ['clear', '선택 해제']]) {
    const button = document.createElement('button'); button.type = 'button'; button.dataset.select = action; button.textContent = text;
    options.append(button);
  }
  selectionMenu.append(summary, options); selectGroup.append(selectAll, selectionMenu);
  const exportSelected = document.createElement('button'); exportSelected.type = 'button'; exportSelected.className = 'primary'; exportSelected.textContent = '선택 항목 내보내기';
  const label = document.createElement('label'); label.className = 'file-button'; label.textContent = '원고 백업 불러오기';
  const input = document.createElement('input'); input.type = 'file'; input.multiple = true; input.accept = 'application/json,.json,.hhjconstory,.hhjconstories';
  label.append(input);
  selectionTools.append(selectGroup, deleteSelected, exportSelected, label);

  const location = document.createElement('div');
  location.className = 'story-save-location';
  const up = document.createElement('button');
  up.type = 'button';
  up.textContent = '← 최상위';
  const locationName = document.createElement('span');
  const parentDrop = document.createElement('div'); parentDrop.className = 'story-save-parent-drop'; parentDrop.hidden = true;
  parentDrop.textContent = '원고를 놓으면 최상위로 이동';
  location.append(up, locationName, parentDrop);

  const list = document.createElement('div'); list.className = 'story-save-list';
  const warning = document.createElement('div');
  warning.className = 'story-save-warning';
  warning.textContent = STORY_WARNING;
  dialog.append(head, selectionTools, location, list, warning); document.body.append(dialog);
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener('pointerdown', e => { if (!selectionMenu.contains(e.target)) selectionMenu.open = false; }, true);
  dialog.addEventListener('keydown', e => {
    if (e.key === 'Escape' && selectionMenu.open) { e.preventDefault(); e.stopPropagation(); selectionMenu.open = false; }
  }, true);
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  return { dialog, list, save, newFolder, deleteSelected, input, selectAll, selectionMenu, exportSelected, up, parentDrop, locationName, currentFolderId: '', draggedSaveIds: [], draggedFolderIds: [] };
}

function clearStoryDropGuide(ui) {
  ui.dialog.querySelectorAll('.story-drop-before, .story-drop-after, .story-drop-folder, .story-drop-end')
    .forEach(element => element.classList.remove('story-drop-before', 'story-drop-after', 'story-drop-folder', 'story-drop-end'));
}

function acceptStorySaveDrag(event, ui, element, className) {
  if (!ui.draggedSaveIds.length) return false;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  clearStoryDropGuide(ui);
  element.classList.add(className);
  return true;
}

function acceptStoryFolderDrag(event, ui, element, className) {
  if (!ui.draggedFolderIds.length) return false;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  clearStoryDropGuide(ui);
  element.classList.add(className);
  return true;
}

async function dropStoryFolders(ui, beforeId, ids = ui.draggedFolderIds) {
  ui.draggedFolderIds = [];
  clearStoryDropGuide(ui);
  const folders = await getFolders();
  const next = planStoryFolderPlacement(folders, ids, beforeId);
  if (!next.length) return;
  await putOne('documents', makeStoryFolderDocument(next));
  showToast(`${ids.length}개 원고 폴더의 순서를 변경했습니다.`);
  await renderList(ui);
}

async function dropStorySaves(ui, folderId, beforeId = '', ids = ui.draggedSaveIds) {
  ui.draggedSaveIds = [];
  ui.parentDrop.hidden = true;
  clearStoryDropGuide(ui);
  const [saves, folders] = await Promise.all([getSaves(), getFolders()]);
  const updates = planStorySavePlacement(saves, folders, ids, folderId, beforeId);
  if (!updates.length) return;
  await putMany('documents', updates);
  showToast(folderId === ui.currentFolderId ? '원고 순서를 변경했습니다.' : `${ids.length}개 원고를 이동했습니다.`);
  await renderList(ui);
}

function syncSelectionCheckbox(ui) {
  const items = [...ui.list.querySelectorAll('.story-save-check, .story-folder-check')];
  const selected = items.filter(input => input.checked).length;
  ui.selectAll.disabled = !items.length;
  ui.selectAll.checked = !!items.length && selected === items.length;
  ui.selectAll.indeterminate = selected > 0 && selected < items.length;
}

async function renderList(ui) {
  const [saves, folders] = await Promise.all([getSaves(), getFolders()]);
  ui.currentFolderId = normalizeStoryFolderId(ui.currentFolderId, folders);
  const currentFolder = folders.find(folder => folder.id === ui.currentFolderId);
  ui.up.hidden = !currentFolder;
  ui.parentDrop.hidden = true;
  ui.locationName.textContent = `현재 위치: ${currentFolder?.name || '최상위'}`;
  ui.list.replaceChildren();
  if (!currentFolder) folders.forEach((folder, folderIndex) => {
    const row = document.createElement('div');
    row.className = 'story-folder-row';
    const handle = document.createElement('button'); handle.type = 'button'; handle.className = 'story-save-drag-handle'; handle.draggable = true;
    handle.textContent = '⋮⋮'; handle.title = '폴더 순서 변경'; handle.setAttribute('aria-label', `${folder.name} 폴더 드래그`);
    const check = document.createElement('input'); check.type = 'checkbox'; check.className = 'story-folder-check'; check.value = folder.id;
    check.setAttribute('aria-label', `${folder.name} 폴더 선택`);
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'story-folder-main';
    const name = document.createElement('strong');
    name.textContent = `📁 ${folder.name}`;
    const count = document.createElement('small');
    count.textContent = `${saves.filter(save => normalizeStoryFolderId(save.folderId, folders) === folder.id).length}개 원고`;
    open.append(name, count);
    const actions = document.createElement('div');
    actions.className = 'story-save-actions';
    const exp = document.createElement('button'); exp.type = 'button'; exp.textContent = '내보내기';
    const rename = document.createElement('button'); rename.type = 'button'; rename.textContent = '이름 변경';
    const del = document.createElement('button'); del.type = 'button'; del.className = 'danger'; del.textContent = '삭제';
    actions.append(exp, rename, del);
    row.append(check, handle, open, actions);
    ui.list.append(row);
    handle.addEventListener('dragstart', event => {
      const checked = selectedFolderIds(ui.list);
      ui.draggedFolderIds = checked.has(folder.id) ? folders.filter(item => checked.has(item.id)).map(item => item.id) : [folder.id];
      ui.draggedSaveIds = [];
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('application/x-hhj-story-folder', folder.id);
    });
    handle.addEventListener('dragend', () => { ui.draggedFolderIds = []; clearStoryDropGuide(ui); });
    const guideFolderRowDrop = event => {
      if (!ui.draggedFolderIds.length) return acceptStorySaveDrag(event, ui, row, 'story-drop-folder');
      const before = event.clientY < row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2;
      acceptStoryFolderDrag(event, ui, row, before ? 'story-drop-before' : 'story-drop-after');
    };
    row.addEventListener('dragenter', guideFolderRowDrop);
    row.addEventListener('dragover', guideFolderRowDrop);
    row.addEventListener('drop', event => {
      if (ui.draggedFolderIds.length) {
        event.preventDefault(); event.stopPropagation();
        const before = event.clientY < row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2;
        const beforeId = before ? folder.id : folders[folderIndex + 1]?.id || '';
        dropStoryFolders(ui, beforeId).catch(error => alert(`폴더 순서를 변경할 수 없습니다.\n${error.message || error}`));
        return;
      }
      if (!ui.draggedSaveIds.length) return;
      event.preventDefault(); event.stopPropagation();
      dropStorySaves(ui, folder.id, sortStorySavesInFolder(saves, folders, folder.id)[0]?.id || '')
        .catch(error => alert(`원고를 이동할 수 없습니다.\n${error.message || error}`));
    });
    open.addEventListener('click', () => { ui.currentFolderId = folder.id; renderList(ui); });
    exp.addEventListener('click', async () => {
      try {
        const [latestSaves, latestFolders] = await Promise.all([getSaves(), getFolders()]);
        const latestFolder = latestFolders.find(item => item.id === folder.id);
        if (!latestFolder) throw new Error('원고 폴더를 찾을 수 없습니다.');
        const contained = sortStorySavesInFolder(latestSaves, latestFolders, folder.id);
        downloadJson(`${sanitizeDownloadName(latestFolder.name, '원고 폴더')}.hhjconstories.json`, exportBundle(contained, latestFolder.name));
        showToast(`“${latestFolder.name}” 폴더와 원고 ${contained.length}개를 내보냈습니다.`);
      } catch (error) { alert(`원고 폴더를 내보낼 수 없습니다.\n${error.message || error}`); }
    });
    rename.addEventListener('click', async () => {
      const next = await showPrompt('새 원고 폴더 이름을 입력하세요.', folder.name, {
        title: '원고 폴더 이름 변경', label: `폴더 이름 (최대 ${STORY_FOLDER_NAME_MAX_LENGTH}자)`, confirmText: '변경', maxLength: STORY_FOLDER_NAME_MAX_LENGTH
      });
      if (next == null) return;
      try {
        const nextName = validateStoryFolderName(next, folders, folder.id);
        await putOne('documents', makeStoryFolderDocument(folders.map(item => item.id === folder.id ? { ...item, name: nextName } : item)));
        await renderList(ui);
      } catch (error) { alert(error.message || error); }
    });
    del.addEventListener('click', async () => {
      try {
        const currentFolders = await getFolders();
        const currentFolder = currentFolders.find(item => item.id === folder.id);
        if (!currentFolder) throw new Error('원고 폴더가 이미 삭제되었습니다.');
        const contained = (await getSaves()).filter(save => normalizeStoryFolderId(save.folderId, currentFolders) === folder.id);
        const choice = contained.length ? await chooseStoryFolderDeletion(currentFolder.name, contained.length)
          : await showConfirm(`“${currentFolder.name}” 빈 원고 폴더를 삭제할까요?`, { title: '원고 폴더 삭제', confirmText: '삭제', danger: true }) ? 'keep' : null;
        if (!choice) return;
        if (choice === 'remove') {
          const confirmed = await showConfirm(`“${currentFolder.name}” 폴더와 안의 원고 ${contained.length}개를 함께 삭제합니다.\n삭제된 원고는 복구할 수 없습니다.\n정말 삭제하시겠습니까?`, {
            title: '폴더와 원고 삭제', confirmText: '모두 삭제', danger: true
          });
          if (!confirmed) return;
        }
        const latestFolders = await getFolders();
        const latestFolder = latestFolders.find(item => item.id === folder.id);
        const latestSaves = await getSaves();
        const latestContained = latestSaves.filter(save => normalizeStoryFolderId(save.folderId, latestFolders) === folder.id);
        const confirmedIds = new Set(contained.map(save => save.id));
        const confirmedTimes = new Map(contained.map(save => [save.id, save.updatedAt]));
        if (!latestFolder || latestFolder.name !== currentFolder.name || latestContained.length !== confirmedIds.size
          || latestContained.some(save => !confirmedIds.has(save.id) || save.updatedAt !== confirmedTimes.get(save.id))) {
          throw new Error('원고 폴더 내용이 변경되었습니다. 목록을 다시 확인한 뒤 삭제해주세요.');
        }
        const plan = planStoryFolderRemoval(latestFolders, latestSaves, folder.id, choice === 'remove');
        await applyMany('documents', [plan.document, ...plan.updates], plan.deleteIds);
        showToast(choice === 'remove' ? `“${currentFolder.name}” 폴더와 원고 ${plan.deleteIds.length}개를 삭제했습니다.`
          : `“${currentFolder.name}” 폴더를 삭제하고 원고를 최상위로 옮겼습니다.`);
        await renderList(ui);
      } catch (error) {
        alert(error.message || error);
        await renderList(ui);
      }
    });
  });
  const visibleSaves = sortStorySavesInFolder(saves, folders, ui.currentFolderId);
  visibleSaves.forEach((save, rowIndex) => {
    const row = document.createElement('div'); row.className = 'story-save-row'; row.draggable = true;
    row.dataset.tooltipTitle = '저장된 원고';
    row.dataset.tooltipDescription = '저장된 원고입니다. 드래그해서 폴더에 넣거나 뺄 수 있습니다.';
    const check = document.createElement('input'); check.type = 'checkbox'; check.className = 'story-save-check'; check.value = save.id; check.setAttribute('aria-label', `${save.name} 선택`);
    const info = document.createElement('div'); info.className = 'story-save-info';
    const name = document.createElement('strong'); name.textContent = save.name;
    const meta = document.createElement('small'); meta.textContent = stats(save); info.append(name, meta);
    const actions = document.createElement('div'); actions.className = 'story-save-actions';
    const load = document.createElement('button'); load.type = 'button'; load.className = 'primary'; load.textContent = '불러오기';
    const exp = document.createElement('button'); exp.type = 'button'; exp.textContent = '내보내기';
    const del = document.createElement('button'); del.type = 'button'; del.className = 'danger'; del.textContent = '삭제';
    const rename = document.createElement('button'); rename.type = 'button'; rename.textContent = '이름 변경';
    actions.append(load, exp, rename, del); row.append(check, info, actions); ui.list.append(row);
    let controlPress = false;
    row.addEventListener('pointerdown', event => { controlPress = !!event.target.closest('button, input, label'); });
    row.addEventListener('dragstart', event => {
      if (controlPress) { event.preventDefault(); return; }
      const checked = selectedSaveIds(ui.list);
      ui.draggedSaveIds = checked.has(save.id) ? visibleSaves.filter(item => checked.has(item.id)).map(item => item.id) : [save.id];
      ui.draggedFolderIds = [];
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('application/x-hhj-story-save', save.id);
      ui.parentDrop.hidden = !ui.currentFolderId;
    });
    row.addEventListener('dragend', () => { ui.draggedSaveIds = []; ui.parentDrop.hidden = true; clearStoryDropGuide(ui); });
    const guideRowDrop = event => {
      const before = event.clientY < row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2;
      acceptStorySaveDrag(event, ui, row, before ? 'story-drop-before' : 'story-drop-after');
    };
    row.addEventListener('dragenter', guideRowDrop);
    row.addEventListener('dragover', guideRowDrop);
    row.addEventListener('drop', event => {
      if (!ui.draggedSaveIds.length) return;
      event.preventDefault(); event.stopPropagation();
      const before = event.clientY < row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2;
      const beforeId = before ? save.id : visibleSaves[rowIndex + 1]?.id || '';
      dropStorySaves(ui, ui.currentFolderId, beforeId)
        .catch(error => alert(`원고 순서를 변경할 수 없습니다.\n${error.message || error}`));
    });
    load.addEventListener('click', () => loadSave(save).catch(error => alert(`원고를 불러올 수 없습니다.\n${error.message || error}`)));
    exp.addEventListener('click', () => downloadJson(`${sanitizeDownloadName(save.name, '콘문학')}.hhjconstory.json`, exportSave(save)));
    rename.addEventListener('click', async () => {
      const input = await showPrompt('새 원고 이름을 입력하세요.', save.name, {
        title: '원고 이름 변경', label: '원고 이름 (최대 80자)', confirmText: '변경', maxLength: 80
      });
      if (input == null) return;
      const nextName = input.trim();
      if (!nextName) return alert('원고 이름을 입력하세요.');
      try {
        const [latestSaves, latestFolders] = await Promise.all([getSaves(), getFolders()]);
        const current = latestSaves.find(item => item.id === save.id);
        if (!current || current.name !== save.name) throw new Error('원고 목록이 변경되었습니다. 다시 확인한 뒤 이름을 바꿔주세요.');
        if (nextName === current.name) return;
        const folderId = normalizeStoryFolderId(current.folderId, latestFolders);
        if (latestSaves.some(item => item.id !== current.id && item.name === nextName
          && normalizeStoryFolderId(item.folderId, latestFolders) === folderId)) {
          throw new Error('같은 폴더에 같은 이름의 원고가 이미 있습니다.');
        }
        await putOne('documents', { ...current, name: nextName });
        if (storyNameInput?.value.trim() === current.name
          && normalizeStoryFolderId(storyNameInput.dataset.folderId, latestFolders) === folderId) {
          rememberSaveTarget(nextName, folderId);
        }
        showToast(`“${nextName}”으로 원고 이름을 바꿨습니다.`);
        await renderList(ui);
      } catch (error) { alert(error.message || error); }
    });
    del.addEventListener('click', async () => {
      const ok = await confirmStoryDeletion(`“${save.name}” 원고를 삭제합니다.`);
      if (!ok) return;
      await deleteOne('documents', save.id); showToast(`“${save.name}” 저장 원고를 삭제했습니다.`); await renderList(ui);
    });
  });
  if (!folders.length && !visibleSaves.length || currentFolder && !visibleSaves.length) {
    const empty = document.createElement('div');
    empty.className = 'story-save-empty';
    empty.textContent = currentFolder ? '이 폴더에 저장된 원고가 없습니다.' : '원고 목록이 비어 있습니다.';
    ui.list.append(empty);
  }
  syncSelectionCheckbox(ui);
}

function selectedSaveIds(list) {
  return new Set([...list.querySelectorAll('.story-save-check:checked')].map(input => input.value));
}

function selectedFolderIds(list) {
  return new Set([...list.querySelectorAll('.story-folder-check:checked')].map(input => input.value));
}

async function exportSelectedSaves(list) {
  const selectedIds = selectedSaveIds(list);
  const folderIds = selectedFolderIds(list);
  if (!selectedIds.size && !folderIds.size) return alert('내보낼 원고나 폴더를 하나 이상 선택하세요.');
  const [saves, folders] = await Promise.all([getSaves(), getFolders()]);
  const selectedFolders = folders.filter(folder => folderIds.has(folder.id))
    .map(folder => ({ name: folder.name, saves: sortStorySavesInFolder(saves, folders, folder.id) }));
  const selected = (selectedFolders.length ? sortStorySavesInFolder(saves, folders, '') : saves)
    .filter(save => selectedIds.has(save.id));
  if (!selected.length && !selectedFolders.length) return;
  if (selectedFolders.length === 1 && !selected.length) {
    const folder = selectedFolders[0];
    downloadJson(`${sanitizeDownloadName(folder.name, '원고 폴더')}.hhjconstories.json`, exportBundle(folder.saves, folder.name));
  } else if (!selectedFolders.length && selected.length === 1) {
    downloadJson(`${sanitizeDownloadName(selected[0].name, '콘문학')}.hhjconstory.json`, exportSave(selected[0]));
  } else {
    downloadJson(makeTimestampedBackupName('콘문학_백업', '.hhjconstories.json'), exportBundle(selected, '', selectedFolders));
  }
  const total = selected.length + selectedFolders.reduce((count, folder) => count + folder.saves.length, 0);
  showToast(selectedFolders.length ? `${selectedFolders.length}개 폴더와 ${total}개 원고를 내보냈습니다.` : `${total}개 콘문학 원고를 내보냈습니다.`);
}

async function deleteSelectedItems(ui) {
  const saveIds = selectedSaveIds(ui.list);
  const folderIds = selectedFolderIds(ui.list);
  if (!saveIds.size && !folderIds.size) return alert('삭제할 원고나 폴더를 하나 이상 선택하세요.');
  const [saves, folders] = await Promise.all([getSaves(), getFolders()]);
  const selectedFolders = folders.filter(folder => folderIds.has(folder.id));
  const selectedSaves = saves.filter(save => saveIds.has(save.id));
  if (selectedFolders.length !== folderIds.size || selectedSaves.length !== saveIds.size) throw new Error('선택한 항목이 변경되었습니다. 목록을 다시 확인해주세요.');
  const contained = selectedFolders.flatMap(folder => sortStorySavesInFolder(saves, folders, folder.id));
  const choice = contained.length ? await chooseStoryFolderDeletion(folderIds.size, contained.length, saveIds.size) : 'keep';
  if (!choice) return;
  const firstLine = folderIds.size ? `선택된 폴더 ${folderIds.size}개와 원고 ${saveIds.size}개를 삭제합니다.`
    + (contained.length ? `\n폴더 안 원고 ${contained.length}개는 ${choice === 'remove' ? '함께 삭제합니다.' : '최상위로 옮깁니다.'}` : '')
    : `선택된 원고 ${saveIds.size}개를 삭제합니다.`;
  const confirmed = folderIds.size ? await showConfirm(`${firstLine}\n삭제된 항목은 복구할 수 없습니다.\n정말 삭제하시겠습니까?`, {
    title: '선택 항목 삭제', confirmText: '삭제', danger: true
  }) : await confirmStoryDeletion(firstLine);
  if (!confirmed) return;
  const [latestSaves, latestFolders] = await Promise.all([getSaves(), getFolders()]);
  const latestSelectedFolders = latestFolders.filter(folder => folderIds.has(folder.id));
  const latestContained = latestSelectedFolders.flatMap(folder => sortStorySavesInFolder(latestSaves, latestFolders, folder.id));
  const confirmedRecords = new Map([...selectedSaves, ...contained].map(save => [save.id, `${save.folderId || ''}:${save.updatedAt}:${save.sortOrder}`]));
  const latestRecords = latestSaves.filter(save => confirmedRecords.has(save.id));
  if (latestSelectedFolders.length !== selectedFolders.length
    || latestSelectedFolders.some((folder, index) => selectedFolders[index].id !== folder.id || selectedFolders[index].name !== folder.name)
    || latestContained.length !== contained.length
    || latestContained.some(save => !confirmedRecords.has(save.id))
    || latestRecords.length !== confirmedRecords.size
    || latestRecords.some(save => confirmedRecords.get(save.id) !== `${save.folderId || ''}:${save.updatedAt}:${save.sortOrder}`)) {
    throw new Error('선택한 원고나 폴더 내용이 변경되었습니다. 목록을 다시 확인한 뒤 삭제해주세요.');
  }
  const plan = folderIds.size ? planStoryFolderSelectionRemoval(latestFolders, latestSaves, [...folderIds], [...saveIds], choice === 'remove')
    : { updates: [], deleteIds: [...saveIds] };
  await applyMany('documents', folderIds.size ? [plan.document, ...plan.updates] : [], plan.deleteIds);
  showToast(folderIds.size ? `${folderIds.size}개 폴더와 ${plan.deleteIds.length}개 원고를 삭제했습니다.` : `${saveIds.size}개 원고를 삭제했습니다.`);
  await renderList(ui);
}

async function createStoryFolder(ui) {
  const input = await showPrompt('새 원고 폴더 이름을 입력하세요.', '', {
    title: '새 원고 폴더', label: `폴더 이름 (최대 ${STORY_FOLDER_NAME_MAX_LENGTH}자)`, confirmText: '만들기', maxLength: STORY_FOLDER_NAME_MAX_LENGTH
  });
  if (input == null) return;
  try {
    let name = validateStoryFolderName(input, []);
    const folders = await getFolders();
    const matches = folders.filter(folder => folder.name.toLocaleLowerCase('ko-KR') === name.toLocaleLowerCase('ko-KR'));
    if (matches.length) {
      const separateName = nextAvailableStoryName(name, folders.map(folder => folder.name), STORY_FOLDER_NAME_MAX_LENGTH, true);
      const choice = await chooseNameConflict('원고 폴더 이름 중복',
        `“${name}” 폴더가 이미 있습니다. 기존 폴더를 열어도 안의 원고는 지워지지 않습니다.\n별도로 만들면 “${separateName}” 폴더가 생성됩니다.`,
        matches.map(folder => ({ id: folder.id, label: folder.name })), '기존 폴더 열기', '별도 폴더 만들기');
      if (!choice) return;
      if (choice.action === 'existing') {
        const latest = await getFolders();
        if (!latest.some(folder => folder.id === choice.id && folder.name === matches.find(item => item.id === choice.id)?.name)) {
          throw new Error('기존 폴더가 변경되었습니다. 다시 확인해주세요.');
        }
        ui.currentFolderId = choice.id;
        showToast(`기존 “${name}” 폴더를 열었습니다.`);
        await renderList(ui);
        return;
      }
      name = separateName;
    }
    const latestFolders = await getFolders();
    validateStoryFolderName(name, latestFolders);
    const folder = { id: `story-folder:${crypto.randomUUID()}`, name, createdAt: Date.now() };
    await putOne('documents', makeStoryFolderDocument([...latestFolders, folder]));
    ui.currentFolderId = '';
    showToast(`“${name}” 원고 폴더를 만들었습니다.`);
    await renderList(ui);
  } catch (error) { alert(error.message || error); }
}

async function openManager() {
  const ui = makeDialog();
  ui.save.addEventListener('click', async () => { if (await saveCurrent()) await renderList(ui); });
  ui.newFolder.addEventListener('click', () => createStoryFolder(ui));
  ui.deleteSelected.addEventListener('click', () => deleteSelectedItems(ui).catch(error => alert(`항목을 삭제할 수 없습니다.\n${error.message || error}`)));
  ui.selectAll.addEventListener('change', () => {
    ui.list.querySelectorAll('.story-save-check, .story-folder-check').forEach(input => { input.checked = ui.selectAll.checked; });
    syncSelectionCheckbox(ui);
  });
  ui.list.addEventListener('change', event => {
    if (event.target.matches('.story-save-check, .story-folder-check')) syncSelectionCheckbox(ui);
  });
  ui.selectionMenu.addEventListener('click', event => {
    const action = event.target.closest('button[data-select]')?.dataset.select;
    if (!action) return;
    ui.list.querySelectorAll('.story-save-check, .story-folder-check').forEach(input => {
      input.checked = action === 'folders' ? input.matches('.story-folder-check')
        : action === 'saves' && input.matches('.story-save-check');
    });
    ui.selectionMenu.open = false;
    syncSelectionCheckbox(ui);
  });
  ui.exportSelected.addEventListener('click', () => exportSelectedSaves(ui.list).catch(error => alert(`원고를 내보낼 수 없습니다.\n${error.message || error}`)));
  ui.up.addEventListener('click', () => { ui.currentFolderId = ''; renderList(ui); });
  ui.parentDrop.addEventListener('dragenter', event => acceptStorySaveDrag(event, ui, ui.parentDrop, 'story-drop-folder'));
  ui.parentDrop.addEventListener('dragover', event => acceptStorySaveDrag(event, ui, ui.parentDrop, 'story-drop-folder'));
  ui.parentDrop.addEventListener('drop', event => {
    if (!ui.draggedSaveIds.length) return;
    event.preventDefault(); event.stopPropagation();
    const ids = ui.draggedSaveIds;
    Promise.all([getSaves(), getFolders()]).then(([saves, folders]) =>
      dropStorySaves(ui, '', sortStorySavesInFolder(saves, folders, '')[0]?.id || '', ids)
    ).catch(error => alert(`원고를 최상위로 옮길 수 없습니다.\n${error.message || error}`));
  });
  const guideListDrop = event => {
    if (event.target === ui.list || event.target.classList?.contains('story-save-empty')) acceptStorySaveDrag(event, ui, ui.list, 'story-drop-end');
  };
  ui.list.addEventListener('dragenter', guideListDrop);
  ui.list.addEventListener('dragover', guideListDrop);
  ui.list.addEventListener('drop', event => {
    if (!ui.draggedSaveIds.length || event.target !== ui.list && !event.target.classList?.contains('story-save-empty')) return;
    event.preventDefault();
    dropStorySaves(ui, ui.currentFolderId).catch(error => alert(`원고를 이동할 수 없습니다.\n${error.message || error}`));
  });
  ui.input.addEventListener('change', async () => {
    const files = [...(ui.input.files || [])]; ui.input.value = ''; if (!files.length) return;
    const names = new Set((await getSaves()).map(v => v.name)); let ok = 0; let importedFolders = 0; const failures = [];
    for (const file of files) {
      try {
        const data = JSON.parse(await file.text());
        const { saves: parsedSaves, folders: importedGroups } = parseImportData(data);
        if (importedGroups.length) {
          const folders = await getFolders();
          const newFolders = [];
          importedGroups.forEach(group => {
            const baseName = group.name;
            let folderName = baseName;
            let n = 2;
            while ([...folders, ...newFolders].some(folder => folder.name.toLocaleLowerCase('ko-KR') === folderName.toLocaleLowerCase('ko-KR'))) {
              const suffix = ` (${n++})`;
              folderName = `${baseName.slice(0, STORY_FOLDER_NAME_MAX_LENGTH - suffix.length)}${suffix}`;
            }
            validateStoryFolderName(folderName, [...folders, ...newFolders]);
            newFolders.push({ id: `story-folder:${crypto.randomUUID()}`, name: folderName, createdAt: Date.now() });
          });
          const pendingNames = new Set(names);
          const rootOrder = nextStorySaveOrder(await getSaves(), folders, '');
          const rootNow = Date.now();
          const rootRecords = parsedSaves.map((parsed, index) => {
            const order = Number.isFinite(rootOrder) ? rootOrder - parsedSaves.length + 1 + index : undefined;
            const record = makeImportedSave(parsed, pendingNames, '', order);
            if (!Number.isFinite(rootOrder)) record.updatedAt = rootNow - index;
            return record;
          });
          const records = [...rootRecords, ...importedGroups.flatMap((group, groupIndex) =>
            group.saves.map((parsed, index) => makeImportedSave(parsed, pendingNames, newFolders[groupIndex].id, index)))];
          await putMany('documents', [makeStoryFolderDocument([...folders, ...newFolders]), ...records]);
          records.forEach(record => names.add(record.name));
          importedFolders += newFolders.length;
          ok += records.length;
        } else {
          for (const parsed of parsedSaves) {
            await storeImportedSave(parsed, names);
            ok += 1;
          }
        }
      } catch (error) { failures.push(`${file.name}: ${error.message}`); }
    }
    if (failures.length) alert(`${ok || importedFolders ? `${importedFolders ? `${importedFolders}개 폴더와 ` : ''}${ok}개 원고를 불러왔습니다.\n\n` : ''}불러오지 못한 파일이 있습니다.\n${failures.map(v => `- ${v}`).join('\n')}`);
    if (ok || importedFolders) {
      if (importedFolders) ui.currentFolderId = '';
      showToast(importedFolders ? `${importedFolders}개 원고 폴더와 ${ok}개 원고를 불러왔습니다.` : `${ok}개 콘문학 원고를 불러왔습니다.`);
      await renderList(ui);
    }
  });
  await renderList(ui); ui.dialog.showModal();
}

if (storyList && editorActions) {
  document.addEventListener('hhjcon:story-cleared', () => rememberSaveTarget('', ''));
  storyNameInput = document.createElement('input');
  storyNameInput.id = 'storyNameInput';
  storyNameInput.type = 'text';
  storyNameInput.maxLength = 80;
  storyNameInput.placeholder = '원고 이름';
  storyNameInput.setAttribute('aria-label', '원고 이름');
  storyNameInput.dataset.tooltipTitle = '원고 이름';
  storyNameInput.dataset.tooltipDescription = '원고를 저장할 때 사용할 이름입니다. 비워 두면 “콘문학 (날짜) (시간)”이 자동으로 채워집니다.';
  try {
    storyNameInput.value = localStorage.getItem(NAME_KEY) || '';
    storyNameInput.dataset.folderId = localStorage.getItem(FOLDER_KEY) || '';
  } catch { /* 저장소가 막혀도 입력칸은 사용할 수 있다. */ }
  storyNameInput.addEventListener('input', () => {
    try { localStorage.setItem(NAME_KEY, storyNameInput.value); } catch { /* 현재 화면에서만 유지 */ }
  });
  const save = document.createElement('button'); save.type = 'button'; save.className = 'small'; save.textContent = '원고 저장';
  const manage = document.createElement('button'); manage.type = 'button'; manage.className = 'small'; manage.textContent = '원고 목록';
  editorActions.insertBefore(storyNameInput, clearButton || null);
  editorActions.insertBefore(save, clearButton || null); editorActions.insertBefore(manage, clearButton || null);
  save.addEventListener('click', saveCurrent);
  manage.addEventListener('click', () => openManager().catch(error => alert(`원고 목록을 열 수 없습니다.\n${error.message || error}`)));
}
