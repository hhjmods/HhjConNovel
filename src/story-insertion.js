import { appendStoryTextBlock, applyStoryDropTransfer } from './app.js?v=20260917-1';
import { getOne, putOne } from './db.js';
import {
  STORY_BLOCK_MIME,
  STORY_IDS_MIME,
  transferHasType,
  writeStoryTransfer
} from './story-dnd-utils.js?v=20260906-2';
import { writeStoryCreateTransfer } from './story/story-create-payload.js?v=20260914-1';

const BREAK_SENTINEL = '\uE000HHJCON_BREAK\uE001';
const storyList = document.getElementById('storyList');
const storyDropZone = document.getElementById('storyDropZone');
const editorActions = document.querySelector('.editor-header > div:last-child');
const textButton = document.getElementById('addTextBtn');

if (storyList && editorActions) {
  const breakButton = document.createElement('button');
  breakButton.className = 'small';
  breakButton.textContent = '+ 줄바꿈';
  const clearButton = document.getElementById('clearStoryBtn');
  editorActions.insertBefore(breakButton, clearButton || null);

  function enableCreateDrag(button, text, label) {
    if (!button) return;
    button.draggable = true;
    button.classList.add('story-create-drag-source');
    button.title = `클릭: 원고 끝에 ${label} 추가 · 드래그: 원하는 위치에 추가`;
    button.addEventListener('dragstart', event => {
      writeStoryCreateTransfer(event.dataTransfer, text);
    });
  }

  enableCreateDrag(textButton, '', '대사');
  enableCreateDrag(breakButton, BREAK_SENTINEL, '줄바꿈');

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

  function makeInsertSlot(previous, next, defaultMode) {
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
      const beforeId = next?.dataset?.storyId || null;
      void applyStoryDropTransfer(event.dataTransfer, beforeId).catch(error => {
        console.error('원고 삽입 슬롯 drop 적용 중 오류가 발생했습니다.', error);
      });
    });
    return slot;
  }

  function writeStoryDrag(event, row) {
    if (!event.dataTransfer || !row.dataset.storyId) return false;
    const selectedRows = [...storyList.querySelectorAll(':scope > .story-item.selected[data-story-id]')];
    const ids = row.classList.contains('selected')
      ? selectedRows.map(item => item.dataset.storyId)
      : [row.dataset.storyId];
    if (!row.classList.contains('selected')) {
      selectedRows.forEach(item => item.classList.remove('selected'));
      row.classList.add('selected');
    }
    if (!writeStoryTransfer(event.dataTransfer, ids, { block: true, plainText: true })) return false;
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
    handle.addEventListener('click', event => {
      if (!event.ctrlKey && !event.metaKey && !event.shiftKey) event.stopPropagation();
    });
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

  function decorateStory() {
    storyList.querySelectorAll(':scope > .story-insert-slot').forEach(slot => slot.remove());
    const items = [...storyList.querySelectorAll(':scope > .story-item')];
    items.forEach(row => {
      if (row.classList.contains('story-text')) addStoryDragHandle(row);
      decorateSentinelBreak(row);
    });

    items.forEach((row, index) => {
      const previous = items[index - 1] || null;
      const defaultMode = previous?.classList.contains('story-con') && row.classList.contains('story-con') ? 'inline' : 'block';
      storyList.insertBefore(makeInsertSlot(previous, row, defaultMode), row);
    });

    const tail = storyList.querySelector(':scope > .story-tail-drop');
    if (tail) {
      const last = items.at(-1) || null;
      tail.classList.add('story-direct-tail');
      if (last?.classList.contains('story-con')) {
        storyList.insertBefore(makeInsertSlot(last, null, 'inline'), tail);
        tail.classList.add('story-tail-hidden');
        tail.textContent = '';
      } else {
        tail.classList.remove('story-tail-hidden');
        tail.textContent = items.length ? '여기에 놓으면 맨 뒤에 삽입' : '여기에 콘을 놓아 삽입';
      }
    }
  }

  document.addEventListener('hhjcon:story-rendered', decorateStory);

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
    await appendStoryTextBlock(BREAK_SENTINEL);
  });
}
