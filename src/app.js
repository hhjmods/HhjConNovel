import { clearStore, deleteOne, getAll, getOne, putMany, putOne } from './db.js';
import {
  addUniqueIds,
  createCollection,
  exportCollection,
  importCollectionFile,
  normalizeSyncPayload,
  removeIds,
  reorderIds
} from './model.js';
import { requestDcSync } from './dc-adapter.js';
import {
  CON_IDS_MIME,
  STORY_IDS_MIME,
  readTransferIds,
  writeConTransfer,
  writeStoryTransfer
} from './story-dnd-utils.js?v=20260906-2';

const DC_WRITE_URL_KEY = 'hhjcon-dc-write-url';

const state = {
  packages: [],
  cons: [],
  collections: [],
  activeTab: 'packages',
  activePackageId: null,
  activeCollectionId: null,
  selectedIds: new Set(),
  selectionAnchorId: null,
  storySelectedIds: new Set(),
  storySelectionAnchorId: null,
  story: { id: 'current', items: [], updatedAt: Date.now() },
  search: ''
};

const el = Object.fromEntries([
  'syncDcBtn', 'dcWriteUrlInput', 'exportCollectionBtn', 'importCollectionInput',
  'packagePanel', 'collectionPanel', 'packageList', 'collectionList', 'newCollectionBtn',
  'libraryTitle', 'selectionStatus', 'searchInput', 'selectAllBtn', 'clearSelectionBtn',
  'libraryEmpty', 'conGrid', 'storyList', 'storyDropZone', 'storyStats', 'addTextBtn',
  'addSelectedConsBtn', 'clearStoryBtn', 'syncStatus', 'toast'
].map(id => [id, document.getElementById(id)]));

function mapById(items) { return new Map(items.map(item => [item.id, item])); }
function activeCollection() { return state.collections.find(item => item.id === state.activeCollectionId) || null; }
function activePackage() { return state.packages.find(item => item.id === state.activePackageId) || null; }
function makeStoryItemId() { return `story_${crypto.randomUUID()}`; }

function ensureStoryItemIds() {
  let changed = false;
  state.story.items.forEach(item => {
    if (!item.id) {
      item.id = makeStoryItemId();
      changed = true;
    }
  });
  return changed;
}

function toast(message) {
  el.toast.textContent = message;
  el.toast.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.toast.classList.remove('show'), 1800);
}

function fileNameSafe(name) {
  return String(name || 'collection').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80);
}

function downloadJson(name, value) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function loadState() {
  const [packages, cons, collections, story, meta] = await Promise.all([
    getAll('packages'), getAll('cons'), getAll('collections'), getOne('documents', 'current'), getOne('meta', 'lastSync')
  ]);
  state.packages = packages.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  state.cons = cons;
  state.collections = collections.sort((a, b) => a.createdAt - b.createdAt);
  state.story = story || state.story;
  if (ensureStoryItemIds()) await putOne('documents', state.story);
  state.activePackageId = state.packages[0]?.id || null;
  state.activeCollectionId = state.collections[0]?.id || null;
  el.dcWriteUrlInput.value = localStorage.getItem(DC_WRITE_URL_KEY) || '';
  updateSyncStatus(meta);
  renderAll();
}

function updateSyncStatus(meta) {
  el.syncStatus.textContent = meta?.syncedAt ? new Date(meta.syncedAt).toLocaleString('ko-KR') : '미동기화';
}

async function applySyncPayload(rawPayload) {
  const payload = normalizeSyncPayload(rawPayload);
  await Promise.all([clearStore('packages'), clearStore('cons')]);
  await putMany('packages', payload.packages);
  await putMany('cons', payload.cons);
  await putOne('meta', { key: 'lastSync', syncedAt: payload.syncedAt, account: payload.account });
  state.packages = payload.packages;
  state.cons = payload.cons;
  if (!state.packages.some(pkg => pkg.id === state.activePackageId)) state.activePackageId = state.packages[0]?.id || null;
  state.selectedIds.clear();
  state.selectionAnchorId = null;
  updateSyncStatus({ syncedAt: payload.syncedAt });
  renderAll();
}

function visibleCons() {
  const consById = mapById(state.cons);
  let list = [];
  if (state.activeTab === 'packages') {
    const pkg = activePackage();
    if (pkg) list = state.cons.filter(con => con.packageId === pkg.id).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  } else {
    const collection = activeCollection();
    if (collection) {
      list = collection.items.map(id => consById.get(id) || ({
        id, name: '미보유/미동기화 콘', packageId: '', thumbnailUrl: '', missing: true
      }));
    }
  }
  const query = state.search.trim().toLowerCase();
  if (query) list = list.filter(con => `${con.name} ${con.id}`.toLowerCase().includes(query));
  return list;
}

function setSelection(ids, anchorId = null) {
  state.selectedIds = new Set(ids);
  state.selectionAnchorId = anchorId;
  renderGrid();
  renderSelectionStatus();
}

function handleCardSelection(event, id) {
  const ids = visibleCons().map(con => con.id);
  const toggle = event.ctrlKey || event.metaKey;
  if (event.shiftKey && state.selectionAnchorId && ids.includes(state.selectionAnchorId)) {
    const a = ids.indexOf(state.selectionAnchorId);
    const b = ids.indexOf(id);
    const range = ids.slice(Math.min(a, b), Math.max(a, b) + 1);
    setSelection(toggle ? new Set([...state.selectedIds, ...range]) : new Set(range), state.selectionAnchorId);
    return;
  }
  if (toggle) {
    const next = new Set(state.selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelection(next, id);
    return;
  }
  setSelection([id], id);
}

function dragIdsFor(id) {
  if (state.selectedIds.has(id)) return visibleCons().map(con => con.id).filter(conId => state.selectedIds.has(conId));
  setSelection([id], id);
  return [id];
}

function writeDragData(event, ids) {
  return writeConTransfer(event.dataTransfer, ids);
}

function readDragData(event) {
  return readTransferIds(event.dataTransfer, CON_IDS_MIME);
}

function writeStoryDragData(event, ids) {
  return writeStoryTransfer(event.dataTransfer, ids);
}

function readStoryDragData(event) {
  return readTransferIds(event.dataTransfer, STORY_IDS_MIME);
}

function renderTabs() {
  document.querySelectorAll('[data-library-tab]').forEach(button => {
    button.classList.toggle('active', button.dataset.libraryTab === state.activeTab);
  });
  el.packagePanel.classList.toggle('hidden', state.activeTab !== 'packages');
  el.collectionPanel.classList.toggle('hidden', state.activeTab !== 'collections');
}

function renderPackageList() {
  el.packageList.replaceChildren();
  if (!state.packages.length) {
    const div = document.createElement('div');
    div.className = 'nav-empty';
    div.textContent = '동기화된 디시콘이 없습니다.';
    el.packageList.append(div);
    return;
  }
  state.packages.forEach(pkg => {
    const button = document.createElement('button');
    button.className = 'nav-item';
    button.classList.toggle('active', pkg.id === state.activePackageId);
    const count = state.cons.filter(con => con.packageId === pkg.id).length;
    button.innerHTML = `<span>${escapeHtml(pkg.name)}</span><small>${count}</small>`;
    button.addEventListener('click', () => {
      state.activePackageId = pkg.id;
      state.activeTab = 'packages';
      state.selectedIds.clear();
      state.selectionAnchorId = null;
      renderAll();
    });
    el.packageList.append(button);
  });
}

function renderCollectionList() {
  el.collectionList.replaceChildren();
  if (!state.collections.length) {
    const div = document.createElement('div');
    div.className = 'nav-empty';
    div.textContent = '새 콘묶음을 만들어 디시콘을 분류해 보세요.';
    el.collectionList.append(div);
    return;
  }
  state.collections.forEach(collection => {
    const row = document.createElement('div');
    row.className = 'collection-row';
    row.classList.toggle('active', collection.id === state.activeCollectionId);
    const button = document.createElement('button');
    button.className = 'collection-main';
    button.innerHTML = `<span>${escapeHtml(collection.name)}</span><small>${collection.items.length}</small>`;
    button.addEventListener('click', () => {
      state.activeCollectionId = collection.id;
      state.activeTab = 'collections';
      state.selectedIds.clear();
      state.selectionAnchorId = null;
      renderAll();
    });
    row.addEventListener('dragover', event => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      row.classList.add('drop-target');
    });
    row.addEventListener('dragleave', () => row.classList.remove('drop-target'));
    row.addEventListener('drop', async event => {
      event.preventDefault();
      row.classList.remove('drop-target');
      const ids = readDragData(event);
      if (ids.length) await addIdsToCollection(collection.id, ids);
    });
    const del = document.createElement('button');
    del.className = 'icon-button';
    del.title = '콘묶음 삭제';
    del.textContent = '×';
    del.addEventListener('click', async event => {
      event.stopPropagation();
      if (!confirm(`“${collection.name}” 콘묶음을 삭제할까요?\n콘묶음만 삭제되며 원본 디시콘은 삭제되지 않습니다.`)) return;
      await deleteOne('collections', collection.id);
      state.collections = state.collections.filter(item => item.id !== collection.id);
      if (state.activeCollectionId === collection.id) state.activeCollectionId = state.collections[0]?.id || null;
      renderAll();
    });
    row.append(button, del);
    el.collectionList.append(row);
  });
}

function renderGrid() {
  const list = visibleCons();
  el.conGrid.replaceChildren();
  el.libraryEmpty.classList.toggle('hidden', list.length > 0);
  el.libraryTitle.textContent = (state.activeTab === 'packages' ? activePackage()?.name : activeCollection()?.name) || '콘 라이브러리';
  list.forEach(con => {
    const card = document.createElement('button');
    card.className = 'con-card';
    card.draggable = !con.missing;
    card.dataset.conId = con.id;
    card.classList.toggle('selected', state.selectedIds.has(con.id));
    card.classList.toggle('missing', Boolean(con.missing));
    const image = con.thumbnailUrl ? `<img src="${escapeAttr(con.thumbnailUrl)}" alt="">` : '<div class="missing-thumb">?</div>';
    card.innerHTML = `${image}<span>${escapeHtml(con.name)}</span>`;
    card.title = con.missing ? con.id : `${con.name}\n${con.id}`;
    card.addEventListener('click', event => handleCardSelection(event, con.id));
    card.addEventListener('dblclick', () => {
      if (!con.missing) addConBlocks([con.id]);
    });
    card.addEventListener('dragstart', event => {
      if (con.missing) return event.preventDefault();
      writeDragData(event, dragIdsFor(con.id));
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
    if (state.activeTab === 'collections') {
      card.addEventListener('dragover', event => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        card.classList.add('reorder-target');
      });
      card.addEventListener('dragleave', () => card.classList.remove('reorder-target'));
      card.addEventListener('drop', async event => {
        event.preventDefault();
        card.classList.remove('reorder-target');
        await reorderActiveCollection(readDragData(event), con.id);
      });
    }
    el.conGrid.append(card);
  });
  if (state.activeTab === 'collections' && activeCollection()) {
    const tail = document.createElement('div');
    tail.className = 'reorder-tail';
    tail.textContent = '여기에 놓으면 맨 뒤로 이동';
    tail.addEventListener('dragover', event => event.preventDefault());
    tail.addEventListener('drop', async event => {
      event.preventDefault();
      await reorderActiveCollection(readDragData(event), null);
    });
    el.conGrid.append(tail);
  }
}

function renderSelectionStatus() {
  el.selectionStatus.textContent = `${state.selectedIds.size}개 선택`;
}

function storyConIds() {
  return state.story.items.filter(item => item.type === 'con').map(item => item.id);
}

function setStorySelection(ids, anchorId = null, rerender = true) {
  state.storySelectedIds = new Set(ids);
  state.storySelectionAnchorId = anchorId;
  if (rerender) renderStory();
  else {
    el.storyList.querySelectorAll('.story-con').forEach(row => {
      row.classList.toggle('selected', state.storySelectedIds.has(row.dataset.storyId));
    });
    updateStoryStats();
  }
}

function handleStorySelection(event, itemId) {
  if (event.target.closest('.story-tools')) return;
  const ids = storyConIds();
  const toggle = event.ctrlKey || event.metaKey;
  if (event.shiftKey && state.storySelectionAnchorId && ids.includes(state.storySelectionAnchorId)) {
    const a = ids.indexOf(state.storySelectionAnchorId);
    const b = ids.indexOf(itemId);
    const range = ids.slice(Math.min(a, b), Math.max(a, b) + 1);
    setStorySelection(toggle ? new Set([...state.storySelectedIds, ...range]) : new Set(range), state.storySelectionAnchorId);
    return;
  }
  if (toggle) {
    const next = new Set(state.storySelectedIds);
    if (next.has(itemId)) next.delete(itemId);
    else next.add(itemId);
    setStorySelection(next, itemId);
    return;
  }
  setStorySelection([itemId], itemId);
}

function storyDragIdsFor(itemId) {
  if (state.storySelectedIds.has(itemId)) {
    return state.story.items.filter(item => state.storySelectedIds.has(item.id)).map(item => item.id);
  }
  setStorySelection([itemId], itemId);
  return [itemId];
}

function updateStoryStats() {
  const selected = state.storySelectedIds.size;
  el.storyStats.textContent = selected ? `${state.story.items.length}블록 · ${selected}개 선택` : `${state.story.items.length}블록`;
}

function makeStoryTools(item) {
  const tools = document.createElement('div');
  tools.className = 'story-tools';
  tools.append(
    storyTool('↑', '위로', () => moveStorySelection(-1, item.id)),
    storyTool('↓', '아래로', () => moveStorySelection(1, item.id)),
    storyTool('×', '삭제', () => removeStorySelection(item.id))
  );
  return tools;
}

function addStoryDropHandlers(row, itemId) {
  row.addEventListener('dragover', event => {
    const storyIds = readStoryDragData(event);
    const conIds = readDragData(event);
    if (!storyIds.length && !conIds.length) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = storyIds.length ? 'move' : 'copy';
    row.classList.add('story-drag-target');
  });
  row.addEventListener('dragleave', () => row.classList.remove('story-drag-target'));
  row.addEventListener('drop', async event => {
    event.preventDefault();
    row.classList.remove('story-drag-target');
    const storyIds = readStoryDragData(event);
    if (storyIds.length) {
      await reorderStoryItems(storyIds, itemId);
      return;
    }
    const conIds = readDragData(event);
    if (conIds.length) await addConBlocks(conIds, itemId);
  });
}

function renderStory() {
  const consById = mapById(state.cons);
  el.storyList.replaceChildren();
  state.story.items.forEach(item => {
    const row = document.createElement('div');
    row.className = `story-item story-${item.type}`;
    row.dataset.storyId = item.id;
    addStoryDropHandlers(row, item.id);

    if (item.type === 'text') {
      const textarea = document.createElement('textarea');
      textarea.rows = 2;
      textarea.placeholder = '대사를 입력하세요.';
      textarea.value = item.text || '';
      textarea.addEventListener('input', async () => {
        item.text = textarea.value;
        await saveStory();
      });
      row.append(textarea, makeStoryTools(item));
    } else if (item.type === 'con') {
      const con = consById.get(item.conId);
      row.draggable = true;
      row.classList.toggle('selected', state.storySelectedIds.has(item.id));
      const img = document.createElement('img');
      if (con?.thumbnailUrl) img.src = con.thumbnailUrl;
      img.alt = con?.name || '미보유 콘';
      const label = document.createElement('span');
      label.textContent = con?.name || `미보유: ${item.conId}`;
      row.append(img, label, makeStoryTools(item));
      row.addEventListener('click', event => handleStorySelection(event, item.id));
      row.addEventListener('dragstart', event => {
        writeStoryDragData(event, storyDragIdsFor(item.id));
        row.classList.add('dragging');
      });
      row.addEventListener('dragend', () => row.classList.remove('dragging'));
    }
    el.storyList.append(row);
  });

  const tail = document.createElement('div');
  tail.className = 'story-tail-drop';
  tail.textContent = state.story.items.length ? '여기에 놓으면 원고 맨 뒤로 이동' : '';
  tail.addEventListener('dragover', event => {
    const storyIds = readStoryDragData(event);
    const conIds = readDragData(event);
    if (!storyIds.length && !conIds.length) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = storyIds.length ? 'move' : 'copy';
    tail.classList.add('drop-target');
  });
  tail.addEventListener('dragleave', () => tail.classList.remove('drop-target'));
  tail.addEventListener('drop', async event => {
    event.preventDefault();
    tail.classList.remove('drop-target');
    const storyIds = readStoryDragData(event);
    if (storyIds.length) {
      await reorderStoryItems(storyIds, null);
      return;
    }
    const conIds = readDragData(event);
    if (conIds.length) await addConBlocks(conIds);
  });
  el.storyList.append(tail);
  updateStoryStats();
}

function storyTool(text, title, action) {
  const button = document.createElement('button');
  button.className = 'icon-button';
  button.textContent = text;
  button.title = title;
  button.addEventListener('click', event => {
    event.stopPropagation();
    action();
  });
  return button;
}

async function saveStory() {
  state.story.updatedAt = Date.now();
  await putOne('documents', state.story);
  updateStoryStats();
}

async function addConBlocks(ids, beforeStoryId = null) {
  const consById = mapById(state.cons);
  const newItems = ids.filter(id => consById.has(id)).map(conId => ({
    id: makeStoryItemId(),
    type: 'con',
    conId
  }));
  if (!newItems.length) return;
  let insertAt = beforeStoryId ? state.story.items.findIndex(item => item.id === beforeStoryId) : state.story.items.length;
  if (insertAt < 0) insertAt = state.story.items.length;
  state.story.items.splice(insertAt, 0, ...newItems);
  state.storySelectedIds = new Set(newItems.map(item => item.id));
  state.storySelectionAnchorId = newItems[0]?.id || null;
  await saveStory();
  renderStory();
}

async function reorderStoryItems(movingIds, beforeId = null) {
  const moving = new Set(movingIds);
  const movingItems = state.story.items.filter(item => moving.has(item.id));
  if (!movingItems.length) return false;
  const remaining = state.story.items.filter(item => !moving.has(item.id));
  let insertAt = beforeId ? remaining.findIndex(item => item.id === beforeId) : remaining.length;
  if (insertAt < 0) insertAt = remaining.length;
  remaining.splice(insertAt, 0, ...movingItems);
  state.story.items = remaining;
  state.storySelectedIds = new Set(movingItems.filter(item => item.type === 'con').map(item => item.id));
  state.storySelectionAnchorId = movingItems.find(item => item.type === 'con')?.id || null;
  await saveStory();
  renderStory();
  return true;
}

export async function moveStoryItemsBefore(movingIds, beforeId = null) {
  const ids = Array.isArray(movingIds) ? movingIds.filter(id => typeof id === 'string' && id) : [];
  if (!ids.length) return false;
  return reorderStoryItems(ids, beforeId);
}

export async function applyStoryDropTransfer(dataTransfer, beforeId = null) {
  if (!dataTransfer) return false;
  const storyIds = readStoryDragData({ dataTransfer });
  if (storyIds.length) {
    return moveStoryItemsBefore(storyIds, beforeId);
  }
  const conIds = readDragData({ dataTransfer });
  if (conIds.length) {
    await addConBlocks(conIds, beforeId);
    return true;
  }
  return false;
}

async function moveStorySelection(delta, fallbackId) {
  const selected = state.storySelectedIds.has(fallbackId)
    ? new Set(state.storySelectedIds)
    : new Set([fallbackId]);
  const selectedItems = state.story.items.filter(item => selected.has(item.id));
  if (!selectedItems.length) return;

  const firstIndex = state.story.items.findIndex(item => selected.has(item.id));
  let lastIndex = -1;
  state.story.items.forEach((item, index) => {
    if (selected.has(item.id)) lastIndex = index;
  });

  if (delta < 0) {
    let targetIndex = firstIndex - 1;
    while (targetIndex >= 0 && selected.has(state.story.items[targetIndex].id)) targetIndex -= 1;
    if (targetIndex < 0) return;
    await reorderStoryItems([...selected], state.story.items[targetIndex].id);
    return;
  }

  let targetIndex = lastIndex + 1;
  while (targetIndex < state.story.items.length && selected.has(state.story.items[targetIndex].id)) targetIndex += 1;
  if (targetIndex >= state.story.items.length) return;

  const targetId = state.story.items[targetIndex].id;
  const remaining = state.story.items.filter(item => !selected.has(item.id));
  const targetPos = remaining.findIndex(item => item.id === targetId);
  remaining.splice(targetPos + 1, 0, ...selectedItems);
  state.story.items = remaining;
  state.storySelectedIds = new Set(selectedItems.filter(item => item.type === 'con').map(item => item.id));
  state.storySelectionAnchorId = selectedItems.find(item => item.type === 'con')?.id || null;
  await saveStory();
  renderStory();
}

async function removeStorySelection(fallbackId) {
  const selected = state.storySelectedIds.has(fallbackId)
    ? new Set(state.storySelectedIds)
    : new Set([fallbackId]);
  state.story.items = state.story.items.filter(item => !selected.has(item.id));
  state.storySelectedIds.clear();
  state.storySelectionAnchorId = null;
  await saveStory();
  renderStory();
}

async function addIdsToCollection(collectionId, ids) {
  const collection = state.collections.find(item => item.id === collectionId);
  if (!collection) return;
  const result = addUniqueIds(collection, ids);
  if (!result.added) {
    toast('이미 이 콘묶음에 들어 있는 디시콘입니다.');
    return;
  }
  const next = result.collection;
  await putOne('collections', next);
  state.collections = state.collections.map(item => item.id === collectionId ? next : item);
  toast(`${result.added}개 디시콘을 콘묶음에 추가했습니다.`);
  renderCollectionList();
  if (state.activeCollectionId === collectionId) renderGrid();
}

async function reorderActiveCollection(ids, beforeId) {
  const collection = activeCollection();
  if (!collection || !ids.length) return;
  const next = reorderIds(collection, ids, beforeId);
  await putOne('collections', next);
  state.collections = state.collections.map(item => item.id === next.id ? next : item);
  renderGrid();
  renderCollectionList();
}

async function removeSelectedFromCollection() {
  const collection = activeCollection();
  if (!collection || !state.selectedIds.size) return;
  const next = removeIds(collection, [...state.selectedIds]);
  await putOne('collections', next);
  state.collections = state.collections.map(item => item.id === next.id ? next : item);
  state.selectedIds.clear();
  state.selectionAnchorId = null;
  renderAll();
}

function renderAll() {
  renderTabs();
  renderPackageList();
  renderCollectionList();
  renderGrid();
  renderSelectionStatus();
  renderStory();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[char]);
}

function escapeAttr(value) {
  return escapeHtml(value);
}

const selectionBox = document.createElement('div');
selectionBox.className = 'story-selection-box hidden';
document.body.append(selectionBox);
let boxSelection = null;

el.storyList.addEventListener('pointerdown', event => {
  if (event.button !== 0 || event.target.closest('.story-item, button, textarea')) return;
  const additive = event.ctrlKey || event.metaKey;
  boxSelection = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    base: additive ? new Set(state.storySelectedIds) : new Set()
  };
  el.storyList.setPointerCapture(event.pointerId);
  selectionBox.classList.remove('hidden');
  event.preventDefault();
});

el.storyList.addEventListener('pointermove', event => {
  if (!boxSelection || boxSelection.pointerId !== event.pointerId) return;
  const left = Math.min(boxSelection.startX, event.clientX);
  const top = Math.min(boxSelection.startY, event.clientY);
  const right = Math.max(boxSelection.startX, event.clientX);
  const bottom = Math.max(boxSelection.startY, event.clientY);
  selectionBox.style.left = `${left}px`;
  selectionBox.style.top = `${top}px`;
  selectionBox.style.width = `${right - left}px`;
  selectionBox.style.height = `${bottom - top}px`;

  const next = new Set(boxSelection.base);
  el.storyList.querySelectorAll('.story-con').forEach(row => {
    const rect = row.getBoundingClientRect();
    const intersects = rect.left < right && rect.right > left && rect.top < bottom && rect.bottom > top;
    if (intersects) next.add(row.dataset.storyId);
  });
  const anchor = [...next][0] || null;
  setStorySelection(next, anchor, false);
});

function finishBoxSelection(event) {
  if (!boxSelection || boxSelection.pointerId !== event.pointerId) return;
  if (el.storyList.hasPointerCapture(event.pointerId)) el.storyList.releasePointerCapture(event.pointerId);
  boxSelection = null;
  selectionBox.classList.add('hidden');
}

el.storyList.addEventListener('pointerup', finishBoxSelection);
el.storyList.addEventListener('pointercancel', finishBoxSelection);

document.querySelectorAll('[data-library-tab]').forEach(button => button.addEventListener('click', () => {
  state.activeTab = button.dataset.libraryTab;
  state.selectedIds.clear();
  state.selectionAnchorId = null;
  renderAll();
}));

el.dcWriteUrlInput.addEventListener('change', () => {
  localStorage.setItem(DC_WRITE_URL_KEY, el.dcWriteUrlInput.value.trim());
});

el.searchInput.addEventListener('input', () => {
  state.search = el.searchInput.value;
  renderGrid();
});

el.selectAllBtn.addEventListener('click', () => {
  const ids = visibleCons().map(con => con.id).filter(id => state.cons.some(con => con.id === id));
  setSelection(ids, ids[0] || null);
});

el.clearSelectionBtn.addEventListener('click', () => setSelection([]));

el.newCollectionBtn.addEventListener('click', async () => {
  const name = prompt('새 콘묶음 이름을 입력하세요.');
  if (name == null) return;
  try {
    const collection = createCollection(name);
    await putOne('collections', collection);
    state.collections.push(collection);
    state.activeCollectionId = collection.id;
    state.activeTab = 'collections';
    renderAll();
  } catch (error) {
    alert(error.message);
  }
});

el.syncDcBtn.addEventListener('click', async () => {
  const writeUrl = el.dcWriteUrlInput.value.trim();
  if (!writeUrl) {
    alert('먼저 사용할 갤러리의 글쓰기 페이지 주소를 입력해주세요.');
    el.dcWriteUrlInput.focus();
    return;
  }
  localStorage.setItem(DC_WRITE_URL_KEY, writeUrl);
  el.syncDcBtn.disabled = true;
  el.syncDcBtn.textContent = 'DC에서 읽는 중…';
  try {
    const payload = await requestDcSync({ writeUrl });
    await applySyncPayload(payload);
    toast('디시콘 목록을 동기화했습니다.');
  } catch (error) {
    alert(`${error.message}\n\nDC 브리지가 설치되어 있고 같은 브라우저에서 DCInside에 로그인되어 있는지 확인해주세요.`);
  } finally {
    el.syncDcBtn.disabled = false;
    el.syncDcBtn.textContent = 'DC 동기화';
  }
});

el.exportCollectionBtn.addEventListener('click', () => {
  const collection = activeCollection();
  if (!collection) return alert('먼저 내 콘묶음에서 내보낼 콘묶음을 선택하세요.');
  downloadJson(`${fileNameSafe(collection.name)}.hhjconset.json`, exportCollection(collection, mapById(state.cons), mapById(state.packages)));
});

el.importCollectionInput.addEventListener('change', async () => {
  const file = el.importCollectionInput.files?.[0];
  el.importCollectionInput.value = '';
  if (!file) return;
  try {
    const collection = importCollectionFile(JSON.parse(await file.text()));
    await putOne('collections', collection);
    state.collections.push(collection);
    state.activeCollectionId = collection.id;
    state.activeTab = 'collections';
    renderAll();
    toast('콘묶음을 불러왔습니다.');
  } catch (error) {
    alert(`콘묶음 파일을 불러올 수 없습니다.\n${error.message}`);
  }
});

el.addSelectedConsBtn.addEventListener('click', async () => {
  const ids = visibleCons().map(con => con.id).filter(id => state.selectedIds.has(id) && state.cons.some(con => con.id === id));
  if (!ids.length) {
    toast('먼저 콘 라이브러리에서 넣을 디시콘을 선택해주세요.');
    return;
  }
  await addConBlocks(ids);
});

el.addTextBtn.addEventListener('click', async () => {
  state.story.items.push({ id: makeStoryItemId(), type: 'text', text: '' });
  state.storySelectedIds.clear();
  state.storySelectionAnchorId = null;
  await saveStory();
  renderStory();
  el.storyList.querySelector('.story-text:last-of-type textarea')?.focus();
});

el.clearStoryBtn.addEventListener('click', async () => {
  if (state.story.items.length && !confirm('현재 원고를 모두 비울까요?')) return;
  state.story.items = [];
  state.storySelectedIds.clear();
  state.storySelectionAnchorId = null;
  await saveStory();
  renderStory();
});

el.storyDropZone.addEventListener('dragover', event => {
  const storyIds = readStoryDragData(event);
  const conIds = readDragData(event);
  if (!storyIds.length && !conIds.length) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = storyIds.length ? 'move' : 'copy';
  el.storyDropZone.classList.add('drop-target');
});

el.storyDropZone.addEventListener('dragleave', () => el.storyDropZone.classList.remove('drop-target'));

el.storyDropZone.addEventListener('drop', async event => {
  event.preventDefault();
  el.storyDropZone.classList.remove('drop-target');
  const storyIds = readStoryDragData(event);
  if (storyIds.length) {
    await reorderStoryItems(storyIds, state.story.items[0]?.id || null);
    return;
  }
  const conIds = readDragData(event);
  if (conIds.length) await addConBlocks(conIds);
});

window.addEventListener('keydown', event => {
  if (document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.tagName === 'INPUT') return;

  if (event.key === 'Delete' && state.storySelectedIds.size) {
    event.preventDefault();
    removeStorySelection([...state.storySelectedIds][0]);
    return;
  }

  if (event.key === 'Delete' && state.activeTab === 'collections') {
    removeSelectedFromCollection();
  }
});

loadState().catch(error => {
  alert(`초기화 중 오류가 발생했습니다.\n${error.message}`);
});