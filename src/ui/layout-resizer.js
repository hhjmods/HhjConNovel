const STORAGE_KEY = 'hhjcon-workspace-split-ratio';
const DEFAULT_RATIO = 0.5;
const MIN_RATIO = 0.2;
const MAX_RATIO = 0.8;

const layout = document.querySelector('.layout');
const libraryPanel = document.querySelector('.library-panel');
const editorPanel = document.querySelector('.editor-panel');
const splitter = document.getElementById('workspaceSplitter');

if (layout && libraryPanel && editorPanel && splitter) {
  const storedRatio = localStorage.getItem(STORAGE_KEY);
  const parsedRatio = storedRatio == null || storedRatio.trim() === '' ? NaN : Number(storedRatio);
  let ratio = Number.isFinite(parsedRatio) ? parsedRatio : DEFAULT_RATIO;
  let dragging = false;

  const clampRatio = value => Math.min(MAX_RATIO, Math.max(MIN_RATIO, value));

  function applyRatio(value, persist = true) {
    ratio = clampRatio(value);
    layout.style.setProperty('--library-share', `${ratio}fr`);
    layout.style.setProperty('--editor-share', `${1 - ratio}fr`);
    splitter.setAttribute('aria-valuenow', String(Math.round(ratio * 100)));
    if (persist) localStorage.setItem(STORAGE_KEY, String(ratio));
  }

  function ratioFromPointer(clientX) {
    const libraryRect = libraryPanel.getBoundingClientRect();
    const editorRect = editorPanel.getBoundingClientRect();
    const splitterWidth = splitter.getBoundingClientRect().width;
    const availableWidth = Math.max(1, editorRect.right - libraryRect.left - splitterWidth);
    const libraryWidth = clientX - libraryRect.left - splitterWidth / 2;
    return libraryWidth / availableWidth;
  }

  applyRatio(ratio, false);

  splitter.addEventListener('pointerdown', event => {
    if (window.matchMedia('(max-width: 900px)').matches) return;
    dragging = true;
    splitter.setPointerCapture(event.pointerId);
    document.body.classList.add('workspace-resizing');
    applyRatio(ratioFromPointer(event.clientX));
  });

  splitter.addEventListener('pointermove', event => {
    if (!dragging) return;
    applyRatio(ratioFromPointer(event.clientX));
  });

  const stopDragging = event => {
    if (!dragging) return;
    dragging = false;
    if (splitter.hasPointerCapture(event.pointerId)) splitter.releasePointerCapture(event.pointerId);
    document.body.classList.remove('workspace-resizing');
  };

  splitter.addEventListener('pointerup', stopDragging);
  splitter.addEventListener('pointercancel', stopDragging);

  splitter.addEventListener('dblclick', () => applyRatio(DEFAULT_RATIO));

  splitter.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      applyRatio(ratio - 0.02);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      applyRatio(ratio + 0.02);
    } else if (event.key === 'Home') {
      event.preventDefault();
      applyRatio(DEFAULT_RATIO);
    }
  });
}
