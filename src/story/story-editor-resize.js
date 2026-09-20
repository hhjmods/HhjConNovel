import { STORY_BLOCKS_PASTED_EVENT } from './story-block-clipboard.js?v=20260921-1';

const STORAGE_KEY = 'hhjcon-rich-text-heights-v1';
const RICH_EDITORS_RENDERED_EVENT = 'hhjcon:rich-editors-rendered';
const storyList = document.getElementById('storyList');

if (storyList && 'ResizeObserver' in window) {
  let heights = loadHeights();
  let saveTimer = null;
  const resizeObservers = new Map();

  function loadHeights() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  function clampHeight(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    return Math.min(4000, Math.max(72, Math.round(number)));
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveHeights, 120);
  }

  function saveHeights() {
    clearTimeout(saveTimer);
    saveTimer = null;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(heights)); } catch { /* 현재 탭 높이는 유지한다. */ }
  }

  document.addEventListener(STORY_BLOCKS_PASTED_EVENT, event => {
    let changed = false;
    (event.detail?.entries || []).forEach(entry => {
      const height = clampHeight(entry?.metadata?.height);
      if (!entry?.storyId || !height) return;
      heights[entry.storyId] = height;
      changed = true;
    });
    if (changed) saveHeights();
  });

  function enhanceEditor(editor) {
    if (!(editor instanceof HTMLElement) || editor.dataset.resizeReady === '1') return;
    const row = editor.closest('.story-item[data-story-id]');
    const storyId = row?.dataset.storyId;
    if (!storyId) return;

    editor.dataset.resizeReady = '1';
    editor.classList.add('rich-text-user-resizable');

    const savedHeight = clampHeight(heights[storyId]);
    if (savedHeight) editor.style.height = `${savedHeight}px`;

    let lastHeight = Math.round(editor.getBoundingClientRect().height);
    const observer = new ResizeObserver(() => {
      const height = clampHeight(editor.getBoundingClientRect().height);
      if (!height || Math.abs(height - lastHeight) < 1) return;
      lastHeight = height;
      heights[storyId] = height;
      scheduleSave();
    });
    observer.observe(editor);
    resizeObservers.set(editor, observer);
  }

  function refreshEditors() {
    resizeObservers.forEach((observer, editor) => {
      if (editor.isConnected) return;
      observer.disconnect();
      resizeObservers.delete(editor);
    });
    storyList.querySelectorAll('.rich-text-editor').forEach(enhanceEditor);
  }

  document.addEventListener('hhjcon:story-rendered', refreshEditors);
  storyList.addEventListener(RICH_EDITORS_RENDERED_EVENT, refreshEditors);
  window.addEventListener('pagehide', () => {
    saveHeights();
  });

  refreshEditors();
}
