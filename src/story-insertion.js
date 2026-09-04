import { getOne, putOne } from './db.js';

const storyList = document.getElementById('storyList');
const storyDropZone = document.getElementById('storyDropZone');
const editorActions = document.querySelector('.editor-header > div:last-child');

if (storyList && editorActions) {
  const breakButton = document.createElement('button');
  breakButton.className = 'small';
  breakButton.textContent = '+ 줄바꿈';
  const clearButton = document.getElementById('clearStoryBtn');
  editorActions.insertBefore(breakButton, clearButton || null);

  if (storyDropZone) storyDropZone.classList.add('legacy-story-drop-zone');

  function forwardDrop(target, dataTransfer) {
    if (!target || !dataTransfer) return;
    const forwarded = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(forwarded, 'dataTransfer', { value: dataTransfer });
    target.dispatchEvent(forwarded);
  }

  function makeInsertSlot(target) {
    const slot = document.createElement('div');
    slot.className = 'story-insert-slot';
    slot.title = '이 위치에 삽입';
    slot.addEventListener('dragenter', event => {
      event.preventDefault();
      slot.classList.add('drop-target');
    });
    slot.addEventListener('dragover', event => {
      event.preventDefault();
      event.dataTransfer.dropEffect = event.dataTransfer.types.includes('application/x-hhjstory-ids') ? 'move' : 'copy';
      slot.classList.add('drop-target');
    });
    slot.addEventListener('dragleave', () => slot.classList.remove('drop-target'));
    slot.addEventListener('drop', event => {
      event.preventDefault();
      event.stopPropagation();
      slot.classList.remove('drop-target');
      forwardDrop(target, event.dataTransfer);
    });
    return slot;
  }

  async function removeBreak(id) {
    const story = await getOne('documents', 'current');
    if (!story?.items) return;
    story.items = story.items.filter(item => String(item.id) !== String(id));
    story.updatedAt = Date.now();
    await putOne('documents', story);
    location.reload();
  }

  function decorateBreak(row) {
    if (row.dataset.breakDecorated === '1') return;
    row.dataset.breakDecorated = '1';
    row.draggable = true;
    const label = document.createElement('span');
    label.className = 'story-break-label';
    label.textContent = '줄바꿈';
    const remove = document.createElement('button');
    remove.className = 'icon-button story-break-remove';
    remove.textContent = '×';
    remove.title = '줄바꿈 삭제';
    remove.addEventListener('click', event => {
      event.stopPropagation();
      removeBreak(row.dataset.storyId);
    });
    row.append(label, remove);
    row.addEventListener('dragstart', event => {
      if (!event.dataTransfer) return;
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('application/x-hhjstory-ids', JSON.stringify([row.dataset.storyId]));
    });
  }

  const observer = new MutationObserver(() => decorateStory());

  function decorateStory() {
    observer.disconnect();
    storyList.querySelectorAll(':scope > .story-insert-slot').forEach(slot => slot.remove());
    const items = [...storyList.querySelectorAll(':scope > .story-item')];
    items.forEach(row => {
      storyList.insertBefore(makeInsertSlot(row), row);
      if (row.classList.contains('story-break')) decorateBreak(row);
    });
    const tail = storyList.querySelector(':scope > .story-tail-drop');
    if (tail) {
      tail.classList.add('story-direct-tail');
      tail.textContent = '여기에 놓으면 맨 뒤에 삽입';
    }
    observer.observe(storyList, { childList: true });
  }

  breakButton.addEventListener('click', async () => {
    const story = await getOne('documents', 'current') || { id: 'current', items: [], updatedAt: Date.now() };
    if (!Array.isArray(story.items)) story.items = [];
    const selectedIds = [...storyList.querySelectorAll('.story-con.selected[data-story-id]')].map(row => String(row.dataset.storyId));
    let insertAt = story.items.length;
    if (selectedIds.length) {
      const selected = new Set(selectedIds);
      let lastIndex = -1;
      story.items.forEach((item, index) => {
        if (selected.has(String(item.id))) lastIndex = index;
      });
      if (lastIndex >= 0) insertAt = lastIndex + 1;
    }
    story.items.splice(insertAt, 0, { id: `story_${crypto.randomUUID()}`, type: 'break' });
    story.updatedAt = Date.now();
    await putOne('documents', story);
    location.reload();
  });

  decorateStory();
}
