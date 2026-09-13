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
    saveTimer = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(heights));
    }, 120);
  }

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
    clearTimeout(saveTimer);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(heights));
  });

  refreshEditors();
}
