import {
  addIdsToCollection,
  commitCollectionDraft,
  commitCollectionPlacements,
  deleteCollectionsByIds
} from '../app.js?v=20261004-1';
import { getAll, getOne, putOne } from '../db.js';
import { CON_IDS_MIME, readTransferIds, transferHasType } from '../story-dnd-utils.js?v=20260906-2';
import {
  COLLECTION_FOLDER_DOCUMENT_ID,
  COLLECTION_FOLDER_NAME_MAX_LENGTH,
  collectionFolderTree,
  collectionFoldersIn,
  makeCollectionFolderDocument,
  normalizeCollectionFolderId,
  normalizeCollectionFolders,
  planCollectionFolderPlacement,
  planCollectionFolderRemoval,
  planCollectionPlacement,
  sortCollectionsInFolder,
  validateCollectionFolderName
} from '../collections/collection-folders.js?v=20261004-1';
import { nextAvailableStoryName } from '../story/story-save-folders.js?v=20261003-2';
import { COLLECTION_WARNING, chooseNameConflict, createDialog, showConfirm, showPrompt } from '../ui/action-dialogs.js?v=20261004-1';
import { showToast } from '../ui/toast.js?v=20261003-1';
import {
  createCollectionEditDraft,
  deleteCollectionEditSelection,
  prepareCollectionEditDrag,
  reorderCollectionEditDraft,
  selectCollectionEditDraft
} from './library-edit-draft.js?v=20260914-1';
import { createCollectionEditControls } from './library-edit-controls.js?v=20261002-2';
import { renderLibraryViewTabs } from './library-tab-render.js?v=20260913-1';
import { closeLibraryView, libraryViewKey, openLibraryView, reconcileLibraryViews } from './library-tabs.js?v=20260911-2';
import { beginLibraryDrag, endLibraryDrag, libraryDragKind } from './library-drag-session.js?v=20261002-1';

const packageList = document.getElementById('packageList');
const collectionList = document.getElementById('collectionList');
const packagePanel = document.getElementById('packagePanel');
const collectionPanel = document.getElementById('collectionPanel');
const libraryPanel = document.querySelector('.library-panel');
const libraryToolbar = document.querySelector('.library-toolbar');
const toolbarActions = libraryToolbar?.querySelector('.toolbar-actions');
const conGrid = document.getElementById('conGrid');
const libraryEmpty = document.getElementById('libraryEmpty');
const searchInput = document.getElementById('searchInput');
const selectionStatus = document.getElementById('selectionStatus');
const selectAllButton = document.getElementById('selectAllBtn');
const clearSelectionButton = document.getElementById('clearSelectionBtn');
const newCollectionFolderBtn = document.getElementById('newCollectionFolderBtn');

if (packageList && collectionList && packagePanel && collectionPanel && libraryPanel && toolbarActions && conGrid && selectAllButton && clearSelectionButton && newCollectionFolderBtn) {
  const emptyTitle = libraryEmpty?.querySelector('strong');
  const emptyDescription = libraryEmpty?.querySelector('span');
  const defaultEmptyTitle = emptyTitle?.textContent;
  const defaultEmptyDescription = emptyDescription?.textContent;
  conGrid.addEventListener('hhjcon:library-grid-rendered', () => {
    if (!emptyTitle || !emptyDescription || libraryEmpty.classList.contains('hidden')) return;
    const message = searchInput?.value.trim()
      ? ['검색 결과가 없습니다.', '다른 이름으로 검색하거나 검색어를 지워보세요.']
      : conGrid.querySelector('.reorder-tail')
        ? ['이 콘묶음은 비어 있습니다.', '디시콘을 이 콘묶음으로 끌어다 놓으면 추가할 수 있습니다.']
        : [defaultEmptyTitle, defaultEmptyDescription];
    emptyTitle.textContent = message[0];
    emptyDescription.textContent = message[1];
  });
  const SIDEBAR_KEY = 'hhjcon-sidebar-mode';
  const VIEWS_KEY = 'hhjcon-open-library-views';
  const ACTIVE_VIEW_KEY = 'hhjcon-active-library-view';
  const CLOSE_ALL_EVENT = 'hhjcon:library-close-all';
  const COLLECTION_CREATED_EVENT = 'hhjcon:collection-created';
  const NAVIGATION_RENDER_EVENT = 'hhjcon:library-navigation-rendered';
  const COLLECTION_FOLDER_VIEW_KEY = 'hhjcon-collection-folder-view';
  const COLLECTION_DRAG_MIME = 'application/x-hhj-collection';
  const COLLECTION_FOLDER_DRAG_MIME = 'application/x-hhj-collection-folder';
  let sidebarMode = localStorage.getItem(SIDEBAR_KEY) === 'collections' ? 'collections' : 'packages';
  let packages = [];
  let collections = [];
  let folders = [];
  let currentFolderId = localStorage.getItem(COLLECTION_FOLDER_VIEW_KEY) || '';
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

  function persistCollectionFolderView() {
    if (currentFolderId) localStorage.setItem(COLLECTION_FOLDER_VIEW_KEY, currentFolderId);
    else localStorage.removeItem(COLLECTION_FOLDER_VIEW_KEY);
    collectionPanel.dataset.folderId = currentFolderId;
  }

  function clearCollectionDropGuides() {
    collectionList.querySelectorAll('.collection-drop-before, .collection-drop-after, .collection-drop-folder, .collection-drop-blocked')
      .forEach(node => node.classList.remove('collection-drop-before', 'collection-drop-after', 'collection-drop-folder', 'collection-drop-blocked'));
  }

  function chooseCollectionFolderDeletion(name, count, childCount = 0) {
    const { dialog, body, footer } = createDialog('콘묶음 폴더 삭제', 'warning');
    const message = document.createElement('p');
    message.className = 'hhj-ui-dialog-message';
    message.textContent = `“${name}” 폴더를 삭제합니다.\n폴더 안에 하위 폴더 ${childCount}개와 콘묶음 ${count}개가 있습니다. 어떻게 처리할까요?`;
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
      dialog.addEventListener('close', () => resolve(['keep', 'remove'].includes(dialog.returnValue) ? dialog.returnValue : null), { once: true });
      dialog.showModal();
      queueMicrotask(() => cancel.focus());
    });
  }

  function collectionRow(collectionId) {
    return collectionList.querySelector(`.collection-row[data-collection-id="${CSS.escape(String(collectionId))}"]`);
  }

  function renderCollectionFolderNavigation() {
    collectionList.querySelectorAll('.collection-folder-row, .collection-folder-location, .collection-folder-empty').forEach(node => node.remove());
    collectionList.querySelector('.nav-empty')?.remove();
    currentFolderId = normalizeCollectionFolderId(currentFolderId, folders);
    persistCollectionFolderView();

    const rows = [...collectionList.querySelectorAll('.collection-row')];
    rows.forEach(row => {
      row.hidden = true;
      row.classList.remove('collection-drop-before', 'collection-drop-after', 'collection-drop-folder', 'collection-drop-blocked');
    });

    const currentFolder = folders.find(folder => folder.id === currentFolderId);
    if (currentFolder) {
      const parent = folders.find(folder => folder.id === currentFolder.parentId);
      const location = document.createElement('div'); location.className = 'collection-folder-location';
      const up = document.createElement('button'); up.type = 'button'; up.className = 'collection-folder-up';
      up.textContent = `← ${parent?.name || '최상위'}`;
      up.dataset.tooltipTitle = '상위 폴더로 이동';
      up.dataset.tooltipDescription = '상위 콘묶음 목록으로 돌아갑니다. 콘묶음을 끌어다 놓으면 상위 폴더로 이동합니다.';
      const label = document.createElement('span');
      label.append('현재 위치: ');
      if (parent) {
        const parentName = document.createElement('span'); parentName.className = 'folder-path-parent'; parentName.textContent = parent.name;
        label.append(parentName, ' / ');
      }
      const currentName = document.createElement('span'); currentName.className = 'folder-path-current'; currentName.textContent = currentFolder.name;
      label.append(currentName);
      label.dataset.tooltipTitle = '현재 위치';
      label.dataset.tooltipDescription = [parent?.name, currentFolder.name].filter(Boolean).join(' / ');
      location.append(up, label); collectionList.append(location);
      up.addEventListener('click', () => {
        currentFolderId = parent?.id || '';
        persistCollectionFolderView();
        renderCollectionFolderNavigation();
      });
    }
    newCollectionFolderBtn.hidden = Boolean(currentFolder?.parentId);
    if (!currentFolder?.parentId) {
      collectionFoldersIn(folders, currentFolderId).forEach(folder => {
        const row = document.createElement('div');
        row.className = 'collection-folder-row';
        row.draggable = true;
        row.dataset.folderId = folder.id;
        const main = document.createElement('button');
        main.type = 'button';
        main.className = 'collection-folder-main';
        main.dataset.tooltipTitle = '콘묶음 폴더 열기';
        main.dataset.tooltipDescription = '폴더 안의 콘묶음과 하위 폴더를 표시합니다. 콘묶음이나 폴더를 끌어다 놓으면 이 폴더로 이동합니다. 폴더는 두 단계까지만 만들 수 있습니다.';
        const name = document.createElement('strong'); name.textContent = `📁 ${folder.name}`;
        const children = collectionFoldersIn(folders, folder.id);
        const childIds = new Set(children.map(child => child.id));
        const count = document.createElement('small');
        const directCount = collections.filter(collection => normalizeCollectionFolderId(collection.folderId, folders) === folder.id).length;
        const nestedCount = collections.filter(collection => childIds.has(normalizeCollectionFolderId(collection.folderId, folders))).length;
        count.textContent = String(directCount + children.length + nestedCount);
        main.dataset.tooltipDescription += `\n폴더 안에 ${directCount}개의 콘묶음, ${children.length}개의 하위 폴더, ${nestedCount}개의 하위 폴더 속 콘묶음이 있습니다.`;
        main.append(name, count);
        const actions = document.createElement('div'); actions.className = 'collection-folder-actions'; actions.dataset.noCollectionDrag = 'true';
        const rename = document.createElement('button'); rename.type = 'button'; rename.className = 'icon-button collection-folder-rename-button';
        rename.setAttribute('aria-label', '폴더 이름 변경');
        rename.dataset.tooltipTitle = '폴더 이름 변경'; rename.dataset.tooltipDescription = '이 콘묶음 폴더의 이름을 바꿉니다.';
        const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'icon-button collection-folder-delete-button'; remove.textContent = '×';
        remove.dataset.tooltipTitle = '콘묶음 폴더 삭제'; remove.dataset.tooltipDescription = '폴더를 삭제하거나 안의 콘묶음까지 함께 삭제합니다.';
        actions.append(rename, remove);
        row.append(main, actions);
        collectionList.append(row);

        main.addEventListener('click', () => {
          currentFolderId = folder.id;
          persistCollectionFolderView();
          renderCollectionFolderNavigation();
        });
        rename.addEventListener('click', async () => {
          const input = await showPrompt('새 콘묶음 폴더 이름을 입력하세요.', folder.name, {
            title: '콘묶음 폴더 이름 변경', label: `폴더 이름 (최대 ${COLLECTION_FOLDER_NAME_MAX_LENGTH}자)`,
            confirmText: '변경', maxLength: COLLECTION_FOLDER_NAME_MAX_LENGTH
          });
          if (input == null) return;
          try {
            const latest = normalizeCollectionFolders(await getOne('documents', COLLECTION_FOLDER_DOCUMENT_ID));
            if (!latest.some(item => item.id === folder.id)) throw new Error('콘묶음 폴더가 이미 삭제되었습니다.');
            const nextName = validateCollectionFolderName(input, latest, folder.id, folder.parentId || '');
            folders = latest.map(item => item.id === folder.id ? { ...item, name: nextName } : item);
            await putOne('documents', makeCollectionFolderDocument(folders));
            renderCollectionFolderNavigation();
          } catch (error) { alert(`이름을 바꿀 수 없습니다.\n${error.message || error}`); }
        });
        remove.addEventListener('click', () => removeCollectionFolder(folder.id).catch(error => alert(error.message || error)));
      });
    }

    const visible = sortCollectionsInFolder(collections, folders, currentFolderId);
    visible.forEach(collection => {
      const row = collectionRow(collection.id);
      if (!row) return;
      row.hidden = false;
      collectionList.append(row);
    });
    if (!collectionFoldersIn(folders, currentFolderId).length && !visible.length) {
      const empty = document.createElement('div'); empty.className = 'collection-folder-empty';
      empty.textContent = currentFolderId ? '이 폴더에 콘묶음이 없습니다.' : '새 콘묶음이나 폴더를 만들어 보세요.';
      collectionList.append(empty);
    }
  }

  async function removeCollectionFolder(folderId) {
    const latestFolders = normalizeCollectionFolders(await getOne('documents', COLLECTION_FOLDER_DOCUMENT_ID));
    const folder = latestFolders.find(item => item.id === folderId);
    if (!folder) throw new Error('콘묶음 폴더가 이미 삭제되었습니다.');
    const latestCollections = await getAll('collections');
    const affectedFolders = collectionFolderTree(latestFolders, folderId);
    const affectedIds = new Set(affectedFolders.map(item => item.id));
    const contained = latestCollections.filter(item => affectedIds.has(item.folderId));
    const choice = contained.length || affectedFolders.length > 1
      ? await chooseCollectionFolderDeletion(folder.name, contained.length, affectedFolders.length - 1)
      : await showConfirm(`“${folder.name}” 빈 콘묶음 폴더를 삭제할까요?`, {
        title: '콘묶음 폴더 삭제', confirmText: '삭제', danger: true
      }) ? 'keep' : null;
    if (!choice) return;
    if (choice === 'remove') {
      const confirmed = await showConfirm(`“${folder.name}” 폴더와 하위 폴더 ${affectedFolders.length - 1}개, 콘묶음 ${contained.length}개를 함께 삭제합니다.\n삭제된 콘묶음은 복구할 수 없습니다.\n정말 삭제하시겠습니까?`, {
        title: '폴더와 콘묶음 삭제', confirmText: '모두 삭제', danger: true
      });
      if (!confirmed) return;
    } else if (contained.length || affectedFolders.length > 1) {
      const confirmed = await showConfirm(`“${folder.name}” 폴더를 삭제합니다.\n삭제된 항목은 복구할 수 없습니다.\n폴더안의 하위 폴더 ${affectedFolders.length - 1}개와 콘묶음 ${contained.length}개는 상위 폴더로 옮겨 보존합니다.\n정말 삭제하시겠습니까?`, {
        title: '콘묶음 폴더 삭제', confirmText: '삭제', danger: true
      });
      if (!confirmed) return;
    }
    const checkFolders = normalizeCollectionFolders(await getOne('documents', COLLECTION_FOLDER_DOCUMENT_ID));
    const checkCollections = await getAll('collections');
    const checkAffected = collectionFolderTree(checkFolders, folderId);
    const checkIds = new Set(checkAffected.map(item => item.id));
    const checkContained = checkCollections.filter(item => checkIds.has(item.folderId));
    const expected = new Map(contained.map(item => [item.id, item.updatedAt]));
    if (!checkFolders.some(item => item.id === folderId && item.name === folder.name && item.parentId === folder.parentId)
      || checkAffected.length !== affectedFolders.length
      || checkAffected.some(item => !affectedFolders.some(old => old.id === item.id && old.name === item.name && old.parentId === item.parentId))
      || checkContained.length !== expected.size
      || checkContained.some(item => !expected.has(item.id) || expected.get(item.id) !== item.updatedAt)) {
      throw new Error('콘묶음 폴더 내용이 변경되었습니다. 다시 확인한 뒤 삭제해주세요.');
    }
    const plan = planCollectionFolderRemoval(checkFolders, checkCollections, folderId, choice === 'remove');
    if (choice === 'remove') await deleteCollectionsByIds(plan.deleteIds);
    else await commitCollectionPlacements(plan.updates);
    await putOne('documents', plan.document);
    folders = plan.document.items;
    const updated = new Map(plan.updates.map(item => [item.id, item]));
    collections = choice === 'remove'
      ? checkCollections.filter(item => !plan.deleteIds.includes(item.id))
      : checkCollections.map(item => updated.get(item.id) || item);
    showToast(choice === 'remove' ? `“${folder.name}” 폴더와 콘묶음 ${plan.deleteIds.length}개를 삭제했습니다.`
      : `“${folder.name}” 폴더를 삭제하고 내용을 상위 폴더로 옮겼습니다.`);
    renderCollectionFolderNavigation();
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
    const [nextPackages, nextCollections, folderDocument] = await Promise.all([
      getAll('packages'), getAll('collections'), getOne('documents', COLLECTION_FOLDER_DOCUMENT_ID)
    ]);
    packages = nextPackages;
    collections = nextCollections;
    folders = normalizeCollectionFolders(folderDocument);
    packages.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    collections.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    annotateNavigation();

    const nextViews = reconcileLibraryViews(
      openViews, activeViewKey, packages, collections, restorePending && shouldOpenDefaultView
    );
    const names = new Map([
      ...packages.map(item => [libraryViewKey('packages', item.id), String(item.name)]),
      ...collections.map(item => [libraryViewKey('collections', item.id), String(item.name)])
    ]);
    openViews = nextViews.views.map(view => {
      const name = names.get(libraryViewKey(view.type, view.id));
      return name && name !== view.name ? { ...view, name } : view;
    });
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
    [...collectionList.querySelectorAll('.collection-row')].forEach(row => {
      const item = collections.find(collection => String(collection.id) === String(row.dataset.collectionId));
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
    renderCollectionFolderNavigation();
    applySidebarMode();
  }

  function dragIds(event) {
    return readTransferIds(event.dataTransfer, CON_IDS_MIME);
  }

  function hasConDrag(event) {
    return transferHasType(event.dataTransfer, CON_IDS_MIME);
  }

  async function moveCollectionTo(collectionId, folderId, beforeId = '') {
    const [latestCollections, folderDocument] = await Promise.all([
      getAll('collections'), getOne('documents', COLLECTION_FOLDER_DOCUMENT_ID)
    ]);
    const latestFolders = normalizeCollectionFolders(folderDocument);
    const updates = planCollectionPlacement(latestCollections, latestFolders, collectionId, folderId, beforeId);
    if (!updates.length) return;
    await commitCollectionPlacements(updates);
    const updated = new Map(updates.map(item => [item.id, item]));
    collections = latestCollections.map(item => updated.get(item.id) || item);
    folders = latestFolders;
    renderCollectionFolderNavigation();
  }

  async function moveCollectionFolder(folderId, beforeId = '', targetParentId = undefined) {
    const latest = normalizeCollectionFolders(await getOne('documents', COLLECTION_FOLDER_DOCUMENT_ID));
    const next = planCollectionFolderPlacement(latest, folderId, beforeId, targetParentId);
    if (!next.length) return;
    await putOne('documents', makeCollectionFolderDocument(next));
    folders = next;
    renderCollectionFolderNavigation();
  }

  newCollectionFolderBtn.addEventListener('click', async () => {
    try {
      const input = await showPrompt('새 콘묶음 폴더 이름을 입력하세요.', '', {
        title: '새 콘묶음 폴더', label: `폴더 이름 (최대 ${COLLECTION_FOLDER_NAME_MAX_LENGTH}자)`,
        confirmText: '만들기', maxLength: COLLECTION_FOLDER_NAME_MAX_LENGTH, note: COLLECTION_WARNING
      });
      if (input == null) return;
      let name = String(input).trim();
      let latest = normalizeCollectionFolders(await getOne('documents', COLLECTION_FOLDER_DOCUMENT_ID));
      const parentId = currentFolderId;
      if (latest.find(folder => folder.id === parentId)?.parentId) throw new Error('폴더는 두 단계까지만 만들 수 있습니다.');
      const siblings = collectionFoldersIn(latest, parentId);
      const matches = siblings.filter(folder => folder.name.toLocaleLowerCase('ko-KR') === name.toLocaleLowerCase('ko-KR'));
      if (matches.length) {
        const separateName = nextAvailableStoryName(name, siblings.map(folder => folder.name), COLLECTION_FOLDER_NAME_MAX_LENGTH, true);
        const parent = latest.find(folder => folder.id === parentId);
        const location = parent ? `“${parent.name}” 폴더` : '최상위';
        const choice = await chooseNameConflict('콘묶음 폴더 이름 중복',
          `“${name}” 폴더가 이미 ${location}에 있습니다.\n폴더를 새로 만들지 않고 기존 폴더를 열거나 “${separateName}”로 폴더를 새로 만들 수 있습니다.`,
          matches.map(folder => ({ id: folder.id, label: folder.name })), '기존 폴더 열기', '새로 만들기');
        if (!choice) return;
        if (choice.action === 'existing') {
          currentFolderId = choice.id;
          folders = latest;
          persistCollectionFolderView();
          renderCollectionFolderNavigation();
          showToast(`기존 “${name}” 폴더를 열었습니다.`);
          return;
        }
        name = separateName;
      }
      latest = normalizeCollectionFolders(await getOne('documents', COLLECTION_FOLDER_DOCUMENT_ID));
      if (parentId && !latest.some(folder => folder.id === parentId && !folder.parentId)) throw new Error('상위 폴더가 변경되었습니다.');
      const folderName = validateCollectionFolderName(name, latest, '', parentId);
      folders = [{ id: `collection-folder_${crypto.randomUUID()}`, name: folderName,
        createdAt: Date.now(), ...(parentId ? { parentId } : {}) }, ...latest];
      await putOne('documents', makeCollectionFolderDocument(folders));
      renderCollectionFolderNavigation();
      showToast(`“${folderName}” 콘묶음 폴더를 만들었습니다.`);
    } catch (error) { alert(error.message || error); }
  });

  let dragStartedFromControl = false;
  let draggingFolderId = '';
  collectionList.addEventListener('pointerdown', event => {
    dragStartedFromControl = Boolean(event.target.closest('[data-no-collection-drag]'));
  }, true);
  window.addEventListener('pointerup', () => { dragStartedFromControl = false; }, true);

  collectionList.addEventListener('dragstart', event => {
    if (!event.dataTransfer) return;
    const collection = event.target.closest('.collection-row[data-collection-id]');
    const folder = event.target.closest('.collection-folder-row[data-folder-id]');
    if (dragStartedFromControl || (!collection && !folder)) {
      event.preventDefault();
      return;
    }
    clearCollectionDropGuides();
    draggingFolderId = '';
    if (collection) {
      beginLibraryDrag('collection');
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData(COLLECTION_DRAG_MIME, collection.dataset.collectionId);
      collection.classList.add('dragging');
      return;
    }
    beginLibraryDrag('folder');
    draggingFolderId = folder.dataset.folderId;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(COLLECTION_FOLDER_DRAG_MIME, folder.dataset.folderId);
    folder.classList.add('dragging');
  });

  const guideCollectionDrop = event => {
    const kind = libraryDragKind();
    const folder = event.target.closest('.collection-folder-row[data-folder-id]');
    if (kind === 'con' && folder) {
      clearCollectionDropGuides();
      event.dataTransfer.dropEffect = 'none';
      folder.classList.add('collection-drop-blocked');
      return;
    }
    const collection = event.target.closest('.collection-row[data-collection-id]:not([hidden])');
    const up = event.target.closest('.collection-folder-up');
    if (kind === 'collection' && (folder || collection || up)) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      clearCollectionDropGuides();
      if (folder) folder.classList.add('collection-drop-folder');
      else if (up) up.classList.add('collection-drop-folder');
      else {
        const before = event.clientY < collection.getBoundingClientRect().top + collection.getBoundingClientRect().height / 2;
        collection.classList.add(before ? 'collection-drop-before' : 'collection-drop-after');
      }
      return;
    }
    if (kind === 'folder' && (folder || up)) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      clearCollectionDropGuides();
      if (up) up.classList.add('collection-drop-folder');
      else {
        const bounds = folder.getBoundingClientRect();
        const fraction = (event.clientY - bounds.top) / bounds.height;
        const nesting = !currentFolderId && fraction >= .25 && fraction <= .75 && draggingFolderId !== folder.dataset.folderId;
        folder.classList.add(nesting
          ? collectionFoldersIn(folders, draggingFolderId).length ? 'collection-drop-blocked' : 'collection-drop-folder'
          : fraction < .5 ? 'collection-drop-before' : 'collection-drop-after');
      }
    }
  };
  collectionList.addEventListener('dragenter', guideCollectionDrop);
  collectionList.addEventListener('dragover', guideCollectionDrop);
  collectionList.addEventListener('dragleave', event => {
    event.target.closest('.collection-drop-blocked')?.classList.remove('collection-drop-blocked');
  });
  collectionList.addEventListener('drop', event => {
    const kind = libraryDragKind();
    if (kind === 'collection') {
      const collectionId = event.dataTransfer.getData(COLLECTION_DRAG_MIME);
      const folder = event.target.closest('.collection-folder-row[data-folder-id]');
      const collection = event.target.closest('.collection-row[data-collection-id]:not([hidden])');
      const up = event.target.closest('.collection-folder-up');
      if (!collectionId || (!folder && !collection && !up)) return;
      event.preventDefault();
      event.stopPropagation();
      let targetFolderId = currentFolderId;
      let beforeId = '';
      if (folder) targetFolderId = folder.dataset.folderId;
      else if (up) targetFolderId = folders.find(folder => folder.id === currentFolderId)?.parentId || '';
      else {
        const visible = sortCollectionsInFolder(collections, folders, currentFolderId);
        const index = visible.findIndex(item => item.id === collection.dataset.collectionId);
        const before = event.clientY < collection.getBoundingClientRect().top + collection.getBoundingClientRect().height / 2;
        beforeId = before ? collection.dataset.collectionId : visible[index + 1]?.id || '';
      }
      moveCollectionTo(collectionId, targetFolderId, beforeId)
        .catch(error => alert(`콘묶음을 이동할 수 없습니다.\n${error.message || error}`));
    } else if (kind === 'folder') {
      const folderId = event.dataTransfer.getData(COLLECTION_FOLDER_DRAG_MIME);
      const target = event.target.closest('.collection-folder-row[data-folder-id]');
      const up = event.target.closest('.collection-folder-up');
      if (!folderId || !target && !up) return;
      event.preventDefault();
      event.stopPropagation();
      const visibleFolders = collectionFoldersIn(folders, currentFolderId);
      const index = target ? visibleFolders.findIndex(folder => folder.id === target.dataset.folderId) : -1;
      const bounds = target?.getBoundingClientRect();
      const fraction = target ? (event.clientY - bounds.top) / bounds.height : 0;
      const nest = target && !currentFolderId && fraction >= .25 && fraction <= .75 && folderId !== target.dataset.folderId;
      const parentId = up ? folders.find(folder => folder.id === currentFolderId)?.parentId || ''
        : nest ? target.dataset.folderId : currentFolderId;
      const beforeId = target && !nest ? fraction < .5 ? target.dataset.folderId : visibleFolders[index + 1]?.id || '' : '';
      moveCollectionFolder(folderId, beforeId, parentId)
        .catch(error => alert(`폴더를 이동할 수 없습니다.\n${error.message || error}`));
    }
    clearCollectionDropGuides();
  });

  document.addEventListener('dragend', event => {
    event.target.closest?.('.dragging')?.classList.remove('dragging');
    endLibraryDrag();
    dragStartedFromControl = false;
    draggingFolderId = '';
    clearCollectionDropGuides();
  }, true);

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
    clearSelectionButton.click();
    editDraft = createCollectionEditDraft(
      view.id,
      [...conGrid.querySelectorAll('.con-card[data-con-id]')].map(card => String(card.dataset.conId))
    );
    conGrid.querySelectorAll('.con-card[data-con-id]').forEach(card => { card.draggable = true; });
    renderDraftSelection();
    updateEditControls();
  });

  deleteButton.addEventListener('click', deleteDraftSelection);

  selectAllButton.addEventListener('click', event => {
    if (!editDraft) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    editDraft = createCollectionEditDraft(editDraft.collectionId, editDraft.items, editDraft.items);
    renderDraftSelection();
  }, true);

  clearSelectionButton.addEventListener('click', event => {
    if (!editDraft) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    editDraft = createCollectionEditDraft(editDraft.collectionId, editDraft.items);
    renderDraftSelection();
  }, true);

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
    beginLibraryDrag('con');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(CON_IDS_MIME, JSON.stringify(ids));
    event.dataTransfer.setData('text/plain', ids.join('\n'));
    card.classList.add('dragging');
  }, true);

  conGrid.addEventListener('dragend', event => {
    endLibraryDrag('con');
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
    if (document.querySelector('.story-item.selected')) return;
    if (activeView()?.type !== 'collections') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    deleteDraftSelection();
  }, true);

  let refreshQueued = false;
  function addPackageSyncHint() {
    const empty = packageList.querySelector('.nav-empty');
    if (!empty || empty.firstElementChild) return;
    const hint = document.createElement('div');
    hint.textContent = 'DC 브리지를 설치한 뒤 DC 동기화를 눌러주세요.';
    empty.append(hint);
  }
  function queueRefreshData() {
    addPackageSyncHint();
    if (refreshQueued) return;
    refreshQueued = true;
    queueMicrotask(() => {
      refreshQueued = false;
      refreshData().catch(() => {});
    });
  }
  packageList.addEventListener(NAVIGATION_RENDER_EVENT, addPackageSyncHint);
  collectionList.addEventListener(NAVIGATION_RENDER_EVENT, queueRefreshData);

  addPackageSyncHint();
  refreshData().catch(() => {});
}
