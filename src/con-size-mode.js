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

  function targetRows(row) {
    if (!row.classList.contains('selected')) return [row];
    const selected = [...storyList.querySelectorAll(':scope > .story-con.selected[data-story-id]')];
    return selected.length ? selected : [row];
  }

  function setRowsBig(rows, big) {
    const changedAt = Date.now();
    rows.forEach(row => {
      const storyId = row.dataset.storyId;
      if (!storyId) return;
      if (big) displayDoc.items[storyId] = { big: true, updatedAt: changedAt };
      else delete displayDoc.items[storyId];
      const button = row.querySelector(':scope > .story-tools > .con-size-toggle');
      if (button) applyRowState(row, button);
    });
    queueSave();
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
        setRowsBig(targetRows(row), !isBig(storyId));
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
