import { deleteOne, getAll, getOne, putMany, putOne, replaceStores } from './db.js';
import {
  addUniqueIds,
  applyCollectionItemDraft,
  createCollection,
  normalizeSyncPayload,
  preserveCollectionRefMeta,
  preserveStoryConRefs,
  reorderIds
} from './model.js?v=20260912-1';
import { requestDcSync } from './integrations/dc-adapter.js?v=20260910-1';
import { selectVisibleCons } from './library/library-view.js?v=20260911-2';
import {
  createMissingThumbnail,
  renderCollectionNavigation,
  renderConGrid,
  renderPackageNavigation
} from './library/library-render.js?v=20260913-1';
import { planOrderedSelection } from './core/selection.js?v=20260907-1';
import { installBoxSelection } from './core/box-selection.js?v=20260913-2';
import { insertStoryItemsBefore, planStoryItemReorder, planStorySelectionStep } from './story/story-order.js?v=20260911-1';
import { renderStoryList } from './story/story-render.js?v=20260913-2';
import { showToast } from './ui/toast.js?v=20260909-2';
import {
  CON_IDS_MIME,
  STORY_IDS_MIME,
  readTransferIds
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
  'syncDcBtn', 'dcWriteUrlInput',
  'packagePanel', 'collectionPanel', 'packageList', 'collectionList',
  'libraryTitle', 'selectionStatus', 'searchInput', 'selectAllBtn', 'clearSelectionBtn',
  'libraryEmpty', 'conGrid', 'storyList', 'storyDropZone', 'storyStats', 'addTextBtn',
  'addSelectedConsBtn', 'syncStatus'
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

async function loadState() {
  const [packages, cons, collections, story, meta] = await Promise.all([
    getAll('packages'), getAll('cons'), getAll('collections'), getOne('documents', 'current'), getOne('meta', 'lastSync')
  ]);
  state.packages = packages.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  state.cons = cons;
  state.collections = collections.sort((a, b) => a.createdAt - b.createdAt);
  state.story = story || state.story;
  const addedItemIds = ensureStoryItemIds();
  const previousStory = state.story;
  state.story = preserveStoryConRefs(state.story, mapById(state.cons), mapById(state.packages));
  if (addedItemIds || state.story !== previousStory) await putOne('documents', state.story);
  state.activePackageId = state.packages[0]?.id || null;
  state.activeCollectionId = state.collections[0]?.id || null;
  el.dcWriteUrlInput.value = localStorage.getItem(DC_WRITE_URL_KEY) || '';
  updateSyncStatus(meta);
  renderAll();
}

function updateSyncStatus(meta) {
  if (!meta?.syncedAt) {
    el.syncStatus.textContent = '미동기화';
    return;
  }
  const syncedAt = new Date(meta.syncedAt);
  el.syncStatus.textContent = `${syncedAt.toLocaleDateString('ko-KR')}\n${syncedAt.toLocaleTimeString('ko-KR')}`;
}

async function preserveCollectionMetadata(cons, packages) {
  const consById = mapById(cons);
  const packagesById = mapById(packages);
  const nextCollections = state.collections.map(collection =>
    preserveCollectionRefMeta(collection, consById, packagesById)
  );
  const changed = nextCollections.filter((collection, index) => collection !== state.collections[index]);
  if (changed.length) await putMany('collections', changed);
  state.collections = nextCollections;
}

async function preserveStoryMetadata(cons, packages) {
  const nextStory = preserveStoryConRefs(state.story, mapById(cons), mapById(packages));
  if (nextStory === state.story) return;
  state.story = nextStory;
  await putOne('documents', state.story);
}

async function applySyncPayload(rawPayload) {
  const payload = normalizeSyncPayload(rawPayload);
  await preserveCollectionMetadata(state.cons, state.packages);
  await preserveStoryMetadata(state.cons, state.packages);
  await replaceStores({ packages: payload.packages, cons: payload.cons });
  await putOne('meta', { key: 'lastSync', syncedAt: payload.syncedAt, account: payload.account });
  state.packages = payload.packages;
  state.cons = payload.cons;
  await preserveCollectionMetadata(state.cons, state.packages);
  await preserveStoryMetadata(state.cons, state.packages);
  if (!state.packages.some(pkg => pkg.id === state.activePackageId)) state.activePackageId = state.packages[0]?.id || null;
  state.selectedIds.clear();
  state.selectionAnchorId = null;
  updateSyncStatus({ syncedAt: payload.syncedAt });
  renderAll();
}

function visibleCons() {
  return selectVisibleCons(state);
}

function setSelection(ids, anchorId = null) {
  state.selectedIds = new Set(ids);
  state.selectionAnchorId = anchorId;
  el.conGrid.querySelectorAll('.con-card[data-con-id]').forEach(card => {
    card.classList.toggle('selected', state.selectedIds.has(card.dataset.conId));
  });
  renderSelectionStatus();
}

function handleCardSelection(event, id) {
  const ids = visibleCons().map(con => con.id);
  const next = planOrderedSelection(ids, state.selectedIds, state.selectionAnchorId, id, {
    toggle: event.ctrlKey || event.metaKey,
    range: event.shiftKey
  });
  setSelection(next.ids, next.anchorId);
}

function readDragData(event) {
  return readTransferIds(event.dataTransfer, CON_IDS_MIME);
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
  renderPackageNavigation(el.packageList, {
    packages: state.packages,
    cons: state.cons,
    activeId: state.activePackageId,
    onSelect: packageId => {
      state.activePackageId = packageId;
      state.activeTab = 'packages';
      state.selectedIds.clear();
      state.selectionAnchorId = null;
      renderLibrary();
    }
  });
}

function renderCollectionList() {
  renderCollectionNavigation(el.collectionList, {
    collections: state.collections,
    activeId: state.activeCollectionId,
    onSelect: collectionId => {
      state.activeCollectionId = collectionId;
      state.activeTab = 'collections';
      state.selectedIds.clear();
      state.selectionAnchorId = null;
      renderLibrary();
    },
    onDrop: async (event, collectionId) => {
      const ids = readDragData(event);
      if (ids.length) await addIdsToCollection(collectionId, ids);
    }
  });
}

function renderGrid() {
  const list = visibleCons();
  el.conGrid.replaceChildren();
  el.libraryEmpty.classList.toggle('hidden', list.length > 0);
  el.libraryTitle.textContent = (state.activeTab === 'packages' ? activePackage()?.name : activeCollection()?.name) || '콘 라이브러리';
  renderConGrid(el.conGrid, {
    cons: list,
    selectedIds: state.selectedIds,
    collectionMode: state.activeTab === 'collections' && Boolean(activeCollection()),
    onSelect: handleCardSelection,
    onOpen: conId => addConBlocks([conId]),
    onDrop: (event, beforeId) => reorderActiveCollection(readDragData(event), beforeId)
  });
}

function renderSelectionStatus() {
  el.selectionStatus.textContent = `${state.selectedIds.size}개 선택`;
}

function storyConIds() {
  return state.story.items.filter(item => item.type === 'con').map(item => item.id);
}

function setStorySelection(ids, anchorId = null) {
  state.storySelectedIds = new Set(ids);
  state.storySelectionAnchorId = anchorId;
  el.storyList.querySelectorAll('.story-con').forEach(row => {
    row.classList.toggle('selected', state.storySelectedIds.has(row.dataset.storyId));
  });
  updateStoryStats();
}

function clearStorySelectionOutsideStory(target) {
  if (!state.storySelectedIds.size || !(target instanceof Node)) return;
  if (el.storyList.contains(target) || el.storyDropZone.contains(target)) return;
  setStorySelection([]);
}

function handleStorySelection(event, itemId) {
  if (event.target.closest('.story-tools')) return;
  const ids = storyConIds();
  const next = planOrderedSelection(ids, state.storySelectedIds, state.storySelectionAnchorId, itemId, {
    toggle: event.ctrlKey || event.metaKey,
    range: event.shiftKey
  });
  setStorySelection(next.ids, next.anchorId);
}

function updateStoryStats() {
  const selected = state.storySelectedIds.size;
  el.storyStats.textContent = selected ? `${state.story.items.length}블록 · ${selected}개 선택` : `${state.story.items.length}블록`;
}

function renderStory() {
  renderStoryList(el.storyList, {
    items: state.story.items,
    cons: state.cons,
    selectedIds: state.storySelectedIds,
    createMissingThumbnail,
    onTextInput: updateStoryText,
    onMove: moveStorySelection,
    onRemove: removeStorySelection,
    onSelect: handleStorySelection,
    onDrop: applyStoryDropTransfer
  });
  updateStoryStats();
  document.dispatchEvent(new Event('hhjcon:story-rendered'));
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
  await commitStoryItems(insertStoryItemsBefore(state.story.items, newItems, beforeStoryId), newItems);
}

async function updateStoryText(itemId, text) {
  const item = state.story.items.find(candidate => candidate.id === itemId && candidate.type === 'text');
  if (!item) return false;
  item.text = text;
  await saveStory();
  return true;
}

async function commitStoryItems(items, selectedItems = []) {
  state.story = preserveStoryConRefs({ ...state.story, items }, mapById(state.cons), mapById(state.packages));
  state.storySelectedIds = new Set(selectedItems.filter(item => item.type === 'con').map(item => item.id));
  state.storySelectionAnchorId = selectedItems.find(item => item.type === 'con')?.id || null;
  await saveStory();
  renderStory();
  return true;
}

export function hasCurrentStoryItems() {
  return state.story.items.length > 0;
}

export async function clearCurrentStory() {
  await commitStoryItems([]);
}

export async function appendStoryTextBlock(text = '') {
  const item = { id: makeStoryItemId(), type: 'text', text: String(text ?? '') };
  await commitStoryItems(insertStoryItemsBefore(state.story.items, [item]));
  return item.id;
}

async function commitStoryOrder(plan) {
  if (!plan) return false;
  return commitStoryItems(plan.items, plan.movingItems);
}

async function reorderStoryItems(movingIds, beforeId = null) {
  return commitStoryOrder(planStoryItemReorder(state.story.items, movingIds, beforeId));
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
  await commitStoryOrder(planStorySelectionStep(state.story.items, [...selected], delta));
}

async function removeStorySelection(fallbackId) {
  const selected = state.storySelectedIds.has(fallbackId)
    ? new Set(state.storySelectedIds)
    : new Set([fallbackId]);
  await commitStoryItems(state.story.items.filter(item => !selected.has(item.id)));
}

async function commitCollectionState(collection) {
  await putOne('collections', collection);
  state.collections = state.collections.map(item => item.id === collection.id ? collection : item);
  return collection;
}

export async function createNamedCollection(name) {
  const collection = createCollection(name);
  await putOne('collections', collection);
  state.collections.push(collection);
  state.activeCollectionId = collection.id;
  state.activeTab = 'collections';
  renderLibrary();
  return collection.id;
}

export async function deleteCollectionById(collectionId) {
  if (!state.collections.some(item => item.id === collectionId)) return false;
  await deleteOne('collections', collectionId);
  state.collections = state.collections.filter(item => item.id !== collectionId);
  if (state.activeCollectionId === collectionId) state.activeCollectionId = state.collections[0]?.id || null;
  renderLibrary();
  return true;
}

export async function commitCollectionDraft(collectionId, draftIds) {
  const collection = state.collections.find(item => String(item.id) === String(collectionId));
  if (!collection) return null;
  const next = applyCollectionItemDraft(collection, draftIds);
  if (next !== collection) {
    await commitCollectionState(next);
    renderCollectionList();
  }
  return next;
}

export async function addIdsToCollection(collectionId, ids) {
  const collection = state.collections.find(item => String(item.id) === String(collectionId));
  if (!collection) return;
  const result = addUniqueIds(collection, ids);
  if (!result.added) {
    showToast('이미 이 콘묶음에 들어 있는 디시콘입니다.', 1800);
    return;
  }
  const next = preserveCollectionRefMeta(result.collection, mapById(state.cons), mapById(state.packages));
  await commitCollectionState(next);
  showToast(`${result.added}개 디시콘을 콘묶음에 추가했습니다.`, 1800);
  renderCollectionList();
  if (state.activeCollectionId === collectionId) renderGrid();
}

async function reorderActiveCollection(ids, beforeId) {
  const collection = activeCollection();
  if (!collection || !ids.length) return;
  const next = reorderIds(collection, ids, beforeId);
  if (next === collection) return;
  await commitCollectionState(next);
  renderGrid();
  renderCollectionList();
}

function renderLibrary() {
  renderTabs();
  renderPackageList();
  renderCollectionList();
  renderGrid();
  renderSelectionStatus();
}

function renderAll() {
  renderLibrary();
  renderStory();
}

installBoxSelection(el.storyList, {
  itemSelector: '.story-con',
  idKey: 'storyId',
  getSelectedIds: () => state.storySelectedIds,
  setSelection: setStorySelection
});
installBoxSelection(el.conGrid, {
  itemSelector: '.con-card[data-con-id]',
  idKey: 'conId',
  getSelectedIds: () => state.selectedIds,
  setSelection
});

document.addEventListener('pointerdown', event => clearStorySelectionOutsideStory(event.target), true);
document.addEventListener('focusin', event => clearStorySelectionOutsideStory(event.target), true);

document.querySelectorAll('[data-library-tab]').forEach(button => button.addEventListener('click', () => {
  state.activeTab = button.dataset.libraryTab;
  state.selectedIds.clear();
  state.selectionAnchorId = null;
  renderLibrary();
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
    showToast('디시콘 목록을 동기화했습니다.', 1800);
  } catch (error) {
    alert(`${error.message}\n\nDC 브리지가 설치되어 있고 같은 브라우저에서 DCInside에 로그인되어 있는지 확인해주세요.`);
  } finally {
    el.syncDcBtn.disabled = false;
    el.syncDcBtn.textContent = 'DC 동기화';
  }
});

el.addSelectedConsBtn.addEventListener('click', async () => {
  const ids = visibleCons().map(con => con.id).filter(id => state.selectedIds.has(id) && state.cons.some(con => con.id === id));
  if (!ids.length) {
    showToast('먼저 콘 라이브러리에서 넣을 디시콘을 선택해주세요.', 1800);
    return;
  }
  await addConBlocks(ids);
});

el.addTextBtn.addEventListener('click', async () => {
  const storyId = await appendStoryTextBlock();
  const row = [...el.storyList.querySelectorAll(':scope > .story-text[data-story-id]')]
    .find(item => item.dataset.storyId === storyId);
  row?.querySelector('textarea')?.focus();
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

});

loadState().catch(error => {
  alert(`초기화 중 오류가 발생했습니다.\n${error.message}`);
});
