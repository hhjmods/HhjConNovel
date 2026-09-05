const storyList = document.getElementById('storyList');
const addTextButton = document.getElementById('addTextBtn');
const NEW_BLOCK_MIME = 'application/x-hhjstory-new-block';
const NEW_BLOCK_DROP_EVENT = 'hhjcon:story-create-drop';

if (storyList && addTextButton) {
  const style = document.createElement('style');
  style.textContent = `
.story-create-drag-source{cursor:grab;user-select:none}
.story-create-drag-source:active,.story-create-drag-source.story-create-dragging{cursor:grabbing}
`;
  document.head.append(style);

  let insertBusy = false;

  function directRows() {
    return [...storyList.querySelectorAll(':scope > .story-item')];
  }

  function findCreateButtons() {
    const buttons = [...document.querySelectorAll('.editor-header button, .story-header-edit-actions button')];
    return {
      text: addTextButton,
      break: buttons.find(button => button.textContent.trim() === '+ 줄바꿈') || null,
      image: buttons.find(button => button.textContent.trim() === '+ 이미지 마커') || null
    };
  }

  function sourceTitle(kind) {
    if (kind === 'text') return '클릭하면 대사를 추가하고, 드래그하면 원하는 위치에 대사를 추가합니다.';
    if (kind === 'break') return '클릭하면 줄바꿈을 추가하고, 드래그하면 원하는 위치에 줄바꿈을 추가합니다.';
    return '클릭하면 이미지 마커를 추가하고, 드래그하면 원하는 위치에 이미지 마커를 추가합니다.';
  }

  function prepareButton(button, kind) {
    if (!button || button.dataset.createDragReady === '1') return;
    button.dataset.createDragReady = '1';
    button.dataset.storyCreateKind = kind;
    button.classList.add('story-create-drag-source');
    button.draggable = true;
    button.title = sourceTitle(kind);
    button.addEventListener('dragstart', event => {
      if (!event.dataTransfer) return;
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData(NEW_BLOCK_MIME, kind);
      event.dataTransfer.setData('text/plain', `hhjcon-new-block:${kind}`);
      button.classList.add('story-create-dragging');
    });
    button.addEventListener('dragend', () => button.classList.remove('story-create-dragging'));
  }

  function prepareButtons() {
    const buttons = findCreateButtons();
    prepareButton(buttons.text, 'text');
    prepareButton(buttons.break, 'break');
    prepareButton(buttons.image, 'image');
  }

  function waitForCreatedRow(existingIds, kind, timeout = 3000) {
    return new Promise(resolve => {
      const started = performance.now();
      const check = () => {
        const row = directRows().find(item => item.dataset.storyId && !existingIds.has(item.dataset.storyId));
        if (row) {
          const ready = kind === 'break'
            ? row.classList.contains('story-break')
            : kind === 'image'
              ? row.classList.contains('story-image-placeholder')
              : row.classList.contains('story-text') && !row.classList.contains('story-break');
          if (ready) return resolve(row);
        }
        if (performance.now() - started >= timeout) return resolve(row || null);
        requestAnimationFrame(check);
      };
      check();
    });
  }

  function forwardMove(rowId, beforeId) {
    if (!rowId) return;
    const target = beforeId
      ? storyList.querySelector(`:scope > .story-item[data-story-id="${CSS.escape(beforeId)}"]`)
      : storyList.querySelector(':scope > .story-tail-drop');
    if (!target) return;
    const transfer = new DataTransfer();
    transfer.effectAllowed = 'move';
    transfer.setData('application/x-hhjstory-ids', JSON.stringify([rowId]));
    transfer.setData('text/plain', rowId);
    const drop = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(drop, 'dataTransfer', { value: transfer });
    target.dispatchEvent(drop);
  }

  async function insertDraggedBlock(kind, beforeId) {
    if (insertBusy) return;
    const button = findCreateButtons()[kind];
    if (!button) return;
    insertBusy = true;
    try {
      const existingIds = new Set(directRows().map(row => row.dataset.storyId).filter(Boolean));
      button.click();
      const row = await waitForCreatedRow(existingIds, kind);
      if (!row?.dataset.storyId) return;
      forwardMove(row.dataset.storyId, beforeId);
      if (kind === 'text') {
        requestAnimationFrame(() => {
          const moved = storyList.querySelector(`:scope > .story-item[data-story-id="${CSS.escape(row.dataset.storyId)}"]`);
          moved?.querySelector('.rich-text-editor, textarea')?.focus();
        });
      }
    } finally {
      insertBusy = false;
    }
  }

  window.addEventListener(NEW_BLOCK_DROP_EVENT, event => {
    const kind = String(event.detail?.kind || '');
    if (!['text', 'break', 'image'].includes(kind)) return;
    const beforeId = event.detail?.beforeId ? String(event.detail.beforeId) : null;
    setTimeout(() => insertDraggedBlock(kind, beforeId), 0);
  });

  const buttonObserver = new MutationObserver(prepareButtons);
  buttonObserver.observe(document.querySelector('.editor-header') || document.body, { childList: true, subtree: true });
  prepareButtons();

  function patchEmptyTailText() {
    const tail = storyList.querySelector(':scope > .story-tail-drop');
    if (tail && !directRows().length && tail.textContent === '여기에 콘을 놓아 삽입') tail.textContent = '여기에 놓아 삽입';
  }
  const storyObserver = new MutationObserver(patchEmptyTailText);
  storyObserver.observe(storyList, { childList: true });
  patchEmptyTailText();
}
