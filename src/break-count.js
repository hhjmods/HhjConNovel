import { getOne, putOne } from './db.js';

const BREAK_SENTINEL = '\uE000HHJCON_BREAK\uE001';
const DOC_ID = 'break-count-v1';
const storyList = document.getElementById('storyList');

if (storyList) {
  let breakDoc = {
    id: DOC_ID,
    version: 1,
    items: {},
    updatedAt: Date.now()
  };
  let loaded = false;
  let saveChain = Promise.resolve();

  function countFor(storyId) {
    const value = Number(breakDoc.items?.[storyId]?.count);
    return Number.isInteger(value) && value >= 1 ? value : 1;
  }

  function normalizedCount(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 1;
    return Math.max(1, Math.trunc(number));
  }

  function queueSave() {
    breakDoc.updatedAt = Date.now();
    const snapshot = structuredClone(breakDoc);
    saveChain = saveChain.catch(() => {}).then(() => putOne('documents', snapshot));
  }

  function setCount(storyId, count) {
    const next = normalizedCount(count);
    if (next === 1) delete breakDoc.items[storyId];
    else breakDoc.items[storyId] = { count: next, updatedAt: Date.now() };
    queueSave();
    return next;
  }

  function isBreakRow(row) {
    if (row.classList.contains('story-break')) return true;
    return row.querySelector(':scope > textarea')?.value === BREAK_SENTINEL;
  }

  function ensureCenter(row) {
    let center = row.querySelector(':scope > .story-break-center');
    if (center) return center;

    center = document.createElement('div');
    center.className = 'story-break-center';
    const tools = row.querySelector(':scope > .story-tools');
    row.insertBefore(center, tools || null);

    let label = row.querySelector(':scope > .story-break-label');
    if (!label) {
      label = document.createElement('span');
      label.className = 'story-break-label';
      label.textContent = '줄바꿈';
    }
    center.append(label);
    return center;
  }

  function decorateRow(row) {
    if (!isBreakRow(row)) return;
    const storyId = row.dataset.storyId;
    if (!storyId) return;

    const center = ensureCenter(row);
    let control = center.querySelector(':scope > .story-break-count-control');
    let input = control?.querySelector('input');

    if (!control) {
      control = document.createElement('label');
      control.className = 'story-break-count-control';

      input = document.createElement('input');
      input.type = 'number';
      input.className = 'story-break-count-input';
      input.min = '1';
      input.step = '1';
      input.inputMode = 'numeric';
      input.setAttribute('aria-label', '줄바꿈 줄 수');
      input.title = '줄바꿈 줄 수';
      input.draggable = false;

      const suffix = document.createElement('span');
      suffix.textContent = '줄';
      control.append(input, suffix);
      center.append(control);

      input.addEventListener('click', event => event.stopPropagation());
      input.addEventListener('pointerdown', event => event.stopPropagation());
      input.addEventListener('dragstart', event => event.stopPropagation());
      input.addEventListener('input', () => {
        const value = Number(input.value);
        if (!Number.isInteger(value) || value < 1) return;
        setCount(storyId, value);
        row.dataset.breakCount = String(value);
        row.title = `${value}줄 줄바꿈`;
      });
      input.addEventListener('change', () => {
        const value = setCount(storyId, input.value);
        input.value = String(value);
        row.dataset.breakCount = String(value);
        row.title = `${value}줄 줄바꿈`;
      });
    }

    const count = countFor(storyId);
    input.value = String(count);
    row.dataset.breakCount = String(count);
    row.title = `${count}줄 줄바꿈`;
  }

  function decorateStory() {
    if (!loaded) return;
    storyList.querySelectorAll(':scope > .story-item').forEach(decorateRow);
  }

  const observer = new MutationObserver(decorateStory);
  observer.observe(storyList, { childList: true });

  getOne('documents', DOC_ID).then(saved => {
    if (saved?.items && typeof saved.items === 'object') breakDoc = saved;
    loaded = true;
    decorateStory();
  }).catch(() => {
    loaded = true;
    decorateStory();
  });
}
