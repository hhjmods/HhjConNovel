import { appendStoryTextBlock } from './app.js?v=20260914-8';
import { getOne, putOne } from './db.js';
import { writeStoryTransfer } from './story-dnd-utils.js?v=20260906-2';
import { writeStoryCreateTransfer } from './story/story-create-payload.js?v=20260914-1';
import { buildStoryHtmlSnapshot, IMAGE_PLACEHOLDER_TEXT, IMAGE_SENTINEL } from './story/story-html.js?v=20260914-1';
import { DC_HTML_LIMIT } from './story/story-html-utils.js?v=20260912-3';

const storyList = document.getElementById('storyList');
const editorPanel = document.querySelector('.editor-panel');
const editorActions = document.querySelector('.editor-header > div:last-child');
const clearStoryButton = document.getElementById('clearStoryBtn');
const toolbar = document.querySelector('.text-format-toolbar');
const IMAGE_MEMO_DOC_ID = 'image-marker-memo-v1';

let imageMemoDoc = { id: IMAGE_MEMO_DOC_ID, version: 1, items: {}, updatedAt: Date.now() };
let imageMemoLoaded = false;
let imageMemoSaveTimer = null;
let imageMemoSaveChain = Promise.resolve();
const imageMemoEditedBeforeLoad = new Set();

function queueImageMemoSave() {
  clearTimeout(imageMemoSaveTimer);
  imageMemoSaveTimer = setTimeout(() => {
    imageMemoDoc.updatedAt = Date.now();
    const snapshot = structuredClone(imageMemoDoc);
    imageMemoSaveChain = imageMemoSaveChain.catch(() => {}).then(() => putOne('documents', snapshot));
  }, 160);
}

function setImageMemo(storyId, value) {
  const text = String(value ?? '');
  if (!imageMemoLoaded) imageMemoEditedBeforeLoad.add(storyId);
  if (text.trim()) imageMemoDoc.items[storyId] = { text, updatedAt: Date.now() };
  else delete imageMemoDoc.items[storyId];
  queueImageMemoSave();
}

function savedImageMemo(storyId) {
  return String(imageMemoDoc.items?.[storyId]?.text || '');
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
  handle.addEventListener('click', event => {
    if (!event.ctrlKey && !event.metaKey && !event.shiftKey) event.stopPropagation();
  });
  handle.addEventListener('dragstart', event => {
    if (!event.dataTransfer) return;
    event.stopPropagation();
    const selectedRows = [...storyList.querySelectorAll(':scope > .story-item.selected[data-story-id]')];
    const ids = row.classList.contains('selected')
      ? selectedRows.map(item => item.dataset.storyId)
      : [row.dataset.storyId];
    if (!row.classList.contains('selected')) {
      selectedRows.forEach(item => item.classList.remove('selected'));
      row.classList.add('selected');
    }
    if (!writeStoryTransfer(event.dataTransfer, ids, { block: true, plainText: true })) return;
    row.classList.add('dragging');
  });
  handle.addEventListener('dragend', () => row.classList.remove('dragging'));
  row.prepend(handle);
}

function ensureImageMemoInput(row, label) {
  const storyId = row.dataset.storyId;
  if (!storyId) return null;
  let input = label.querySelector(':scope > .story-image-memo-input');
  if (!input) {
    input = document.createElement('input');
    input.type = 'text';
    input.className = 'story-image-memo-input';
    input.placeholder = '어떤 이미지를 넣을지 구분하기 위한 메모를 입력하세요.';
    input.setAttribute('aria-label', '이미지 자료 메모');
    input.autocomplete = 'off';
    input.draggable = false;
    input.addEventListener('pointerdown', event => event.stopPropagation());
    input.addEventListener('click', event => event.stopPropagation());
    input.addEventListener('dragstart', event => event.stopPropagation());
    input.addEventListener('input', () => setImageMemo(storyId, input.value));
    label.append(input);
  }
  if (imageMemoLoaded && document.activeElement !== input) input.value = savedImageMemo(storyId);
  return input;
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
  let label = row.querySelector(':scope > .story-image-label');
  if (!label) {
    label = document.createElement('div');
    label.className = 'story-image-label';
    const title = document.createElement('strong');
    title.textContent = '이미지 자료 위치 마커';
    const help = document.createElement('small');
    help.textContent = 'DC 글쓰기에서 위치 표시 문구를 지우고 이미지를 넣으세요. DC 예상 글자수는 실제 이미지로 교체한 상태를 기준으로 계산합니다.';
    label.append(title, help);
    row.insertBefore(label, row.querySelector(':scope > .story-tools') || null);
  }
  ensureImageMemoInput(row, label);
  const help = label.querySelector('small');
  if (help) label.append(help);
  row.title = IMAGE_PLACEHOLDER_TEXT;
  return true;
}

function decorateImages() {
  storyList.querySelectorAll(':scope > .story-item').forEach(decorateImageRow);
}

if (storyList && editorActions) {
  const imageButton = document.createElement('button');
  imageButton.type = 'button';
  imageButton.className = 'small';
  imageButton.textContent = '+ 이미지 마커';
  imageButton.title = '클릭: 원고 끝에 이미지 마커 추가 · 드래그: 원하는 위치에 추가';
  imageButton.draggable = true;
  imageButton.classList.add('story-create-drag-source');
  editorActions.insertBefore(imageButton, clearStoryButton || null);

  imageButton.addEventListener('click', async () => {
    await appendStoryTextBlock(IMAGE_SENTINEL);
  });
  imageButton.addEventListener('dragstart', event => {
    writeStoryCreateTransfer(event.dataTransfer, IMAGE_SENTINEL);
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
detailStats.innerHTML = `<span>글자 <strong data-stat="text">0</strong>자</span><span>HTML <strong data-stat="html">0</strong>자</span><span data-stat-wrap="dc-html" title="콘 인증값을 넣고 이미지 마커를 현재 DC 업로드 이미지 코드로 교체했을 때의 예상 길이">DC 예상 <strong data-stat="dc-html">0</strong> / ${numberFormat.format(DC_HTML_LIMIT)}자</span><span>콘 <strong data-stat="con">0</strong>개</span><span>대사 <strong data-stat="dialogue">0</strong>개</span><span>줄바꿈 <strong data-stat="break">0</strong>줄</span><span>이미지 <strong data-stat="image">0</strong>개</span>`;
preview.insertAdjacentElement('afterend', detailStats);

async function refreshSnapshot() {
  const seq = ++refreshSeq;
  const snapshot = await buildStoryHtmlSnapshot(storyList);
  if (seq !== refreshSeq) return;
  detailStats.querySelector('[data-stat="text"]').textContent = numberFormat.format(snapshot.textCharCount);
  detailStats.querySelector('[data-stat="html"]').textContent = numberFormat.format(snapshot.htmlCharCount);
  const dcHtmlStat = detailStats.querySelector('[data-stat-wrap="dc-html"]');
  dcHtmlStat.classList.toggle('over-limit', snapshot.dcHtmlCharCount > DC_HTML_LIMIT);
  dcHtmlStat.querySelector('[data-stat="dc-html"]').textContent = numberFormat.format(snapshot.dcHtmlCharCount);
  detailStats.querySelector('[data-stat="con"]').textContent = numberFormat.format(snapshot.conCount);
  detailStats.querySelector('[data-stat="dialogue"]').textContent = numberFormat.format(snapshot.dialogueCount);
  detailStats.querySelector('[data-stat="break"]').textContent = numberFormat.format(snapshot.breakCount);
  detailStats.querySelector('[data-stat="image"]').textContent = numberFormat.format(snapshot.imageCount);
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
  toolbar.insertBefore(toggle, toolbar.querySelector('.story-html-copy'));
  toggle.addEventListener('click', () => {
    previewMode = !previewMode;
    editorPanel.classList.toggle('html-preview-mode', previewMode);
    toolbar.classList.toggle('html-preview-active', previewMode);
    document.querySelectorAll('.story-header-edit-actions button:not(.story-html-copy):not(.story-html-toggle)').forEach(button => { button.disabled = previewMode; });
    preview.hidden = !previewMode;
    toggle.textContent = previewMode ? '블록 보기' : 'HTML 보기';
    toggle.title = previewMode ? '블록 편집 화면으로 돌아가기' : '현재 작성된 원고 HTML 코드 보기';
    if (previewMode) scheduleRefresh(0);
  });
}

document.addEventListener('hhjcon:story-rendered', () => {
  decorateImages();
  scheduleRefresh();
});
storyList.addEventListener('input', () => scheduleRefresh());
storyList.addEventListener('change', () => scheduleRefresh());
storyList.addEventListener('click', () => scheduleRefresh(0));

getOne('documents', IMAGE_MEMO_DOC_ID).then(saved => {
  if (saved?.items && typeof saved.items === 'object') {
    const edited = structuredClone(imageMemoDoc.items);
    imageMemoDoc = saved;
    imageMemoEditedBeforeLoad.forEach(storyId => {
      if (edited[storyId]) imageMemoDoc.items[storyId] = edited[storyId];
      else delete imageMemoDoc.items[storyId];
    });
  }
  imageMemoLoaded = true;
  decorateImages();
  scheduleRefresh(0);
}).catch(() => {
  imageMemoLoaded = true;
  decorateImages();
  scheduleRefresh(0);
});

decorateImages();
scheduleRefresh(0);
