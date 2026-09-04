import { getAll, putOne } from './db.js';

const packageList = document.getElementById('packageList');
const collectionList = document.getElementById('collectionList');
const packagePanel = document.getElementById('packagePanel');
const collectionPanel = document.getElementById('collectionPanel');
const libraryPanel = document.querySelector('.library-panel');
const libraryToolbar = document.querySelector('.library-toolbar');
const toolbarActions = libraryToolbar?.querySelector('.toolbar-actions');
const conGrid = document.getElementById('conGrid');
const searchInput = document.getElementById('searchInput');

if (packageList && collectionList && packagePanel && collectionPanel && libraryPanel && toolbarActions && conGrid) {
  const SIDEBAR_KEY = 'hhjcon-sidebar-mode';
  const VIEWS_KEY = 'hhjcon-open-library-views';
  const ACTIVE_VIEW_KEY = 'hhjcon-active-library-view';

  let sidebarMode = localStorage.getItem(SIDEBAR_KEY) === 'collections' ? 'collections' : 'packages';
  let packages = [];
  let collections = [];
  let editing = false;
  let editCollectionId = null;
  let pendingOpenCreatedCollection = false;

  function readViews() {
    try {
      const value = JSON.parse(localStorage.getItem(VIEWS_KEY) || '[]');
      return Array.isArray(value) ? value.filter(item => item && (item.type === 'packages' || item.type === 'collections') && item.id) : [];
    } catch {
      return [];
    }
  }

  let openViews = readViews();
  let activeViewKey = localStorage.getItem(ACTIVE_VIEW_KEY) || '';

  const viewTabs = document.createElement('div');
  viewTabs.className = 'library-view-tabs';
  libraryPanel.insertBefore(viewTabs, libraryToolbar);

  const editControls = document.createElement('div');
  editControls.className = 'collection-edit-controls';
  const editButton = document.createElement('button');
  editButton.className = 'small';
  editButton.textContent = '순서 편집';
  const saveButton = document.createElement('button');
  saveButton.className = 'small primary';
  saveButton.textContent = '저장';
  const cancelButton = document.createElement('button');
  cancelButton.className = 'small';
  cancelButton.textContent = '취소';
  editControls.append(editButton, saveButton, cancelButton);
  toolbarActions.prepend(editControls);

  function keyOf(type, id) {
    return `${type}:${id}`;
  }

  function activeView() {
    return openViews.find(view => keyOf(view.type, view.id) === activeViewKey) || null;
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
  }

  function updateEditControls() {
    const view = activeView();
    const isCollection = view?.type === 'collections';
    editControls.classList.toggle('hidden', !isCollection);
    editButton.classList.toggle('hidden', !isCollection || editing);
    saveButton.classList.toggle('hidden', !isCollection || !editing);
    cancelButton.classList.toggle('hidden', !isCollection || !editing);
    conGrid.classList.toggle('collection-order-editing', editing);
  }

  function forwardDrop(target, dataTransfer) {
    if (!target || !dataTransfer) return;
    const forwarded = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(forwarded, 'dataTransfer', { value: dataTransfer });
    target.dispatchEvent(forwarded);
  }

  function renderViewTabs() {
    viewTabs.replaceChildren();
    openViews.forEach(view => {
      const key = keyOf(view.type, view.id);
      const tab = document.createElement('div');
      tab.className = 'library-view-tab';
      tab.classList.toggle('active', key === activeViewKey);
      tab.classList.toggle('collection-tab', view.type === 'collections');

      const main = document.createElement('button');
      main.className = 'library-view-tab-main';
      main.textContent = view.name;
      main.title = view.type === 'collections' ? `내 콘묶음: ${view.name}` : `DC콘: ${view.name}`;
      main.addEventListener('click', () => activateView(view));

      if (view.type === 'collections') {
        tab.addEventListener('dragover', event => {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
          tab.classList.add('drop-target');
        });
        tab.addEventListener('dragleave', () => tab.classList.remove('drop-target'));
        tab.addEventListener('drop', event => {
          event.preventDefault();
          event.stopPropagation();
          tab.classList.remove('drop-target');
          const row = collectionList.querySelector(`.collection-row[data-view-id="${CSS.escape(String(view.id))}"]`);
          forwardDrop(row, event.dataTransfer);
        });
      }

      const close = document.createElement('button');
      close.className = 'library-view-tab-close';
      close.textContent = '×';
      close.title = '탭 닫기';
      close.addEventListener('click', event => {
        event.stopPropagation();
        const index = openViews.findIndex(item => keyOf(item.type, item.id) === key);
        if (index < 0) return;
        const wasActive = activeViewKey === key;
        openViews.splice(index, 1);
        if (wasActive) {
          const next = openViews[Math.min(index, openViews.length - 1)] || null;
          activeViewKey = next ? keyOf(next.type, next.id) : '';
          persistViews();
          renderViewTabs();
          if (next) activateView(next);
          else updateEditControls();
          return;
        }
        persistViews();
        renderViewTabs();
      });

      tab.append(main, close);
      viewTabs.append(tab);
    });
    updateEditControls();
  }

  function openView(type, id, name, activate = true) {
    const key = keyOf(type, id);
    let view = openViews.find(item => keyOf(item.type, item.id) === key);
    if (!view) {
      view = { type, id: String(id), name: String(name || '콘') };
      openViews.push(view);
    } else if (name) {
      view.name = String(name);
    }
    if (activate) activeViewKey = key;
    persistViews();
    renderViewTabs();
    return view;
  }

  function findNavElement(view) {
    if (view.type === 'packages') {
      return packageList.querySelector(`.nav-item[data-view-id="${CSS.escape(String(view.id))}"]`);
    }
    return collectionList.querySelector(`.collection-main[data-view-id="${CSS.escape(String(view.id))}"]`);
  }

  function activateView(view) {
    if (!view) return;
    if (editing && editCollectionId !== view.id) {
      editing = false;
      editCollectionId = null;
      conGrid.classList.remove('collection-order-editing');
    }
    activeViewKey = keyOf(view.type, view.id);
    persistViews();
    renderViewTabs();
    const target = findNavElement(view);
    if (target) target.click();
    setTimeout(() => {
      applySidebarMode();
      annotateNavigation();
      updateEditControls();
    }, 0);
  }

  async function refreshData() {
    [packages, collections] = await Promise.all([getAll('packages'), getAll('collections')]);
    packages.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    collections.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
    annotateNavigation();

    openViews = openViews.filter(view => {
      const source = view.type === 'packages' ? packages : collections;
      return source.some(item => String(item.id) === String(view.id));
    });

    if (!openViews.length && packages[0]) {
      openViews.push({ type: 'packages', id: String(packages[0].id), name: String(packages[0].name) });
    }
    if (!activeViewKey || !openViews.some(view => keyOf(view.type, view.id) === activeViewKey)) {
      activeViewKey = openViews[0] ? keyOf(openViews[0].type, openViews[0].id) : '';
    }
    persistViews();
    renderViewTabs();

    if (pendingOpenCreatedCollection) {
      const activeRow = collectionList.querySelector('.collection-row.active[data-view-id]');
      if (activeRow) {
        const id = activeRow.dataset.viewId;
        const item = collections.find(collection => String(collection.id) === id);
        if (item) openView('collections', item.id, item.name, true);
        pendingOpenCreatedCollection = false;
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
    try {
      const raw = event.dataTransfer?.getData('application/x-hhjcon-ids');
      const ids = raw ? JSON.parse(raw) : [];
      return Array.isArray(ids) ? ids.map(String) : [];
    } catch {
      return [];
    }
  }

  function moveCards(ids, target) {
    const movingSet = new Set(ids);
    const cards = [...conGrid.querySelectorAll('.con-card')];
    const moving = cards.filter(card => movingSet.has(String(card.dataset.conId)));
    if (!moving.length) return;
    const targetCard = target?.closest?.('.con-card') || null;
    if (targetCard && movingSet.has(String(targetCard.dataset.conId))) return;
    moving.forEach(card => card.remove());
    const tail = conGrid.querySelector('.reorder-tail');
    if (targetCard?.isConnected) moving.forEach(card => conGrid.insertBefore(card, targetCard));
    else if (tail) moving.forEach(card => conGrid.insertBefore(card, tail));
    else moving.forEach(card => conGrid.append(card));
  }

  editButton.addEventListener('click', () => {
    const view = activeView();
    if (!view || view.type !== 'collections') return;
    if (searchInput?.value) {
      searchInput.value = '';
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    editing = true;
    editCollectionId = String(view.id);
    updateEditControls();
  });

  saveButton.addEventListener('click', async () => {
    if (!editing || !editCollectionId) return;
    const order = [...conGrid.querySelectorAll('.con-card[data-con-id]')].map(card => String(card.dataset.conId));
    const all = await getAll('collections');
    const collection = all.find(item => String(item.id) === editCollectionId);
    if (!collection) return;
    collection.items = order;
    collection.updatedAt = Date.now();
    await putOne('collections', collection);
    editing = false;
    editCollectionId = null;
    updateEditControls();
    location.reload();
  });

  cancelButton.addEventListener('click', () => {
    const view = activeView();
    editing = false;
    editCollectionId = null;
    updateEditControls();
    if (view) activateView(view);
  });

  conGrid.addEventListener('dragover', event => {
    const view = activeView();
    if (view?.type !== 'collections') return;
    const target = event.target.closest('.con-card, .reorder-tail');
    if (!target) return;
    const ids = dragIds(event);
    if (!ids.length) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!editing) {
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
    if (!editing) return;
    moveCards(ids, target);
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
    if (event.target.closest('#newCollectionBtn')) pendingOpenCreatedCollection = true;
    const nav = event.target.closest('.nav-item[data-view-id], .collection-main[data-view-id]');
    if (!nav) return;
    const type = nav.dataset.viewType;
    const id = nav.dataset.viewId;
    const name = nav.dataset.viewName || nav.textContent.trim();
    if (type && id) openView(type, id, name, true);
    setTimeout(() => {
      applySidebarMode();
      updateEditControls();
    }, 0);
  });

  let refreshQueued = false;
  const observer = new MutationObserver(() => {
    if (refreshQueued) return;
    refreshQueued = true;
    queueMicrotask(() => {
      refreshQueued = false;
      refreshData().catch(() => {});
    });
  });
  observer.observe(packageList, { childList: true });
  observer.observe(collectionList, { childList: true });

  refreshData().then(() => {
    const view = activeView();
    if (view) setTimeout(() => activateView(view), 0);
  }).catch(() => {});
}
