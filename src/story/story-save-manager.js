import { applyMany, deleteOne, getAll, getOne, putMany, putOne } from '../db.js?v=20260915-1';
import { downloadJson, makeDatedDefaultName, makeTimestampedBackupName, sanitizeDownloadName } from '../core/json-download.js?v=20260909-3';
import { chooseNameConflict, confirmNamedItemDeletion, createDialog, showConfirm, showPrompt } from '../ui/action-dialogs.js?v=20261004-1';
import { saveToastForReload, showToast } from '../ui/toast.js?v=20261003-1';
import { FORMAT, VERSION, exportBundle, exportSave, filtered, normalizeConRef, parseImportData } from './story-save-format.js?v=20261003-1';
import {
  makeStoryFolderDocument,
  nextAvailableStoryName,
  nextStorySaveOrder,
  planDuplicateNameRepairs,
  normalizeStoryFolderId,
  normalizeStoryFolders,
  planStoryFolderPlacement,
  planStoryFolderRemoval,
  planStoryFolderSelectionRemoval,
  planStorySavePlacement,
  sortStorySavesInFolder,
  storyFolderTree,
  storyFoldersIn,
  STORY_FOLDER_DOCUMENT_ID,
  STORY_FOLDER_NAME_MAX_LENGTH,
  validateStoryFolderName
} from './story-save-folders.js?v=20261003-2';

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
  const saves = (await getAll('documents'))
    .filter(v => v?.format === FORMAT && Number(v.version) === VERSION && String(v.id || '').startsWith(PREFIX));
  const folders = await getFolders();
  const visualOrder = ['', ...folders.map(folder => folder.id)]
    .flatMap(folderId => sortStorySavesInFolder(saves, folders, folderId));
  const repairs = planDuplicateNameRepairs(visualOrder, 80);
  if (repairs.length) await putMany('documents', repairs.map(repair => repair.item));
  const repairedById = new Map(repairs.map(repair => [repair.item.id, repair.item]));
  if (repairs.length) alert(`동명 원고의 이름을 정리했습니다.\n${repairs.map(repair => `“${repair.before}” → “${repair.after}”`).join('\n')}`);
  return saves.map(item => repairedById.get(item.id) || item)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

async function getFolders() {
  return normalizeStoryFolders(await getOne('documents', STORY_FOLDER_DOCUMENT_ID));
}

function folderPath(id, folders) {
  const folder = folders.find(item => item.id === id);
  const parent = folders.find(item => item.id === folder?.parentId);
  return folder ? [parent?.name, folder.name].filter(Boolean).join(' / ') : '최상위';
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
  const saves = await getSaves();
  const sortOrder = nextStorySaveOrder(saves, await getFolders(), '');
  const record = makeImportedSave(parsed, names, '', sortOrder);
  if (!Number.isFinite(sortOrder)) record.updatedAt = saves.reduce((latest, save) =>
    Math.max(latest, (save.updatedAt || 0) + 1), record.updatedAt);
  await putOne('documents', record);
  return record;
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
  const choices = [{ id: '', name: '최상위' }, ...storyFoldersIn(folders).flatMap(folder => [
    folder, ...storyFoldersIn(folders, folder.id).map(child => ({ ...child, name: `${folder.name} / ${child.name}` }))
  ])];
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

async function saveCurrent(defaultFolderId = null) {
  const folders = await getFolders();
  const draftName = storyNameInput?.value.trim() || '';
  const input = await showSavePrompt(folders, draftName, defaultFolderId == null
    ? draftName ? normalizeStoryFolderId(storyNameInput.dataset.folderId, folders) : ''
    : normalizeStoryFolderId(defaultFolderId, folders));
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
      label: `${folderPath(save.folderId, folders)} · ${save.story?.items?.length || 0}블록 · ${new Date(save.updatedAt).toLocaleString('ko-KR')}` }));
    const locations = [...new Set(matches.map(save => save.folderId ? `“${folderPath(save.folderId, folders)}” 폴더` : '최상위'))];
    const where = locations.length === 1 ? locations[0] : `${locations.join(', ')} 등 여러 위치`;
    const choice = await chooseNameConflict('원고 이름 중복',
      `“${name}” 원고가 이미 ${where}에 있습니다.\n기존 위치의 원고를 덮어쓰거나 “${separateName}”로 원고 데이터를 새로 만들 수 있습니다.`,
      targets, '덮어쓰기', '새로 만들기');
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
    if (!Number.isFinite(record.sortOrder)) record.updatedAt = latestSaves.reduce((latest, save) =>
      Math.max(latest, (save.updatedAt || 0) + 1), record.updatedAt);
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

function chooseStoryFolderDeletion(name, count, selectedSaveCount = 0, childFolderCount = 0) {
  const { dialog, body, footer } = createDialog('원고 폴더 삭제', 'warning');
  const message = document.createElement('p');
  message.className = 'hhj-ui-dialog-message';
  const subject = typeof name === 'number' ? `선택한 폴더 ${name}개` : `“${name}” 폴더`;
  message.textContent = `${subject}를 삭제합니다.\n폴더 안에 하위 폴더 ${childFolderCount}개와 원고 ${count}개가 있습니다. 어떻게 처리할까요?`
    + (selectedSaveCount ? `\n별도로 체크한 원고 ${selectedSaveCount}개는 삭제됩니다.` : '');
  body.append(message);
  const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = '취소';
  const keep = document.createElement('button'); keep.type = 'button'; keep.className = 'primary'; keep.textContent = '폴더 안 내용 남기기';
  const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'danger-action'; remove.textContent = '폴더 안 내용도 삭제';
  keep.dataset.tooltipTitle = '폴더 안 내용 남기기';
  keep.dataset.tooltipDescription = '폴더 안의 내용물은 같이 삭제되지 않고 상위 폴더로 이동합니다.\n만약 이동할 때 이름이 겹치는 폴더가 존재한다면 "이름 (2)" 처럼 폴더 이름에 번호가 붙습니다.';
  remove.dataset.tooltipTitle = '폴더 안 내용도 삭제';
  remove.dataset.tooltipDescription = '폴더 안의 내용물도 같이 지웁니다.';
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
  ui.dialog.querySelectorAll('.story-drop-before, .story-drop-after, .story-drop-folder, .story-drop-end, .story-drop-blocked')
    .forEach(element => element.classList.remove('story-drop-before', 'story-drop-after', 'story-drop-folder', 'story-drop-end', 'story-drop-blocked'));
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

async function dropStoryFolders(ui, beforeId, ids = ui.draggedFolderIds, parentId = ui.currentFolderId) {
  ui.draggedFolderIds = [];
  clearStoryDropGuide(ui);
  const folders = await getFolders();
  const next = planStoryFolderPlacement(folders, ids, beforeId, parentId);
  if (!next.length) return;
  await putOne('documents', makeStoryFolderDocument(next));
  showToast(`${ids.length}개 원고 폴더를 ${folders.some(folder => ids.includes(folder.id) && (folder.parentId || '') !== parentId) ? '이동' : '재정렬'}했습니다.`);
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
  const parentFolder = folders.find(folder => folder.id === currentFolder?.parentId);
  ui.parentFolderId = parentFolder?.id || '';
  ui.up.hidden = !currentFolder;
  ui.up.textContent = `← ${parentFolder?.name || '최상위'}`;
  ui.newFolder.hidden = Boolean(currentFolder?.parentId);
  ui.parentDrop.hidden = true;
  ui.parentDrop.textContent = `놓으면 ${parentFolder?.name || '최상위'}로 이동`;
  ui.locationName.replaceChildren('현재 위치: ');
  if (parentFolder) {
    const parentName = document.createElement('span'); parentName.className = 'folder-path-parent'; parentName.textContent = parentFolder.name;
    ui.locationName.append(parentName, ' / ');
  }
  const currentName = document.createElement('span'); currentName.className = 'folder-path-current'; currentName.textContent = currentFolder?.name || '최상위';
  ui.locationName.append(currentName);
  ui.locationName.dataset.tooltipTitle = '현재 위치';
  ui.locationName.dataset.tooltipDescription = [parentFolder?.name, currentFolder?.name].filter(Boolean).join(' / ') || '최상위';
  ui.list.replaceChildren();
  const visibleFolders = currentFolder?.parentId ? [] : storyFoldersIn(folders, ui.currentFolderId);
  visibleFolders.forEach((folder, folderIndex) => {
    const row = document.createElement('div');
    row.className = 'story-folder-row';
    row.draggable = true;
    const check = document.createElement('input'); check.type = 'checkbox'; check.className = 'story-folder-check'; check.value = folder.id;
    check.setAttribute('aria-label', `${folder.name} 폴더 선택`);
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'story-folder-main';
    const name = document.createElement('strong');
    name.textContent = `📁 ${folder.name}`;
    const count = document.createElement('small');
    const children = storyFoldersIn(folders, folder.id);
    const childIds = new Set(children.map(item => item.id));
    count.textContent = `원고 ${saves.filter(save => normalizeStoryFolderId(save.folderId, folders) === folder.id).length}개`
      + (children.length ? ` · 폴더 ${children.length}개 · 폴더 속 원고 ${saves.filter(save => childIds.has(normalizeStoryFolderId(save.folderId, folders))).length}개` : '');
    open.append(name, count);
    const actions = document.createElement('div');
    actions.className = 'story-save-actions';
    const exp = document.createElement('button'); exp.type = 'button'; exp.textContent = '내보내기';
    const rename = document.createElement('button'); rename.type = 'button'; rename.textContent = '이름 변경';
    const del = document.createElement('button'); del.type = 'button'; del.className = 'danger'; del.textContent = '삭제';
    actions.append(exp, rename, del);
    row.append(check, open, actions);
    ui.list.append(row);
    let controlPress = false;
    row.addEventListener('pointerdown', event => { controlPress = !!event.target.closest('input, .story-save-actions'); });
    row.addEventListener('dragstart', event => {
      if (controlPress) { event.preventDefault(); return; }
      const checked = selectedFolderIds(ui.list);
      ui.draggedFolderIds = checked.has(folder.id) ? folders.filter(item => checked.has(item.id)).map(item => item.id) : [folder.id];
      ui.draggedSaveIds = [];
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('application/x-hhj-story-folder', folder.id);
      ui.parentDrop.hidden = !ui.currentFolderId;
    });
    row.addEventListener('dragend', () => { ui.draggedFolderIds = []; ui.parentDrop.hidden = true; clearStoryDropGuide(ui); });
    const guideFolderRowDrop = event => {
      if (!ui.draggedFolderIds.length) return acceptStorySaveDrag(event, ui, row, 'story-drop-folder');
      const bounds = row.getBoundingClientRect();
      const fraction = (event.clientY - bounds.top) / bounds.height;
      const nest = !ui.currentFolderId && fraction >= .25 && fraction <= .75
        && !ui.draggedFolderIds.includes(folder.id);
      const blocked = nest && ui.draggedFolderIds.some(id => storyFoldersIn(folders, id).length);
      acceptStoryFolderDrag(event, ui, row, blocked ? 'story-drop-blocked' : nest ? 'story-drop-folder'
        : fraction < .5 ? 'story-drop-before' : 'story-drop-after');
    };
    row.addEventListener('dragenter', guideFolderRowDrop);
    row.addEventListener('dragover', guideFolderRowDrop);
    row.addEventListener('drop', event => {
      if (ui.draggedFolderIds.length) {
        event.preventDefault(); event.stopPropagation();
        const bounds = row.getBoundingClientRect();
        const fraction = (event.clientY - bounds.top) / bounds.height;
        const nest = !ui.currentFolderId && fraction >= .25 && fraction <= .75
          && !ui.draggedFolderIds.includes(folder.id);
        const beforeId = fraction < .5 ? folder.id : visibleFolders[folderIndex + 1]?.id || '';
        dropStoryFolders(ui, nest ? '' : beforeId, ui.draggedFolderIds, nest ? folder.id : ui.currentFolderId)
          .catch(error => alert(`폴더를 이동할 수 없습니다.\n${error.message || error}`));
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
        const children = storyFoldersIn(latestFolders, folder.id).map(child => ({
          name: child.name, saves: sortStorySavesInFolder(latestSaves, latestFolders, child.id)
        }));
        const backup = children.length ? exportBundle([], '', [{ name: latestFolder.name, saves: contained, folders: children }])
          : exportBundle(contained, latestFolder.name);
        downloadJson(`${sanitizeDownloadName(latestFolder.name, '원고 폴더')}.hhjconstories.json`, backup);
        showToast(`“${latestFolder.name}” 폴더와 원고 ${contained.length + children.reduce((sum, child) => sum + child.saves.length, 0)}개를 내보냈습니다.`);
      } catch (error) { alert(`원고 폴더를 내보낼 수 없습니다.\n${error.message || error}`); }
    });
    rename.addEventListener('click', async () => {
      const next = await showPrompt('새 원고 폴더 이름을 입력하세요.', folder.name, {
        title: '원고 폴더 이름 변경', label: `폴더 이름 (최대 ${STORY_FOLDER_NAME_MAX_LENGTH}자)`, confirmText: '변경', maxLength: STORY_FOLDER_NAME_MAX_LENGTH
      });
      if (next == null) return;
      try {
        const nextName = validateStoryFolderName(next, folders, folder.id, folder.parentId || '');
        await putOne('documents', makeStoryFolderDocument(folders.map(item => item.id === folder.id ? { ...item, name: nextName } : item)));
        await renderList(ui);
      } catch (error) { alert(`이름을 바꿀 수 없습니다.\n${error.message || error}`); }
    });
    del.addEventListener('click', async () => {
      try {
        const currentFolders = await getFolders();
        const currentFolder = currentFolders.find(item => item.id === folder.id);
        if (!currentFolder) throw new Error('원고 폴더가 이미 삭제되었습니다.');
        const affectedFolders = storyFolderTree(currentFolders, folder.id);
        const affectedIds = new Set(affectedFolders.map(item => item.id));
        const contained = (await getSaves()).filter(save => affectedIds.has(normalizeStoryFolderId(save.folderId, currentFolders)));
        const choice = contained.length || affectedFolders.length > 1
          ? await chooseStoryFolderDeletion(currentFolder.name, contained.length, 0, affectedFolders.length - 1)
          : await showConfirm(`“${currentFolder.name}” 빈 원고 폴더를 삭제할까요?`, { title: '원고 폴더 삭제', confirmText: '삭제', danger: true }) ? 'keep' : null;
        if (!choice) return;
        if (choice === 'remove') {
          const confirmed = await showConfirm(`“${currentFolder.name}” 폴더와 하위 폴더 ${affectedFolders.length - 1}개, 원고 ${contained.length}개를 함께 삭제합니다.\n삭제된 원고는 복구할 수 없습니다.\n정말 삭제하시겠습니까?`, {
            title: '폴더와 원고 삭제', confirmText: '모두 삭제', danger: true
          });
          if (!confirmed) return;
        } else if (contained.length || affectedFolders.length > 1) {
          const confirmed = await showConfirm(`“${currentFolder.name}” 폴더를 삭제합니다.\n삭제된 항목은 복구할 수 없습니다.\n폴더안의 하위 폴더 ${affectedFolders.length - 1}개와 원고 ${contained.length}개는 상위 폴더로 옮겨 보존합니다.\n정말 삭제하시겠습니까?`, {
            title: '원고 폴더 삭제', confirmText: '삭제', danger: true
          });
          if (!confirmed) return;
        }
        const latestFolders = await getFolders();
        const latestFolder = latestFolders.find(item => item.id === folder.id);
        const latestSaves = await getSaves();
        const latestAffected = storyFolderTree(latestFolders, folder.id);
        const latestIds = new Set(latestAffected.map(item => item.id));
        const latestContained = latestSaves.filter(save => latestIds.has(normalizeStoryFolderId(save.folderId, latestFolders)));
        const confirmedIds = new Set(contained.map(save => save.id));
        const confirmedTimes = new Map(contained.map(save => [save.id, save.updatedAt]));
        if (!latestFolder || latestFolder.name !== currentFolder.name || latestFolder.parentId !== currentFolder.parentId
          || latestAffected.length !== affectedFolders.length
          || latestAffected.some(item => !affectedFolders.some(old => old.id === item.id && old.name === item.name && old.parentId === item.parentId))
          || latestContained.length !== confirmedIds.size
          || latestContained.some(save => !confirmedIds.has(save.id) || save.updatedAt !== confirmedTimes.get(save.id))) {
          throw new Error('원고 폴더 내용이 변경되었습니다. 목록을 다시 확인한 뒤 삭제해주세요.');
        }
        const plan = planStoryFolderRemoval(latestFolders, latestSaves, folder.id, choice === 'remove');
        await applyMany('documents', [plan.document, ...plan.updates], plan.deleteIds);
        showToast(choice === 'remove' ? `“${currentFolder.name}” 폴더와 원고 ${plan.deleteIds.length}개를 삭제했습니다.`
          : `“${currentFolder.name}” 폴더를 삭제하고 내용을 상위 폴더로 옮겼습니다.`);
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
        const duplicates = latestSaves.filter(item => item.id !== current.id && item.name === nextName);
        if (duplicates.length) {
          const locations = [...new Set(duplicates.map(item => normalizeStoryFolderId(item.folderId, latestFolders)
            ? `“${folderPath(item.folderId, latestFolders)}” 폴더` : '최상위'))];
          throw new Error(locations.length === 1
            ? `${locations[0]}에 같은 이름의 원고가 이미 있습니다.`
            : `다음 위치에 같은 이름의 원고가 이미 있습니다: ${locations.join(', ')}.`);
        }
        await putOne('documents', { ...current, name: nextName });
        if (storyNameInput?.value.trim() === current.name
          && normalizeStoryFolderId(storyNameInput.dataset.folderId, latestFolders) === folderId) {
          rememberSaveTarget(nextName, folderId);
        }
        showToast(`“${nextName}”으로 원고 이름을 바꿨습니다.`);
        await renderList(ui);
      } catch (error) { alert(`이름을 바꿀 수 없습니다.\n${error.message || error}`); }
    });
    del.addEventListener('click', async () => {
      const ok = await confirmNamedItemDeletion(save.name, '원고');
      if (!ok) return;
      await deleteOne('documents', save.id); showToast(`“${save.name}” 저장 원고를 삭제했습니다.`); await renderList(ui);
    });
  });
  if (!visibleFolders.length && !visibleSaves.length) {
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
  const selectedFolders = folders.filter(folder => folderIds.has(folder.id) && !folderIds.has(folder.parentId))
    .map(folder => ({ name: folder.name, saves: sortStorySavesInFolder(saves, folders, folder.id),
      folders: storyFoldersIn(folders, folder.id).map(child => ({
        name: child.name, saves: sortStorySavesInFolder(saves, folders, child.id)
      })) }));
  const selected = (selectedFolders.length ? sortStorySavesInFolder(saves, folders,
    folders.find(folder => folderIds.has(folder.id))?.parentId || '') : saves)
    .filter(save => selectedIds.has(save.id));
  if (!selected.length && !selectedFolders.length) return;
  if (selectedFolders.length === 1 && !selected.length) {
    const folder = selectedFolders[0];
    downloadJson(`${sanitizeDownloadName(folder.name, '원고 폴더')}.hhjconstories.json`,
      folder.folders.length ? exportBundle([], '', [folder]) : exportBundle(folder.saves, folder.name));
  } else if (!selectedFolders.length && selected.length === 1) {
    downloadJson(`${sanitizeDownloadName(selected[0].name, '콘문학')}.hhjconstory.json`, exportSave(selected[0]));
  } else {
    downloadJson(makeTimestampedBackupName('콘문학_백업', '.hhjconstories.json'), exportBundle(selected, '', selectedFolders));
  }
  const total = selected.length + selectedFolders.reduce((count, folder) =>
    count + folder.saves.length + folder.folders.reduce((sum, child) => sum + child.saves.length, 0), 0);
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
  const affectedFolders = folders.filter(folder => folderIds.has(folder.id) || folderIds.has(folder.parentId));
  const affectedIds = new Set(affectedFolders.map(folder => folder.id));
  const contained = saves.filter(save => affectedIds.has(save.folderId));
  const childFolderCount = affectedFolders.length - selectedFolders.length;
  const choice = contained.length || childFolderCount
    ? await chooseStoryFolderDeletion(folderIds.size === 1 ? selectedFolders[0].name : folderIds.size, contained.length, saveIds.size, childFolderCount) : 'keep';
  if (!choice) return;
  const firstLine = folderIds.size ? `선택된 폴더 ${folderIds.size}개와 원고 ${saveIds.size}개를 삭제합니다.`
    : `선택된 원고 ${saveIds.size}개를 삭제합니다.`;
  const folderDetails = contained.length || childFolderCount
    ? `\n폴더안의 하위 폴더 ${childFolderCount}개와 원고 ${contained.length}개는 ${choice === 'remove' ? '함께 삭제합니다.' : '상위 폴더로 옮겨 보존합니다.'}` : '';
  const confirmed = folderIds.size ? await showConfirm(`${firstLine}\n삭제된 항목은 복구할 수 없습니다.${folderDetails}\n정말 삭제하시겠습니까?`, {
    title: '선택 항목 삭제', confirmText: choice === 'remove' ? '모두 삭제' : '삭제', danger: true
  }) : saveIds.size === 1 ? await confirmNamedItemDeletion(selectedSaves[0].name, '원고') : await confirmStoryDeletion(firstLine);
  if (!confirmed) return;
  const [latestSaves, latestFolders] = await Promise.all([getSaves(), getFolders()]);
  const latestSelectedFolders = latestFolders.filter(folder => folderIds.has(folder.id));
  const latestAffected = latestFolders.filter(folder => folderIds.has(folder.id) || folderIds.has(folder.parentId));
  const latestAffectedIds = new Set(latestAffected.map(folder => folder.id));
  const latestContained = latestSaves.filter(save => latestAffectedIds.has(save.folderId));
  const confirmedRecords = new Map([...selectedSaves, ...contained].map(save => [save.id, `${save.folderId || ''}:${save.updatedAt}:${save.sortOrder}`]));
  const latestRecords = latestSaves.filter(save => confirmedRecords.has(save.id));
  if (latestSelectedFolders.length !== selectedFolders.length
    || latestAffected.length !== affectedFolders.length
    || latestAffected.some(folder => !affectedFolders.some(old => old.id === folder.id && old.name === folder.name && old.parentId === folder.parentId))
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
    title: '새 원고 폴더', label: `폴더 이름 (최대 ${STORY_FOLDER_NAME_MAX_LENGTH}자)`, confirmText: '만들기', maxLength: STORY_FOLDER_NAME_MAX_LENGTH, note: STORY_WARNING
  });
  if (input == null) return;
  try {
    let name = validateStoryFolderName(input, []);
    const folders = await getFolders();
    const parentId = ui.currentFolderId;
    if (folders.find(folder => folder.id === parentId)?.parentId) throw new Error('폴더는 두 단계까지만 만들 수 있습니다.');
    const siblings = storyFoldersIn(folders, parentId);
    const matches = siblings.filter(folder => folder.name.toLocaleLowerCase('ko-KR') === name.toLocaleLowerCase('ko-KR'));
    if (matches.length) {
      const separateName = nextAvailableStoryName(name, siblings.map(folder => folder.name), STORY_FOLDER_NAME_MAX_LENGTH, true);
      const parent = folders.find(folder => folder.id === parentId);
      const location = parent ? `“${parent.name}” 폴더` : '최상위';
      const choice = await chooseNameConflict('원고 폴더 이름 중복',
        `“${name}” 폴더가 이미 ${location}에 있습니다.\n폴더를 새로 만들지 않고 기존 폴더를 열거나 “${separateName}”로 폴더를 새로 만들 수 있습니다.`,
        matches.map(folder => ({ id: folder.id, label: folder.name })), '기존 폴더 열기', '새로 만들기');
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
    if (parentId && (!latestFolders.some(folder => folder.id === parentId && !folder.parentId))) throw new Error('상위 폴더가 변경되었습니다.');
    validateStoryFolderName(name, latestFolders, '', parentId);
    const folder = { id: `story-folder:${crypto.randomUUID()}`, name, createdAt: Date.now(), ...(parentId ? { parentId } : {}) };
    await putOne('documents', makeStoryFolderDocument([folder, ...latestFolders]));
    showToast(`“${name}” 원고 폴더를 만들었습니다.`);
    await renderList(ui);
  } catch (error) { alert(error.message || error); }
}

async function openManager() {
  const ui = makeDialog();
  ui.save.addEventListener('click', async () => { if (await saveCurrent(ui.currentFolderId)) await renderList(ui); });
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
  ui.up.addEventListener('click', () => { ui.currentFolderId = ui.parentFolderId; renderList(ui); });
  ui.parentDrop.addEventListener('dragenter', event => ui.draggedFolderIds.length
    ? acceptStoryFolderDrag(event, ui, ui.parentDrop, 'story-drop-folder')
    : acceptStorySaveDrag(event, ui, ui.parentDrop, 'story-drop-folder'));
  ui.parentDrop.addEventListener('dragover', event => ui.draggedFolderIds.length
    ? acceptStoryFolderDrag(event, ui, ui.parentDrop, 'story-drop-folder')
    : acceptStorySaveDrag(event, ui, ui.parentDrop, 'story-drop-folder'));
  ui.parentDrop.addEventListener('drop', event => {
    if (ui.draggedFolderIds.length) {
      event.preventDefault(); event.stopPropagation();
      dropStoryFolders(ui, '', ui.draggedFolderIds, ui.parentFolderId)
        .catch(error => alert(`폴더를 이동할 수 없습니다.\n${error.message || error}`));
      return;
    }
    if (!ui.draggedSaveIds.length) return;
    event.preventDefault(); event.stopPropagation();
    const ids = ui.draggedSaveIds;
    Promise.all([getSaves(), getFolders()]).then(([saves, folders]) =>
      dropStorySaves(ui, ui.parentFolderId, sortStorySavesInFolder(saves, folders, ui.parentFolderId)[0]?.id || '', ids)
    ).catch(error => alert(`원고를 상위 폴더로 옮길 수 없습니다.\n${error.message || error}`));
  });
  const guideListDrop = event => {
    if (event.target === ui.list || event.target.classList?.contains('story-save-empty')) {
      if (ui.draggedFolderIds.length) acceptStoryFolderDrag(event, ui, ui.list, 'story-drop-end');
      else acceptStorySaveDrag(event, ui, ui.list, 'story-drop-end');
    }
  };
  ui.list.addEventListener('dragenter', guideListDrop);
  ui.list.addEventListener('dragover', guideListDrop);
  ui.list.addEventListener('drop', event => {
    if ((!ui.draggedSaveIds.length && !ui.draggedFolderIds.length)
      || event.target !== ui.list && !event.target.classList?.contains('story-save-empty')) return;
    event.preventDefault();
    if (ui.draggedFolderIds.length) dropStoryFolders(ui, '').catch(error => alert(`폴더를 이동할 수 없습니다.\n${error.message || error}`));
    else dropStorySaves(ui, ui.currentFolderId).catch(error => alert(`원고를 이동할 수 없습니다.\n${error.message || error}`));
  });
  ui.input.addEventListener('change', async () => {
    const files = [...(ui.input.files || [])]; ui.input.value = ''; if (!files.length) return;
    const names = new Set((await getSaves()).map(v => v.name)); let ok = 0; let importedFolders = 0; const failures = []; const renamed = [];
    for (const file of files) {
      try {
        const data = JSON.parse(await file.text());
        const { saves: parsedSaves, folders: importedGroups } = parseImportData(data);
        if (importedGroups.length) {
          const folders = await getFolders();
          const newFolders = [];
          const groups = [];
          const folderRenames = [];
          importedGroups.forEach(group => {
            const baseName = group.name;
            let folderName = baseName;
            let n = 2;
            while (storyFoldersIn([...folders, ...newFolders]).some(folder => folder.name.toLocaleLowerCase('ko-KR') === folderName.toLocaleLowerCase('ko-KR'))) {
              const suffix = ` (${n++})`;
              folderName = `${baseName.slice(0, STORY_FOLDER_NAME_MAX_LENGTH - suffix.length)}${suffix}`;
            }
            validateStoryFolderName(folderName, [...folders, ...newFolders]);
            const parent = { id: `story-folder:${crypto.randomUUID()}`, name: folderName, createdAt: Date.now() };
            newFolders.push(parent);
            if (group.name !== folderName) folderRenames.push(`[최상위][폴더] “${group.name}” → “${folderName}”`);
            groups.push({ group, folderId: parent.id });
            (group.folders || []).forEach(child => {
              const childName = nextAvailableStoryName(child.name,
                storyFoldersIn(newFolders, parent.id).map(folder => folder.name), STORY_FOLDER_NAME_MAX_LENGTH, true);
              const nested = { id: `story-folder:${crypto.randomUUID()}`, name: childName,
                parentId: parent.id, createdAt: Date.now() };
              newFolders.push(nested);
              if (child.name !== childName) folderRenames.push(`[${folderPath(parent.id, newFolders)}][폴더] “${child.name}” → “${childName}”`);
              groups.push({ group: child, folderId: nested.id });
            });
          });
          const pendingNames = new Set(names);
          const rootSaves = await getSaves();
          const rootOrder = nextStorySaveOrder(rootSaves, folders, '');
          const rootNow = rootSaves.reduce((latest, save) =>
            Math.max(latest, (save.updatedAt || 0) + parsedSaves.length), Date.now() + parsedSaves.length - 1);
          const rootRecords = parsedSaves.map((parsed, index) => {
            const order = Number.isFinite(rootOrder) ? rootOrder - parsedSaves.length + 1 + index : undefined;
            const record = makeImportedSave(parsed, pendingNames, '', order);
            if (!Number.isFinite(rootOrder)) record.updatedAt = rootNow - index;
            return record;
          });
          const records = [...rootRecords, ...groups.flatMap(({ group, folderId }) =>
            group.saves.map((parsed, index) => makeImportedSave(parsed, pendingNames, folderId, index)))];
          await putMany('documents', [makeStoryFolderDocument([...newFolders, ...folders]), ...records]);
          renamed.push(...folderRenames);
          [...parsedSaves, ...groups.flatMap(({ group }) => group.saves)].forEach((parsed, index) => {
            if (parsed.name !== records[index].name) renamed.push(`[${folderPath(records[index].folderId, newFolders)}][원고] “${parsed.name}” → “${records[index].name}”`);
          });
          records.forEach(record => names.add(record.name));
          importedFolders += newFolders.length;
          ok += records.length;
        } else {
          for (const parsed of parsedSaves) {
            const record = await storeImportedSave(parsed, names);
            if (parsed.name !== record.name) renamed.push(`[최상위][원고] “${parsed.name}” → “${record.name}”`);
            ok += 1;
          }
        }
      } catch (error) { failures.push(`${file.name}: ${error.message}`); }
    }
    if (renamed.length) alert(`백업을 불러오며 중복된 이름이 다음과 같이 변경되었습니다.\n${renamed.join('\n')}`);
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
  save.addEventListener('click', () => saveCurrent());
  manage.addEventListener('click', () => openManager().catch(error => alert(`원고 목록을 열 수 없습니다.\n${error.message || error}`)));
}

getSaves().catch(error => console.error('저장된 원고 이름 확인 실패', error));
