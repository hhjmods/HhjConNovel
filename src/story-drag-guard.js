import { writeStoryTransfer } from './story-dnd-utils.js?v=20260906-2';

const storyList = document.getElementById('storyList');
const storyDropZone = document.getElementById('storyDropZone');
let markedTarget = null;

function clearMarkedTarget() {
  markedTarget?.classList.remove('story-drag-target', 'drop-target');
  markedTarget = null;
}

storyList?.addEventListener('dragstart', event => {
  const row = event.target.closest('.story-con');
  if (!row || !event.dataTransfer) return;
  const selectedRows = [...storyList.querySelectorAll('.story-con.selected')];
  const ids = row.classList.contains('selected')
    ? selectedRows.map(item => item.dataset.storyId).filter(Boolean)
    : [row.dataset.storyId].filter(Boolean);
  if (!ids.length) return;
  if (!row.classList.contains('selected')) {
    selectedRows.forEach(item => item.classList.remove('selected'));
    row.classList.add('selected');
  }
  writeStoryTransfer(event.dataTransfer, ids);
  event.stopPropagation();
}, true);

storyList?.addEventListener('dragover', event => {
  event.preventDefault();
  const target = event.target.closest('.story-item, .story-tail-drop');
  if (target !== markedTarget) {
    clearMarkedTarget();
    markedTarget = target;
    if (target) target.classList.add(target.classList.contains('story-tail-drop') ? 'drop-target' : 'story-drag-target');
  }
}, true);

storyList?.addEventListener('drop', () => setTimeout(clearMarkedTarget, 0), true);
storyList?.addEventListener('dragend', clearMarkedTarget, true);
storyDropZone?.addEventListener('dragover', event => event.preventDefault(), true);
