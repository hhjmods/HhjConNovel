const storyList = document.getElementById('storyList');

if (storyList) {
  let activeDropOperation = null;

  function operationFromDragSource(target) {
    if (target?.closest?.('.story-item')) return 'move';
    if (target?.closest?.('.con-card')) return 'copy';
    return null;
  }

  function readStoryIds(dataTransfer) {
    try {
      const raw = dataTransfer?.getData('application/x-hhjstory-ids');
      const ids = raw ? JSON.parse(raw) : [];
      return Array.isArray(ids) ? ids.filter(id => typeof id === 'string' && id) : [];
    } catch {
      return [];
    }
  }

  function beforeIdForTarget(target) {
    const row = target?.closest?.('.story-item');
    if (row?.dataset.storyId) return row.dataset.storyId;

    const slot = target?.closest?.('.story-insert-slot');
    if (!slot) return null;
    let next = slot.nextElementSibling;
    while (next && !next.classList.contains('story-item') && !next.classList.contains('story-tail-drop')) {
      next = next.nextElementSibling;
    }
    return next?.classList.contains('story-item') ? next.dataset.storyId || null : null;
  }

  function clearDragDecorations() {
    storyList.classList.remove('story-block-dragging');
    storyList.querySelectorAll('.dragging').forEach(node => node.classList.remove('dragging'));
    storyList.querySelectorAll('.story-drag-target, .drop-target').forEach(node => {
      node.classList.remove('story-drag-target', 'drop-target');
    });
  }

  document.addEventListener('dragstart', event => {
    activeDropOperation = operationFromDragSource(event.target);
  }, true);

  storyList.addEventListener('dragover', event => {
    if (!activeDropOperation || !event.dataTransfer) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = activeDropOperation;
  });

  storyList.addEventListener('dragstart', event => {
    const handle = event.target.closest?.('.story-drag-handle');
    const row = handle?.closest?.('.story-item');
    if (!handle || !row?.dataset.storyId || !event.dataTransfer) return;
    if (!row.classList.contains('story-text') && !row.classList.contains('story-break') && !row.classList.contains('story-image-placeholder')) return;

    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/x-hhjstory-ids', JSON.stringify([row.dataset.storyId]));
    event.dataTransfer.setData('application/x-hhjstory-block', '1');
    event.dataTransfer.setData('text/plain', row.dataset.storyId);
    row.classList.add('dragging');
  }, true);

  storyList.addEventListener('drop', event => {
    const movingIds = readStoryIds(event.dataTransfer);
    if (!movingIds.length) return;
    const beforeId = beforeIdForTarget(event.target);
    if (!beforeId || !movingIds.includes(beforeId)) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'none';
    clearDragDecorations();
  }, true);

  document.addEventListener('dragend', () => {
    activeDropOperation = null;
    clearDragDecorations();
  }, true);
  document.addEventListener('drop', () => queueMicrotask(() => {
    activeDropOperation = null;
  }), true);
}
