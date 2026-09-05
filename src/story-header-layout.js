const header = document.querySelector('.editor-header');
const sidebar = document.querySelector('.sidebar');
const libraryPanel = document.querySelector('.library-panel');
const editorPanel = document.querySelector('.editor-panel');
const packagePanel = document.getElementById('packagePanel');
const collectionPanel = document.getElementById('collectionPanel');
const packageList = document.getElementById('packageList');
const collectionList = document.getElementById('collectionList');
const storyDropZone = document.getElementById('storyDropZone');
const WARNING = '(저장한 원고는 브라우저 데이터 삭제시 지워집니다. 원고 내보내기로 백업을 해두십시오.)';
const desktopQuery = window.matchMedia('(min-width: 901px)');
let alignFrame = 0;

function arrangeHeader() {
  if (!header || header.classList.contains('story-header-split')) return;
  const groups = [...header.children];
  if (groups.length < 2) return;
  const titleGroup = groups[0];
  const actionGroup = groups[1];
  const saveButton = [...actionGroup.querySelectorAll('button')].find(button => button.textContent.trim() === '원고 저장');
  const listButton = [...actionGroup.querySelectorAll('button')].find(button => button.textContent.trim() === '원고 목록');
  if (!saveButton || !listButton) return;

  const top = document.createElement('div');
  top.className = 'story-header-top';
  const saveActions = document.createElement('div');
  saveActions.className = 'story-header-save-actions';
  const editActions = document.createElement('div');
  editActions.className = 'story-header-edit-actions';

  saveActions.append(saveButton, listButton);
  [...actionGroup.children].forEach(child => editActions.append(child));
  const copyButton = document.querySelector('.story-html-copy');
  if (copyButton) editActions.append(copyButton);
  top.append(titleGroup, saveActions);
  header.replaceChildren(top, editActions);
  header.classList.add('story-header-split');
}

function ensureCopyPlacement() {
  const copyButton = document.querySelector('.story-html-copy');
  const editActions = header?.querySelector('.story-header-edit-actions');
  if (copyButton && editActions && copyButton.parentElement !== editActions) editActions.append(copyButton);
}

function patchWarning(root = document) {
  root.querySelectorAll?.('.story-save-warning').forEach(element => {
    if (element.textContent !== WARNING) element.textContent = WARNING;
  });
}

function makeSpacer(beforeNode, name) {
  if (!beforeNode?.parentElement) return null;
  let spacer = beforeNode.parentElement.querySelector(`:scope > .workspace-top-align-spacer[data-align="${name}"]`);
  if (spacer) return spacer;
  spacer = document.createElement('div');
  spacer.className = 'workspace-top-align-spacer';
  spacer.dataset.align = name;
  beforeNode.before(spacer);
  return spacer;
}

function getMarkers() {
  const libraryContent = libraryPanel?.querySelector(':scope > #libraryEmpty') || libraryPanel?.querySelector(':scope > #conGrid');
  return {
    package: makeSpacer(packageList, 'package'),
    collection: makeSpacer(collectionList, 'collection'),
    library: makeSpacer(libraryContent, 'library'),
    editor: makeSpacer(storyDropZone, 'editor')
  };
}

function markerTop(panel, marker) {
  if (!panel || !marker) return 0;
  return marker.getBoundingClientRect().top - panel.getBoundingClientRect().top;
}

function syncTopHeights() {
  alignFrame = 0;
  const markers = getMarkers();
  if (!desktopQuery.matches) {
    Object.values(markers).forEach(marker => { if (marker) marker.style.height = '0px'; });
    return;
  }

  const sidebarMarker = collectionPanel && !collectionPanel.classList.contains('hidden') ? markers.collection : markers.package;
  const entries = [
    [sidebar, sidebarMarker],
    [libraryPanel, markers.library],
    [editorPanel, markers.editor]
  ].filter(([, marker]) => marker);
  if (!entries.length) return;

  const tops = entries.map(([panel, marker]) => markerTop(panel, marker));
  const target = Math.max(...tops);
  entries.forEach(([panel, marker], index) => {
    marker.style.height = `${Math.max(0, Math.ceil(target - tops[index]))}px`;
  });
  const inactive = sidebarMarker === markers.collection ? markers.package : markers.collection;
  if (inactive) inactive.style.height = '0px';
}

function scheduleTopSync() {
  if (alignFrame) return;
  alignFrame = requestAnimationFrame(syncTopHeights);
}

if (header) {
  const style = document.createElement('style');
  style.textContent = `
:root[data-theme="dark"]{--workspace-control-bg:#202735}
:root[data-theme="light"]{--workspace-control-bg:#e2e7ee}
.sidebar>.tabs,.sidebar .panel-title-row,.collection-transfer-row,.library-view-tabs-shell,.library-view-tabs,.library-toolbar,.editor-header,.text-format-toolbar,.workspace-top-align-spacer{background:var(--workspace-control-bg)!important}
.workspace-top-align-spacer{flex:0 0 auto;min-height:0;box-shadow:inset 0 -1px var(--line)}
.editor-header.story-header-split{display:flex;flex-direction:column;align-items:stretch;gap:0;padding:0}
.story-header-top{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px 7px}
.story-header-top>div:first-child,.story-header-save-actions,.story-header-edit-actions{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.story-header-save-actions{justify-content:flex-end}
.story-header-edit-actions{justify-content:flex-start;padding:8px 12px 9px;border-top:1px solid var(--line)}
.story-header-edit-actions .story-html-copy{margin-left:auto}
@media(max-width:900px){.workspace-top-align-spacer{height:0!important}}
@media(max-width:650px){.story-header-top{align-items:flex-start;flex-direction:column}.story-header-save-actions,.story-header-edit-actions{width:100%;justify-content:flex-start}.story-header-edit-actions .story-html-copy{margin-left:0}}
`;
  document.head.append(style);
  arrangeHeader();
  ensureCopyPlacement();
  patchWarning();

  const bodyObserver = new MutationObserver(records => {
    records.forEach(record => record.addedNodes.forEach(node => {
      if (node.nodeType === 1) patchWarning(node);
    }));
  });
  bodyObserver.observe(document.body, { childList: true });

  const panelObserver = new ResizeObserver(scheduleTopSync);
  [sidebar, libraryPanel, editorPanel].forEach(panel => { if (panel) panelObserver.observe(panel); });

  const tabObserver = new MutationObserver(() => scheduleTopSync());
  [packagePanel, collectionPanel].forEach(panel => {
    if (panel) tabObserver.observe(panel, { attributes: true, attributeFilter: ['class'] });
  });

  desktopQuery.addEventListener?.('change', scheduleTopSync);
  window.addEventListener('resize', scheduleTopSync);
  scheduleTopSync();
}
