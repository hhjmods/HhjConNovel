import { getOne, putOne } from './db.js';
import {
  STORY_BLOCK_MIME,
  STORY_IDS_MIME,
  forwardDrop,
  transferHasType,
  writeStoryTransfer
} from './story-dnd-utils.js?v=20260906-2';

const BREAK_SENTINEL = '\uE000HHJCON_BREAK\uE001';
const storyList = document.getElementById('storyList');
const storyDropZone = document.getElementById('storyDropZone');
const editorActions = document.querySelector('.editor-header > div:last-child');
const addTextButton = document.getElementById('addTextBtn');

if (storyList && editorActions && addTextButton) {
  const breakButton = document.createElement('button');
  breakButton.className = 'small';
  breakButton.textContent = '+ 줄바꿈';
  const clearButton = document.getElementById('clearStoryBtn');
  editorActions.insertBefore(breakButton, clearButton || null);

  if (storyDropZone) storyDropZone.classList.add('legacy-story-drop-zone');

  function setSlotMode(slot, mode) {
    slot.classList.toggle('inline', mode === 'inline');
    slot.classList.toggle('block', mode === 'block');
  }

  function slotModeForDrag(dataTransfer, previous, next) {
    const previousIsCon = Boolean(previous?.classList.contains('story-con'));
    const nextIsCon = Boolean(next?.classList.contains('story-con'));
    const draggingTextBlock = transferHasType(dataTransfer, STORY_BLOCK_MIME);

    if (draggingTextBlock) {
      return previousIsCon && nextIsCon ? 'inline' : 'block';
    }
    if (next) return previousIsCon && nextIsCon ? 'inline' : 'block';
    return previousIsCon ? 'inline' : 'block';
  }

  function makeInsertSlot(target, previous, next, defaultMode) {
    const slot = document.createElement('div');
    slot.className = `story-insert-slot ${defaultMode}`;
    slot.title = '이 위치에 삽입';
    slot.addEventListener('dragenter', event => {
      event.preventDefault();
      setSlotMode(slot, slotModeForDrag(event.dataTransfer, previous, next));
      slot.classList.add('drop-target');
    });
    slot.addEventListener('dragover', event => {
      event.preventDefault();
      setSlotMode(slot, slotModeForDrag(event.dataTransfer, previous, next));
      event.dataTransfer.dropEffect = transferHasType(event.dataTransfer, STORY_IDS_MIME) ? 'move' : 'copy';
      slot.classList.add('drop-target');
    });
    slot.addEventListener('dragleave', () => {
      slot.classList.remove('drop-target');
      setSlotMode(slot, defaultMode);
    });
    slot.addEventListener('drop', event => {
      event.preventDefault();
      event.stopPropagation();
      slot.classList.remove('drop-target');
      setSlotMode(slot, defaultMode);
      forwardDrop(target, event.dataTransfer);
    });
    return slot;
  }

  function writeStoryDrag(event, row) {
    if (!event.dataTransfer || !row.dataset.storyId) return false;
    if (!writeStoryTransfer(event.dataTransfer, [row.dataset.storyId], { block: true, plainText: true })) return false;
    row.classList.add('dragging');
    return true;
  }

  function addStoryDragHandle(row) {
    if (row.dataset.storyDragHandleReady === '1') return;
    const tools = row.querySelector('.story-tools');
    if (!tools || !row.dataset.storyId) return;
    row.dataset.storyDragHandleReady = '1';

    const handle = document.createElement('button');
    handle.type = 'button';
    handle.className = 'icon-button story-drag-handle';
    handle.textContent = '⠿';
    handle.title = '드래그해서 이동';
    handle.setAttribute('aria-label', '드래그해서 이동');
    handle.draggable = true;
    handle.addEventListener('click', event => event.stopPropagation());
    handle.addEventListener('dragstart', event => {
      event.stopPropagation();
      writeStoryDrag(event, row);
    });
    handle.addEventListener('dragend', event => {
      event.stopPropagation();
      row.classList.remove('dragging');
    });
    row.prepend(handle);
  }

  function addBreakDrag(row) {
    if (row.dataset.breakDragReady === '1') return;
    row.dataset.breakDragReady = '1';
    row.draggable = false;
  }

  function decorateSentinelBreak(row) {
    const textarea = row.querySelector('textarea');
    if (!textarea || textarea.value !== BREAK_SENTINEL) return false;
    row.classList.add('story-break');
    textarea.classList.add('story-break-source');
    if (!row.querySelector('.story-break-label')) {
      const label = document.createElement('span');
      label.className = 'story-break-label';
      label.textContent = '줄바꿈';
      row.insertBefore(label, row.querySelector('.story-tools') || null);
    }
    addBreakDrag(row);
    return true;
  }

  const observer = new MutationObserver(() => decorateStory());

  function decorateStory() {
    observer.disconnect();
    storyList.querySelectorAll(':scope > .story-insert-slot').forEach(slot => slot.remove());
    const items = [...storyList.querySelectorAll(':scope > .story-item')];
    items.forEach(row => {
      if (row.classList.contains('story-text')) addStoryDragHandle(row);
      decorateSentinelBreak(row);
    });

    items.forEach((row, index) => {
      const previous = items[index - 1] || null;
      const defaultMode = previous?.classList.contains('story-con') && row.classList.contains('story-con') ? 'inline' : 'block';
      storyList.insertBefore(makeInsertSlot(row, previous, row, defaultMode), row);
    });

    const tail = storyList.querySelector(':scope > .story-tail-drop');
    if (tail) {
      const last = items.at(-1) || null;
      tail.classList.add('story-direct-tail');
      if (last?.classList.contains('story-con')) {
        storyList.insertBefore(makeInsertSlot(tail, last, null, 'inline'), tail);
        tail.classList.add('story-tail-hidden');
        tail.textContent = '';
      } else {
        tail.classList.remove('story-tail-hidden');
        tail.textContent = items.length ? '여기에 놓으면 맨 뒤에 삽입' : '여기에 콘을 놓아 삽입';
      }
    }
    observer.observe(storyList, { childList: true });
  }

  function currentItemRows() {
    return [...storyList.querySelectorAll(':scope > .story-item')];
  }

  function selectedNextId() {
    const rows = currentItemRows();
    const selected = new Set(
      rows.filter(row => row.classList.contains('story-con') && row.classList.contains('selected'))
        .map(row => row.dataset.storyId)
        .filter(Boolean)
    );
    if (!selected.size) return null;
    let lastIndex = -1;
    rows.forEach((row, index) => {
      if (selected.has(row.dataset.storyId)) lastIndex = index;
    });
    return rows[lastIndex + 1]?.dataset.storyId || null;
  }

  function waitForNewText(existingIds, timeout = 2500) {
    return new Promise(resolve => {
      const started = performance.now();
      const check = () => {
        const row = [...storyList.querySelectorAll(':scope > .story-text[data-story-id]')]
          .find(item => !existingIds.has(item.dataset.storyId));
        if (row) {
          resolve(row);
          return;
        }
        if (performance.now() - started >= timeout) {
          resolve(null);
          return;
        }
        requestAnimationFrame(check);
      };
      check();
    });
  }

  function moveStoryItemBefore(itemId, beforeId) {
    if (!itemId || !beforeId || itemId === beforeId) return;
    const target = storyList.querySelector(`.story-item[data-story-id="${CSS.escape(beforeId)}"]`);
    if (!target) return;
    const transfer = new DataTransfer();
    if (!writeStoryTransfer(transfer, [itemId])) return;
    forwardDrop(target, transfer);
  }

  async function migrateLegacyBreaks() {
    const story = await getOne('documents', 'current');
    if (!story?.items?.some(item => item.type === 'break')) return false;
    story.items = story.items.map(item => item.type === 'break' ? { ...item, type: 'text', text: BREAK_SENTINEL } : item);
    story.updatedAt = Date.now();
    await putOne('documents', story);
    return true;
  }

  breakButton.disabled = true;
  migrateLegacyBreaks().then(migrated => {
    if (migrated) {
      location.reload();
      return;
    }
    breakButton.disabled = false;
    decorateStory();
  }).catch(() => {
    breakButton.disabled = false;
    decorateStory();
  });

  breakButton.addEventListener('click', async () => {
    const beforeId = selectedNextId();
    const existingIds = new Set(
      [...storyList.querySelectorAll(':scope > .story-text[data-story-id]')].map(row => row.dataset.storyId)
    );
    addTextButton.click();
    const newRow = await waitForNewText(existingIds);
    if (!newRow) return;

    const newId = newRow.dataset.storyId;
    const textarea = newRow.querySelector('textarea');
    if (!newId || !textarea) return;
    textarea.value = BREAK_SENTINEL;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    if (beforeId) moveStoryItemBefore(newId, beforeId);
    decorateStory();
  });
}
