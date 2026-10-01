import { getOne, putOne } from '../db.js';
import { STORY_BLOCKS_PASTED_EVENT } from './story-block-clipboard.js?v=20260921-1';
import { normalizeAfterBreakCount } from './story-html.js?v=20260923-1';

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
  let resolveReady;
  const ready = new Promise(resolve => { resolveReady = resolve; });

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
    return saveChain;
  }

  function afterCountFor(storyId) {
    return normalizeAfterBreakCount(breakDoc.items?.[storyId]?.afterCount);
  }

  document.addEventListener(STORY_BLOCKS_PASTED_EVENT, event => {
    if (!Array.isArray(event.detail?.tasks)) return;
    const entries = event.detail?.entries || [];
    const apply = () => {
      let changed = false;
      entries.forEach(entry => {
        const count = Number(entry?.metadata?.breakCount);
        if (!entry?.storyId || !Number.isSafeInteger(count) || count <= 1) return;
        breakDoc.items[entry.storyId] = { count, updatedAt: Date.now() };
        changed = true;
      });
      return changed ? queueSave() : Promise.resolve();
    };
    event.detail.tasks.push(loaded ? apply() : ready.then(apply));
  });

  function setCount(storyId, count) {
    const next = normalizedCount(count);
    if (next === 1) delete breakDoc.items[storyId];
    else breakDoc.items[storyId] = { count: next, updatedAt: Date.now() };
    queueSave();
    return next;
  }

  function setAfterCount(storyId, count) {
    const next = normalizeAfterBreakCount(count);
    if (next === 0) delete breakDoc.items[storyId];
    else breakDoc.items[storyId] = { afterCount: next, updatedAt: Date.now() };
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

  function decorateBreakRow(row) {
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

  function syncAfterBreakMarker(row, count) {
    const existing = row.nextElementSibling?.classList.contains('story-con-after-break-marker')
      ? row.nextElementSibling
      : null;
    if (count > 0) {
      const marker = existing || document.createElement('br');
      marker.className = 'story-con-after-break-marker';
      marker.setAttribute('aria-hidden', 'true');
      if (!existing) row.after(marker);
    } else {
      existing?.remove();
    }
  }

  function applyAfterBreakState(row, control, input, count) {
    input.value = String(count);
    row.dataset.afterBreakCount = String(count);
    control.classList.toggle('active', count > 0);
    syncAfterBreakMarker(row, count);
  }

  function decorateConRow(row) {
    const storyId = row.dataset.storyId;
    if (!storyId) return;

    let control = row.querySelector(':scope > .story-con-after-break-control');
    let input = control?.querySelector('input');
    if (!control) {
      control = document.createElement('label');
      control.className = 'story-con-after-break-control';
      control.dataset.tooltipTitle = '콘 뒤 줄바꿈';
      control.dataset.tooltipDescription = '콘과 콘, 콘과 다른 블록 사이의 줄바꿈을 넣을때 사용합니다. 기본값은 0이며 다른 숫자를 넣으면 그 값만큼 콘의 아래에 줄바꿈을 합니다.';

      const label = document.createElement('span');
      label.textContent = '콘뒤줄바꿈';
      input = document.createElement('input');
      input.type = 'number';
      input.className = 'story-con-after-break-input';
      input.min = '0';
      input.step = '1';
      input.inputMode = 'numeric';
      input.setAttribute('aria-label', '콘 뒤 줄바꿈 수');
      input.draggable = false;
      control.append(label, input);
      row.append(control);

      control.addEventListener('click', event => event.stopPropagation());
      control.addEventListener('pointerdown', event => event.stopPropagation());
      control.addEventListener('dragstart', event => {
        event.preventDefault();
        event.stopPropagation();
      });
      input.addEventListener('input', () => {
        if (input.value === '') return;
        const value = Number(input.value);
        if (!Number.isInteger(value) || value < 0) return;
        applyAfterBreakState(row, control, input, setAfterCount(storyId, value));
      });
      input.addEventListener('change', () => {
        applyAfterBreakState(row, control, input, setAfterCount(storyId, input.value));
      });
    }

    applyAfterBreakState(row, control, input, afterCountFor(storyId));
  }

  function decorateStory() {
    if (!loaded) return;
    storyList.querySelectorAll(':scope > .story-con-after-break-marker').forEach(marker => marker.remove());
    storyList.querySelectorAll(':scope > .story-item').forEach(row => {
      if (row.classList.contains('story-con')) decorateConRow(row);
      else decorateBreakRow(row);
    });
  }

  document.addEventListener('hhjcon:story-rendered', decorateStory);

  getOne('documents', DOC_ID).then(saved => {
    if (saved?.items && typeof saved.items === 'object') breakDoc = saved;
    loaded = true;
    resolveReady();
    decorateStory();
  }).catch(() => {
    loaded = true;
    resolveReady();
    decorateStory();
  });
}
