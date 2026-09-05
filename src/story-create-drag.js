const storyList = document.getElementById('storyList');
const addTextButton = document.getElementById('addTextBtn');
const NEW_BLOCK_MIME = 'application/x-hhjstory-new-block';

if (storyList && addTextButton) {
  const style = document.createElement('style');
  style.textContent = `
.story-create-drag-source{cursor:grab;user-select:none}
.story-create-drag-source:active,.story-create-drag-source.story-create-dragging{cursor:grabbing}
`;
  document.head.append(style);

  let activeKind = null;
  let activeBoundary = null;
  let guide = null;
  let insertBusy = false;

  function directRows() {
    return [...storyList.querySelectorAll(':scope > .story-item')];
  }

  function previousRow(node) {
    let current = node?.previousElementSibling || null;
    while (current) {
      if (current.classList.contains('story-item')) return current;
      current = current.previousElementSibling;
    }
    return null;
  }

  function nextRow(node) {
    let current = node?.nextElementSibling || null;
    while (current) {
      if (current.classList.contains('story-item')) return current;
      current = current.nextElementSibling;
    }
    return null;
  }

  function ensureGuide() {
    if (guide?.isConnected) return guide;
    guide = document.createElement('div');
    guide.className = 'story-drop-guide hidden';
    guide.dataset.createBlockGuide = '1';
    document.body.append(guide);
    return guide;
  }

  function hideGuide() {
    activeBoundary = null;
    if (!guide) return;
    guide.classList.add('hidden');
    guide.classList.remove('horizontal', 'vertical');
  }

  function showHorizontal(top) {
    const marker = ensureGuide();
    const rect = storyList.getBoundingClientRect();
    marker.classList.remove('hidden', 'vertical');
    marker.classList.add('horizontal');
    marker.style.left = `${rect.left + 8}px`;
    marker.style.top = `${top - 3}px`;
    marker.style.width = `${Math.max(0, rect.width - 16)}px`;
    marker.style.height = '6px';
  }

  function showVerticalBefore(row) {
    const marker = ensureGuide();
    const rect = row.getBoundingClientRect();
    marker.classList.remove('hidden', 'horizontal');
    marker.classList.add('vertical');
    marker.style.left = `${rect.left - 4}px`;
    marker.style.top = `${rect.top}px`;
    marker.style.width = '8px';
    marker.style.height = `${rect.height}px`;
  }

  function showBoundary(previous, next) {
    activeBoundary = { previous, next };
    const previousIsCon = Boolean(previous?.classList.contains('story-con'));
    const nextIsCon = Boolean(next?.classList.contains('story-con'));
    if (previousIsCon && nextIsCon) {
      showVerticalBefore(next);
      return;
    }
    if (next) {
      showHorizontal(next.getBoundingClientRect().top);
      return;
    }
    if (previous) {
      showHorizontal(previous.getBoundingClientRect().bottom);
      return;
    }
    const rect = storyList.getBoundingClientRect();
    showHorizontal(rect.top + 12);
  }

  function nearestRow(clientX, clientY) {
    const rows = directRows();
    if (!rows.length) return null;
    let best = null;
    let bestDistance = Infinity;
    rows.forEach(row => {
      const rect = row.getBoundingClientRect();
      const dx = clientX < rect.left ? rect.left - clientX : clientX > rect.right ? clientX - rect.right : 0;
      const dy = clientY < rect.top ? rect.top - clientY : clientY > rect.bottom ? clientY - rect.bottom : 0;
      const distance = dx * dx + dy * dy;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = row;
      }
    });
    return best;
  }

  function boundaryFromEvent(event) {
    const rows = directRows();
    if (!rows.length) return { previous: null, next: null };
    const slot = event.target.closest?.('.story-insert-slot');
    if (slot) return { previous: previousRow(slot), next: nextRow(slot) };
    const tail = event.target.closest?.('.story-tail-drop');
    if (tail) return { previous: rows.at(-1) || null, next: null };

    let row = event.target.closest?.('.story-item');
    if (!row) {
      const last = rows.at(-1);
      if (last && event.clientY >= last.getBoundingClientRect().bottom) return { previous: last, next: null };
      row = nearestRow(event.clientX, event.clientY);
    }
    if (!row) return { previous: rows.at(-1) || null, next: null };

    const rect = row.getBoundingClientRect();
    if (row.classList.contains('story-con')) {
      if (event.clientX < rect.left + rect.width / 2) return { previous: previousRow(row), next: row };
      return { previous: row, next: nextRow(row) };
    }
    if (event.clientY < rect.top + rect.height / 2) return { previous: previousRow(row), next: row };
    return { previous: row, next: nextRow(row) };
  }

  function hasNewBlockType(dataTransfer) {
    return Boolean(dataTransfer?.types?.includes(NEW_BLOCK_MIME));
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
    button.dataset.createBlockKind = kind;
    button.classList.add('story-create-drag-source');
    button.draggable = true;
    button.title = sourceTitle(kind);
    button.addEventListener('dragstart', event => {
      if (!event.dataTransfer) return;
      activeKind = kind;
      activeBoundary = null;
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData(NEW_BLOCK_MIME, kind);
      event.dataTransfer.setData('text/plain', `hhjcon-new-block:${kind}`);
      button.classList.add('story-create-dragging');
    });
    button.addEventListener('dragend', () => {
      button.classList.remove('story-create-dragging');
      activeKind = null;
      hideGuide();
    });
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

  storyList.addEventListener('dragover', event => {
    if (!activeKind || !hasNewBlockType(event.dataTransfer)) return;
    const boundary = boundaryFromEvent(event);
    activeBoundary = boundary;
    showBoundary(boundary.previous, boundary.next);
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    event.stopPropagation();
    event.stopImmediatePropagation();
  }, true);

  storyList.addEventListener('drop', event => {
    if (!activeKind || !hasNewBlockType(event.dataTransfer)) return;
    const boundary = activeBoundary || boundaryFromEvent(event);
    const beforeId = boundary.next?.dataset.storyId || null;
    const kind = event.dataTransfer.getData(NEW_BLOCK_MIME) || activeKind;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    hideGuide();
    activeKind = null;
    setTimeout(() => insertDraggedBlock(kind, beforeId), 0);
  }, true);

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
