import { addIdsToCollection, commitCollectionDraft } from '../app.js?v=20260913-9';
import { getAll } from '../db.js';
import { CON_IDS_MIME, readTransferIds, transferHasType } from '../story-dnd-utils.js?v=20260906-2';
import {
  createCollectionEditDraft,
  deleteCollectionEditSelection,
  prepareCollectionEditDrag,
  reorderCollectionEditDraft,
  selectCollectionEditDraft
} from './library-edit-draft.js?v=20260914-1';
import { createCollectionEditControls } from './library-edit-controls.js?v=20260914-1';
import { renderLibraryViewTabs } from './library-tab-render.js?v=20260913-1';
import { closeLibraryView, libraryViewKey, openLibraryView, reconcileLibraryViews } from './library-tabs.js?v=20260911-2';

const packageList = document.getElementById('packageList');
const collectionList = document.getElementById('collectionList');
const packagePanel = document.getElementById('packagePanel');
const collectionPanel = document.getElementById('collectionPanel');
const libraryPanel = document.querySelector('.library-panel');
const libraryToolbar = document.querySelector('.library-toolbar');
const toolbarActions = libraryToolbar?.querySelector('.toolbar-actions');
const conGrid = document.getElementById('conGrid');
const searchInput = document.getElementById('searchInput');
const selectionStatus = document.getElementById('selectionStatus');

if (packageList && collectionList && packagePanel && collectionPanel && libraryPanel && toolbarActions && conGrid) {
  const SIDEBAR_KEY = 'hhjcon-sidebar-mode';
  const VIEWS_KEY = 'hhjcon-open-library-views';
  const ACTIVE_VIEW_KEY = 'hhjcon-active-library-view';
  const CLOSE_ALL_EVENT = 'hhjcon:library-close-all';
  const COLLECTION_CREATED_EVENT = 'hhjcon:collection-created';
  const NAVIGATION_RENDER_EVENT = 'hhjcon:library-navigation-rendered';
  let sidebarMode = localStorage.getItem(SIDEBAR_KEY) === 'collections' ? 'collections' : 'packages';
  let packages = [];
  let collections = [];
  let editDraft = null;
  let libraryDeleteArmed = false;
  let restorePending = true;
  let shouldOpenDefaultView = localStorage.getItem(VIEWS_KEY) === null;

  function readViews() {
    try {
      const value = JSON.parse(localStorage.getItem(VIEWS_KEY) || '[]');
      return Array.isArray(value)
        ? value.filter(item => item && (item.type === 'packages' || item.type === 'collections') && item.id)
        : [];
    } catch {
      return [];
    }
  }

  let openViews = readViews();
  let activeViewKey = localStorage.getItem(ACTIVE_VIEW_KEY) || '';

  const viewTabs = document.createElement('div');
  viewTabs.className = 'library-view-tabs';
  libraryPanel.insertBefore(viewTabs, libraryToolbar);

  const { editButton, deleteButton, saveButton, cancelButton, render: renderEditControls } =
    createCollectionEditControls(toolbarActions);

  function activeView() {
    return openViews.find(view => libraryViewKey(view.type, view.id) === activeViewKey) || null;
  }

  function persistViews() {
    localStorage.setItem(VIEWS_KEY, JSON.stringify(openViews));
    if (activeViewKey) localStorage.setItem(ACTIVE_VIEW_KEY, activeViewKey);
    else localStorage.removeItem(ACTIVE_VIEW_KEY);
  }

  function applySidebarMode() {
    document.querySelectorAll('.sidebar [data-library-tab]').forEach(button => {
      button.classList.toggle('active', button.dataset.libraryTab === sidebarMode);
    });
    packagePanel.classList.toggle('hidden', sidebarMode !== 'packages');
    collectionPanel.classList.toggle('hidden', sidebarMode !== 'collections');
    document.dispatchEvent(new Event('hhjcon:library-sidebar-rendered'));
  }

  function updateEditControls() {
    const view = activeView();
    const isCollection = view?.type === 'collections';
    const hasItems = isCollection && collections.some(item => String(item.id) === String(view.id) && item.items?.length);
    renderEditControls({ isCollection, editing: Boolean(editDraft), hasItems });
    conGrid.classList.toggle('collection-order-editing', Boolean(editDraft));
  }

  function renderDraftSelection() {
    const selectedIds = editDraft?.selectedIds || new Set();
    conGrid.querySelectorAll('.con-card[data-con-id]').forEach(card => {
      card.classList.toggle('selected', selectedIds.has(String(card.dataset.conId)));
    });
    if (selectionStatus) selectionStatus.textContent = `${selectedIds.size}개 선택`;
  }

  function cancelEditState() {
    editDraft = null;
    conGrid.classList.remove('collection-order-editing');
    updateEditControls();
  }

  function renderViewTabs() {
    renderLibraryViewTabs(viewTabs, {
      views: openViews,
      activeViewKey,
      onActivate: activateView,
      onDrop: async (event, view) => {
        const ids = dragIds(event);
        if (ids.length) await addIdsToCollection(view.id, ids);
      },
      onClose: (_view, key) => {
        const next = closeLibraryView(openViews, activeViewKey, key);
        if (!next) return;
        openViews = next.views;
        activeViewKey = next.activeViewKey;
        if (next.closedActive) {
          if (editDraft) cancelEditState();
          persistViews();
          renderViewTabs();
          if (next.nextView) activateView(next.nextView);
          else updateEditControls();
          return;
        }
        persistViews();
        renderViewTabs();
      }
    });
    updateEditControls();
  }

  function closeAllViews() {
    if (editDraft) cancelEditState();
    shouldOpenDefaultView = false;
    openViews = [];
    activeViewKey = '';
    persistViews();
    renderViewTabs();
  }

  viewTabs.addEventListener(CLOSE_ALL_EVENT, closeAllViews);

  function openView(type, id, name, activate = true) {
    shouldOpenDefaultView = false;
    const key = libraryViewKey(type, id);
    if (activate && editDraft && key !== libraryViewKey('collections', editDraft.collectionId)) cancelEditState();
    const next = openLibraryView(openViews, activeViewKey, { type, id, name }, activate);
    openViews = next.views;
    activeViewKey = next.activeViewKey;
    persistViews();
    renderViewTabs();
    return next.view;
  }

  function findNavElement(view) {
    if (view.type === 'packages') {
      return packageList.querySelector(`.nav-item[data-view-id="${CSS.escape(String(view.id))}"]`);
    }
    return collectionList.querySelector(`.collection-main[data-view-id="${CSS.escape(String(view.id))}"]`);
  }

  function activateView(view) {
    if (!view) return;
    if (editDraft && (view.type !== 'collections' || String(view.id) !== editDraft.collectionId)) cancelEditState();
    activeViewKey = libraryViewKey(view.type, view.id);
    persistViews();
    renderViewTabs();
    const target = findNavElement(view);
    if (target) target.click();
    annotateNavigation();
    applySidebarMode();
    updateEditControls();
  }

  async function refreshData() {
    [packages, collections] = await Promise.all([getAll('packages'), getAll('collections')]);
    packages.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    collections.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
    annotateNavigation();

    const nextViews = reconcileLibraryViews(
      openViews, activeViewKey, packages, collections, restorePending && shouldOpenDefaultView
    );
    openViews = nextViews.views;
    activeViewKey = nextViews.activeViewKey;
    if (nextViews.openedDefault) shouldOpenDefaultView = false;
    persistViews();
    renderViewTabs();

    if (restorePending) {
      const view = activeView();
      const target = view ? findNavElement(view) : null;
      if (view && target) {
        restorePending = false;
        queueMicrotask(() => activateView(view));
      }
    }
  }

  function annotateNavigation() {
    [...packageList.querySelectorAll('.nav-item')].forEach((button, index) => {
      const item = packages[index];
      if (!item) return;
      button.dataset.viewType = 'packages';
      button.dataset.viewId = String(item.id);
      button.dataset.viewName = String(item.name);
    });
    [...collectionList.querySelectorAll('.collection-row')].forEach((row, index) => {
      const item = collections[index];
      if (!item) return;
      row.dataset.viewType = 'collections';
      row.dataset.viewId = String(item.id);
      row.dataset.viewName = String(item.name);
      const main = row.querySelector('.collection-main');
      if (main) {
        main.dataset.viewType = 'collections';
        main.dataset.viewId = String(item.id);
        main.dataset.viewName = String(item.name);
      }
    });
    applySidebarMode();
  }

  function dragIds(event) {
    return readTransferIds(event.dataTransfer, CON_IDS_MIME);
  }

  function hasConDrag(event) {
    return transferHasType(event.dataTransfer, CON_IDS_MIME);
  }

  function orderedDraftSelection(fallbackId = null) {
    const prepared = prepareCollectionEditDrag(editDraft, fallbackId);
    if (prepared.draft !== editDraft) {
      editDraft = prepared.draft;
      renderDraftSelection();
    }
    return prepared.ids;
  }

  function moveDraftCards(ids, target) {
    const targetCard = target?.closest?.('.con-card[data-con-id]') || null;
    const beforeId = targetCard ? String(targetCard.dataset.conId) : null;
    const nextDraft = reorderCollectionEditDraft(editDraft, ids, beforeId);
    if (nextDraft === editDraft) return;
    editDraft = nextDraft;

    const cards = new Map(
      [...conGrid.querySelectorAll('.con-card[data-con-id]')].map(card => [String(card.dataset.conId), card])
    );
    const tail = conGrid.querySelector('.reorder-tail');
    editDraft.items.forEach(id => {
      const card = cards.get(id);
      if (!card) return;
      if (tail) conGrid.insertBefore(card, tail);
      else conGrid.append(card);
    });
  }

  function deleteDraftSelection() {
    if (!editDraft?.selectedIds.size) return;
    const removing = editDraft.selectedIds;
    editDraft = deleteCollectionEditSelection(editDraft);
    conGrid.querySelectorAll('.con-card[data-con-id]').forEach(card => {
      if (removing.has(String(card.dataset.conId))) card.remove();
    });
    renderDraftSelection();
  }

  editButton.addEventListener('click', () => {
    const view = activeView();
    if (!view || view.type !== 'collections') return;
    if (searchInput?.value) {
      searchInput.value = '';
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    editDraft = createCollectionEditDraft(
      view.id,
      [...conGrid.querySelectorAll('.con-card[data-con-id]')].map(card => String(card.dataset.conId)),
      [...conGrid.querySelectorAll('.con-card.selected[data-con-id]')].map(card => String(card.dataset.conId))
    );
    conGrid.querySelectorAll('.con-card[data-con-id]').forEach(card => { card.draggable = true; });
    renderDraftSelection();
    updateEditControls();
  });

  deleteButton.addEventListener('click', deleteDraftSelection);

  saveButton.addEventListener('click', async () => {
    if (!editDraft) return;
    const collectionId = editDraft.collectionId;
    const collection = await commitCollectionDraft(collectionId, editDraft.items);
    if (!collection) return;
    collections = collections.map(item => String(item.id) === collectionId ? collection : item);
    cancelEditState();
  });

  cancelButton.addEventListener('click', () => {
    const view = activeView();
    cancelEditState();
    if (view) activateView(view);
  });

  conGrid.addEventListener('click', event => {
    if (!editDraft) return;
    const card = event.target.closest('.con-card[data-con-id]');
    if (!card) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const id = String(card.dataset.conId);
    editDraft = selectCollectionEditDraft(editDraft, id, {
      toggle: event.ctrlKey || event.metaKey,
      range: event.shiftKey
    });
    renderDraftSelection();
  }, true);

  conGrid.addEventListener('dblclick', event => {
    if (!editDraft || !event.target.closest('.con-card[data-con-id]')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  conGrid.addEventListener('dragstart', event => {
    if (!editDraft) return;
    const card = event.target.closest('.con-card[data-con-id]');
    if (!card || !event.dataTransfer) return;
    event.stopImmediatePropagation();
    const id = String(card.dataset.conId);
    const ids = orderedDraftSelection(id);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(CON_IDS_MIME, JSON.stringify(ids));
    event.dataTransfer.setData('text/plain', ids.join('\n'));
    card.classList.add('dragging');
  }, true);

  conGrid.addEventListener('dragend', event => {
    event.target.closest('.con-card')?.classList.remove('dragging');
  }, true);

  conGrid.addEventListener('dragover', event => {
    const view = activeView();
    if (view?.type !== 'collections') return;
    const target = event.target.closest('.con-card, .reorder-tail');
    if (!target || (!hasConDrag(event) && !dragIds(event).length)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!editDraft) {
      event.dataTransfer.dropEffect = 'none';
      return;
    }
    event.dataTransfer.dropEffect = 'move';
    target.classList.add('collection-order-target');
  }, true);

  conGrid.addEventListener('dragleave', event => {
    event.target.closest('.collection-order-target')?.classList.remove('collection-order-target');
  }, true);

  conGrid.addEventListener('drop', event => {
    const view = activeView();
    if (view?.type !== 'collections') return;
    const target = event.target.closest('.con-card, .reorder-tail');
    if (!target) return;
    const ids = dragIds(event);
    if (!ids.length) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    target.classList.remove('collection-order-target');
    if (!editDraft) return;
    moveDraftCards(ids, target);
  }, true);

  document.addEventListener('click', event => {
    const modeButton = event.target.closest('.sidebar [data-library-tab]');
    if (!modeButton) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    sidebarMode = modeButton.dataset.libraryTab === 'collections' ? 'collections' : 'packages';
    localStorage.setItem(SIDEBAR_KEY, sidebarMode);
    applySidebarMode();
  }, true);

  document.addEventListener('click', event => {
    const nav = event.target.closest('.nav-item[data-view-id], .collection-main[data-view-id]');
    if (!nav) return;
    const type = nav.dataset.viewType;
    const id = nav.dataset.viewId;
    const name = nav.dataset.viewName || nav.textContent.trim();
    if (type && id) openView(type, id, name, true);
    applySidebarMode();
    updateEditControls();
  });

  document.addEventListener(COLLECTION_CREATED_EVENT, event => {
    const { id, name } = event.detail || {};
    if (id) openView('collections', id, name, true);
  });

  function updateLibraryDeleteContext(target) {
    libraryDeleteArmed = target instanceof Node && libraryPanel.contains(target);
  }

  document.addEventListener('pointerdown', event => updateLibraryDeleteContext(event.target), true);
  document.addEventListener('focusin', event => updateLibraryDeleteContext(event.target), true);

  window.addEventListener('keydown', event => {
    if (event.key !== 'Delete') return;
    if (document.activeElement?.matches('textarea, input, [contenteditable="true"]')) return;
    if (!editDraft || !libraryDeleteArmed) return;
    if (document.querySelector('.story-con.selected')) return;
    if (activeView()?.type !== 'collections') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    deleteDraftSelection();
  }, true);

  let refreshQueued = false;
  function queueRefreshData() {
    if (refreshQueued) return;
    refreshQueued = true;
    queueMicrotask(() => {
      refreshQueued = false;
      refreshData().catch(() => {});
    });
  }
  collectionList.addEventListener(NAVIGATION_RENDER_EVENT, queueRefreshData);

  refreshData().catch(() => {});
}
