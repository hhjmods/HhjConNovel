import { applyStoryDropTransfer } from './app.js?v=20260906-17';
import { storyAreaDropEffect } from './story-dnd-utils.js?v=20260906-2';

const storyList = document.getElementById('storyList');

if (storyList) {
  let activeConDrag = false;
  let movingStoryIds = new Set();
  let targetStoryId = null;

  const hitZone = document.createElement('div');
  hitZone.setAttribute('aria-hidden', 'true');
  Object.assign(hitZone.style, {
    position: 'fixed',
    display: 'none',
    zIndex: '9998',
    background: 'transparent',
    pointerEvents: 'auto'
  });
  document.body.append(hitZone);

  function allowDrop(event) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = storyAreaDropEffect(event.dataTransfer, movingStoryIds.size > 0);
    }
  }

  function isMoving(row) {
    return Boolean(row?.dataset?.storyId && movingStoryIds.has(row.dataset.storyId));
  }

  function nextStoryItem(row) {
    let current = row?.nextElementSibling || null;
    while (current) {
      if (current.classList.contains('story-item') && !isMoving(current)) return current;
      current = current.nextElementSibling;
    }
    return null;
  }

  function hideZone() {
    hitZone.style.display = 'none';
    targetStoryId = null;
  }

  function findTrailingRunEnd(clientX, clientY) {
    const listRect = storyList.getBoundingClientRect();
    if (clientX < listRect.left || clientX > listRect.right || clientY < listRect.top || clientY > listRect.bottom) return null;

    const cons = [...storyList.querySelectorAll(':scope > .story-con')]
      .filter(row => !isMoving(row))
      .map(row => ({ row, rect: row.getBoundingClientRect() }))
      .filter(({ rect }) => clientY >= rect.top - 6 && clientY <= rect.bottom + 6);

    if (!cons.length) return null;

    let last = cons[0];
    for (const item of cons) {
      if (item.rect.right > last.rect.right) last = item;
    }

    if (clientX < last.rect.right - 10) return null;

    const next = nextStoryItem(last.row);
    return { last, next, listRect };
  }

  function showZoneFor(point) {
    const left = Math.max(point.listRect.left, point.last.rect.right - 10);
    const right = Math.max(left + 12, point.listRect.right - 10);
    const top = Math.max(point.listRect.top, point.last.rect.top - 4);
    const bottom = Math.min(point.listRect.bottom, point.last.rect.bottom + 4);

    hitZone.style.left = `${left}px`;
    hitZone.style.top = `${top}px`;
    hitZone.style.width = `${Math.max(12, right - left)}px`;
    hitZone.style.height = `${Math.max(12, bottom - top)}px`;
    hitZone.style.display = 'block';
    targetStoryId = point.next?.dataset?.storyId || null;
  }

  document.addEventListener('dragstart', event => {
    const storyCon = event.target?.closest?.('.story-con');
    const libraryCon = event.target?.closest?.('.con-card');
    if (!storyCon && !libraryCon) return;

    activeConDrag = true;
    movingStoryIds = new Set();

    if (storyCon?.dataset.storyId) {
      if (storyCon.classList.contains('selected')) {
        storyList.querySelectorAll(':scope > .story-con.selected[data-story-id]').forEach(row => movingStoryIds.add(row.dataset.storyId));
      }
      if (!movingStoryIds.size) movingStoryIds.add(storyCon.dataset.storyId);
    }
  }, true);

  document.addEventListener('dragover', event => {
    if (!activeConDrag) return;
    const point = findTrailingRunEnd(event.clientX, event.clientY);
    if (!point) {
      if (event.target !== hitZone) hideZone();
      return;
    }

    showZoneFor(point);
    allowDrop(event);
  }, true);

  hitZone.addEventListener('dragenter', event => {
    if (!activeConDrag) return;
    allowDrop(event);
  });

  hitZone.addEventListener('dragover', event => {
    if (!activeConDrag) return;
    allowDrop(event);
  });

  hitZone.addEventListener('drop', event => {
    if (!activeConDrag) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const transfer = event.dataTransfer;
    const beforeId = targetStoryId;
    activeConDrag = false;
    movingStoryIds = new Set();
    hideZone();

    void applyStoryDropTransfer(transfer, beforeId).catch(error => {
      console.error('콘 줄 끝 drop 적용 중 오류가 발생했습니다.', error);
    });
  });

  document.addEventListener('dragend', () => {
    activeConDrag = false;
    movingStoryIds = new Set();
    hideZone();
  }, true);
}
