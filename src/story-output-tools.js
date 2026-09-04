import { buildStoryHtmlSnapshot, IMAGE_PLACEHOLDER_TEXT, IMAGE_SENTINEL } from './story-html.js';

const storyList = document.getElementById('storyList');
const editorPanel = document.querySelector('.editor-panel');
const editorActions = document.querySelector('.editor-header > div:last-child');
const addTextButton = document.getElementById('addTextBtn');
const clearStoryButton = document.getElementById('clearStoryBtn');
const toolbar = document.querySelector('.text-format-toolbar');

const style = document.createElement('style');
style.id = 'story-output-tools-style';
style.textContent = `
.story-image-source{display:none!important}.story-image-placeholder{width:100%;display:inline-grid!important;grid-template-columns:24px minmax(0,1fr) auto!important;align-items:center;padding:7px 8px!important;background:rgba(255,184,77,.10)!important;border-color:#765d32!important}.story-image-placeholder>.story-drag-handle{grid-column:1;grid-row:1;min-width:24px;width:24px;align-self:stretch;cursor:grab;color:var(--muted)}.story-image-placeholder>.story-image-label{grid-column:2;grid-row:1;padding:8px 12px;border-radius:7px;background:rgba(255,184,77,.08);font-weight:700;text-align:center;color:#ffd58c}.story-image-placeholder>.story-tools{grid-column:3;grid-row:1}.story-html-toggle{margin-left:auto;white-space:nowrap}.text-format-toolbar.html-preview-active>:not(.story-html-toggle){opacity:.4;pointer-events:none}.editor-panel.html-preview-mode>.story-list,.editor-panel.html-preview-mode>.story-drop-zone{display:none!important}.story-html-preview{flex:1;min-height:180px;margin:10px;padding:12px;overflow:auto;border:1px solid var(--line);border-radius:9px;background:#0f141b;color:var(--text);font:12px/1.55 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre;tab-size:2;user-select:text}.story-html-preview[hidden]{display:none!important}.story-detail-stats{min-height:34px;padding:7px 12px;border-top:1px solid var(--line);display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;color:var(--muted);font-size:12px}.story-detail-stats strong{color:var(--text);font-weight:600}:root[data-theme="light"] .story-image-placeholder{background:#fff8e8!important;border-color:#d7b66b!important}:root[data-theme="light"] .story-image-placeholder>.story-image-label{background:#fff2cf;color:#815800}:root[data-theme="light"] .story-html-preview{background:#fff;color:var(--text)}
`;
document.head.append(style);

function forwardDrop(target, dataTransfer) {
  if (!target || !dataTransfer) return;
  const forwarded = new Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(forwarded, 'dataTransfer', { value: dataTransfer });
  target.dispatchEvent(forwarded);
}

function currentItemRows() {
  return [...storyList.querySelectorAll(':scope > .story-item')];
}

function selectedNextId() {
  const rows = currentItemRows();
  const selected = new Set(rows.filter(row => row.classList.contains('story-con') && row.classList.contains('selected')).map(row => row.dataset.storyId).filter(Boolean));
  if (!selected.size) return null;
  let lastIndex = -1;
  rows.forEach((row, index) => { if (selected.has(row.dataset.storyId)) lastIndex = index; });
  return rows[lastIndex + 1]?.dataset.storyId || null;
}

function waitForNewText(existingIds, timeout = 2500) {
  return new Promise(resolve => {
    const started = performance.now();
    const check = () => {
      const row = [...storyList.querySelectorAll(':scope > .story-item.story-text[data-story-id]')].find(item => !existingIds.has(item.dataset.storyId));
      if (row) return resolve(row);
      if (performance.now() - started >= timeout) return resolve(null);
      requestAnimationFrame(check);
    };
    check();
  });
}

function moveStoryItemBefore(itemId, beforeId) {
  if (!itemId || !beforeId || itemId === beforeId) return;
  const target = storyList.querySelector(`:scope > .story-item[data-story-id="${CSS.escape(beforeId)}"]`);
  if (!target) return;
  const transfer = new DataTransfer();
  transfer.effectAllowed = 'move';
  transfer.setData('application/x-hhjstory-ids', JSON.stringify([itemId]));
  forwardDrop(target, transfer);
}

function ensureImageDragHandle(row) {
  if (row.querySelector(':scope > .story-drag-handle') || !row.dataset.storyId) return;
  const handle = document.createElement('button');
  handle.type = 'button';
  handle.className = 'icon-button story-drag-handle';
  handle.textContent = '⠿';
  handle.title = '드래그해서 이동';
  handle.setAttribute('aria-label', '드래그해서 이동');
  handle.draggable = true;
  handle.addEventListener('click', event => event.stopPropagation());
  handle.addEventListener('dragstart', event => {
    if (!event.dataTransfer) return;
    event.stopPropagation();
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/x-hhjstory-ids', JSON.stringify([row.dataset.storyId]));
    event.dataTransfer.setData('application/x-hhjstory-block', '1');
    event.dataTransfer.setData('text/plain', row.dataset.storyId);
    row.classList.add('dragging');
  });
  handle.addEventListener('dragend', () => row.classList.remove('dragging'));
  row.prepend(handle);
}

function decorateImageRow(row) {
  const textarea = row.querySelector(':scope > textarea');
  if (!textarea || textarea.value !== IMAGE_SENTINEL) return false;
  row.querySelector(':scope > .rich-text-editor')?.remove();
  row.querySelector(':scope > .story-break-center')?.remove();
  row.querySelector(':scope > .story-break-label')?.remove();
  row.classList.remove('story-text', 'rich-text-row', 'story-break');
  row.classList.add('story-image-placeholder');
  textarea.classList.remove('rich-text-source', 'story-break-source');
  textarea.classList.add('story-image-source');
  row.dataset.richTextReady = 'image';
  ensureImageDragHandle(row);
  if (!row.querySelector(':scope > .story-image-label')) {
    const label = document.createElement('div');
    label.className = 'story-image-label';
    label.textContent = '이미지 자료 삽입 위치';
    row.insertBefore(label, row.querySelector(':scope > .story-tools') || null);
  }
  row.title = IMAGE_PLACEHOLDER_TEXT;
  return true;
}

function decorateImages() {
  storyList.querySelectorAll(':scope > .story-item').forEach(decorateImageRow);
}

if (storyList && editorActions && addTextButton) {
  const imageButton = document.createElement('button');
  imageButton.type = 'button';
  imageButton.className = 'small';
  imageButton.textContent = '+ 이미지 위치';
  imageButton.title = 'DC에서 이미지를 첨부할 위치 표시';
  editorActions.insertBefore(imageButton, clearStoryButton || null);

  imageButton.addEventListener('click', async () => {
    const beforeId = selectedNextId();
    const existingIds = new Set(currentItemRows().map(row => row.dataset.storyId).filter(Boolean));
    addTextButton.click();
    const newRow = await waitForNewText(existingIds);
    if (!newRow) return;
    const textarea = newRow.querySelector(':scope > textarea');
    const newId = newRow.dataset.storyId;
    if (!textarea || !newId) return;
    textarea.value = IMAGE_SENTINEL;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    decorateImageRow(newRow);
    if (beforeId) moveStoryItemBefore(newId, beforeId);
  });
}

let previewMode = false;
let refreshTimer = null;
let refreshSeq = 0;
const numberFormat = new Intl.NumberFormat('ko-KR');
const preview = document.createElement('pre');
preview.className = 'story-html-preview';
preview.hidden = true;
preview.setAttribute('aria-label', '현재 원고 HTML 코드');
preview.setAttribute('aria-readonly', 'true');
preview.tabIndex = 0;
storyList.insertAdjacentElement('afterend', preview);

const detailStats = document.createElement('div');
detailStats.className = 'story-detail-stats';
detailStats.innerHTML = '<span>글자 <strong data-stat="text">0</strong>자</span><span>HTML <strong data-stat="html">0</strong>자</span><span>콘 <strong data-stat="con">0</strong>개</span><span>대사 <strong data-stat="dialogue">0</strong>개</span><span>줄바꿈 <strong data-stat="break">0</strong>줄</span>';
preview.insertAdjacentElement('afterend', detailStats);

async function refreshSnapshot() {
  const seq = ++refreshSeq;
  const snapshot = await buildStoryHtmlSnapshot(storyList);
  if (seq !== refreshSeq) return;
  detailStats.querySelector('[data-stat="text"]').textContent = numberFormat.format(snapshot.textCharCount);
  detailStats.querySelector('[data-stat="html"]').textContent = numberFormat.format(snapshot.htmlCharCount);
  detailStats.querySelector('[data-stat="con"]').textContent = numberFormat.format(snapshot.conCount);
  detailStats.querySelector('[data-stat="dialogue"]').textContent = numberFormat.format(snapshot.dialogueCount);
  detailStats.querySelector('[data-stat="break"]').textContent = numberFormat.format(snapshot.breakCount);
  if (previewMode) preview.textContent = snapshot.html || '<!-- 빈 원고 -->';
}

function scheduleRefresh(delay = 70) {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => refreshSnapshot().catch(() => {}), delay);
}

if (toolbar && editorPanel) {
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'story-html-toggle';
  toggle.textContent = 'HTML 보기';
  toggle.title = '현재 작성된 원고의 HTML 코드 보기';
  toolbar.append(toggle);
  toggle.addEventListener('click', () => {
    previewMode = !previewMode;
    editorPanel.classList.toggle('html-preview-mode', previewMode);
    toolbar.classList.toggle('html-preview-active', previewMode);
    preview.hidden = !previewMode;
    toggle.textContent = previewMode ? '블록 보기' : 'HTML 보기';
    toggle.title = previewMode ? '블록 편집 화면으로 돌아가기' : '현재 작성된 원고의 HTML 코드 보기';
    if (previewMode) scheduleRefresh(0);
  });
}

const observer = new MutationObserver(() => {
  decorateImages();
  scheduleRefresh();
});
observer.observe(storyList, { childList: true });
storyList.addEventListener('input', () => scheduleRefresh());
storyList.addEventListener('change', () => scheduleRefresh());
storyList.addEventListener('click', () => scheduleRefresh(0));
decorateImages();
scheduleRefresh(0);
