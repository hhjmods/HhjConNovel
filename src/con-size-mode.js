import { getOne, putOne } from './db.js';

const storyList = document.getElementById('storyList');
const DOC_ID = 'con-display-v1';

if (storyList) {
  let displayDoc = {
    id: DOC_ID,
    version: 1,
    items: {},
    updatedAt: Date.now()
  };
  let saveChain = Promise.resolve();

  function isBig(storyId) {
    return Boolean(displayDoc.items?.[storyId]?.big);
  }

  function queueSave() {
    displayDoc.updatedAt = Date.now();
    const snapshot = structuredClone(displayDoc);
    saveChain = saveChain.catch(() => {}).then(() => putOne('documents', snapshot));
  }

  function applyRowState(row, button) {
    const storyId = row.dataset.storyId;
    if (!storyId) return;
    const big = isBig(storyId);
    row.classList.toggle('story-con-big', big);
    button.classList.toggle('active', big);
    button.setAttribute('aria-pressed', big ? 'true' : 'false');
    button.title = big ? '일반콘으로 사용' : '대왕콘으로 사용';
  }

  function decorateRow(row) {
    const storyId = row.dataset.storyId;
    const tools = row.querySelector(':scope > .story-tools');
    if (!storyId || !tools) return;

    let button = tools.querySelector(':scope > .con-size-toggle');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'icon-button con-size-toggle';
      button.textContent = '대왕';
      button.setAttribute('aria-label', '대왕콘 전환');
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        const nextBig = !isBig(storyId);
        if (nextBig) {
          displayDoc.items[storyId] = { big: true, updatedAt: Date.now() };
        } else {
          delete displayDoc.items[storyId];
        }
        applyRowState(row, button);
        queueSave();
      });
      tools.prepend(button);
    }
    applyRowState(row, button);
  }

  function decorateStory() {
    storyList.querySelectorAll(':scope > .story-con').forEach(decorateRow);
  }

  const observer = new MutationObserver(decorateStory);
  observer.observe(storyList, { childList: true });

  getOne('documents', DOC_ID).then(saved => {
    if (saved?.items && typeof saved.items === 'object') displayDoc = saved;
    decorateStory();
  }).catch(() => decorateStory());
}
