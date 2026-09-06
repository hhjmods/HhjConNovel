import { readTransferIds, STORY_IDS_MIME, writeStoryTransfer } from './story-dnd-utils.js?v=20260906-2';

const storyList = document.getElementById('storyList');

if (storyList) {
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

  storyList.addEventListener('dragstart', event => {
    const handle = event.target.closest?.('.story-drag-handle');
    const row = handle?.closest?.('.story-item');
    if (!handle || !row?.dataset.storyId || !event.dataTransfer) return;
    if (!row.classList.contains('story-text') && !row.classList.contains('story-break') && !row.classList.contains('story-image-placeholder')) return;

    writeStoryTransfer(event.dataTransfer, [row.dataset.storyId], { block: true, plainText: true });
    row.classList.add('dragging');
  }, true);

  storyList.addEventListener('drop', event => {
    const movingIds = readTransferIds(event.dataTransfer, STORY_IDS_MIME);
    if (!movingIds.length) return;
    const beforeId = beforeIdForTarget(event.target);
    if (!beforeId || !movingIds.includes(beforeId)) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'none';
    clearDragDecorations();
  }, true);

  document.addEventListener('dragend', clearDragDecorations, true);
}
