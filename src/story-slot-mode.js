import { CON_IDS_MIME, STORY_IDS_MIME, forwardDrop, transferHasType } from './story-dnd-utils.js?v=20260906-2';

const storyList = document.getElementById('storyList');

if (storyList) {
  let activeDragKind = null;
  let sourceRow = null;
  let movingStoryIds = new Set();
  let guide = null;
  let activeBoundary = null;

  function ensureGuide() {
    if (guide?.isConnected) return guide;
    guide = document.createElement('div');
    guide.className = 'story-drop-guide hidden';
    document.body.append(guide);
    return guide;
  }

  function isMovingRow(row) {
    return Boolean(row?.dataset?.storyId && movingStoryIds.has(row.dataset.storyId));
  }

  function previousStoryItem(node) {
    let current = node?.previousElementSibling || null;
    while (current) {
      if (current.classList.contains('story-item') && !isMovingRow(current)) return current;
      current = current.previousElementSibling;
    }
    return null;
  }

  function nextStoryItem(node) {
    let current = node?.nextElementSibling || null;
    while (current) {
      if (current.classList.contains('story-item') && !isMovingRow(current)) return current;
      current = current.nextElementSibling;
    }
    return null;
  }

  function dragKindFromTarget(target) {
    const storyItem = target?.closest?.('.story-item');
    if (storyItem?.classList.contains('story-con')) return 'con';
    if (storyItem?.classList.contains('story-text') || storyItem?.classList.contains('story-image-placeholder')) return 'block';
    if (target?.closest?.('.con-card')) return 'con';
    return null;
  }

  function captureMovingRows(kind, row) {
    movingStoryIds = new Set();
    if (!row?.dataset.storyId) return;

    if (kind === 'con' && row.classList.contains('selected')) {
      storyList.querySelectorAll(':scope > .story-con.selected[data-story-id]').forEach(item => {
        movingStoryIds.add(item.dataset.storyId);
      });
      if (movingStoryIds.size) return;
    }

    movingStoryIds.add(row.dataset.storyId);
  }

  function logicalRows() {
    return [...storyList.querySelectorAll(':scope > .story-item')].filter(row => !isMovingRow(row));
  }

  function hideGuide() {
    activeBoundary = null;
    if (!guide) return;
    guide.classList.add('hidden');
    guide.classList.remove('horizontal', 'vertical');
  }

  function clearLegacyHighlights() {
    storyList.querySelectorAll(':scope > .story-item.story-drag-target').forEach(row => row.classList.remove('story-drag-target'));
    storyList.querySelectorAll(':scope > .story-insert-slot.drop-target').forEach(slot => slot.classList.remove('drop-target'));
    storyList.querySelector(':scope > .story-tail-drop.drop-target')?.classList.remove('drop-target');
  }

  function showHorizontal(top) {
    const marker = ensureGuide();
    const rect = storyList.getBoundingClientRect();
    marker.classList.remove('hidden', 'vertical');
    marker.classList.add('horizontal');
    marker.style.left = `${rect.left + 8}px`;
    marker.style.top = `${top - 3}px`;
    marker.style.width = `${Math.max(0, rect.width - 16)}px`;
    marker.style.height = '6px';
  }

  function showVerticalBefore(row) {
    const marker = ensureGuide();
    const rect = row.getBoundingClientRect();
    marker.classList.remove('hidden', 'horizontal');
    marker.classList.add('vertical');
    marker.style.left = `${rect.left - 4}px`;
    marker.style.top = `${rect.top}px`;
    marker.style.width = '8px';
    marker.style.height = `${rect.height}px`;
  }

  function showVerticalAfter(row) {
    const marker = ensureGuide();
    const rect = row.getBoundingClientRect();
    marker.classList.remove('hidden', 'horizontal');
    marker.classList.add('vertical');
    marker.style.left = `${rect.right - 4}px`;
    marker.style.top = `${rect.top}px`;
    marker.style.width = '8px';
    marker.style.height = `${rect.height}px`;
  }

  function nearestRow(clientX, clientY) {
    const rows = logicalRows();
    if (!rows.length) return null;
    let best = null;
    let bestDistance = Infinity;
    for (const row of rows) {
      const rect = row.getBoundingClientRect();
      const dx = clientX < rect.left ? rect.left - clientX : clientX > rect.right ? clientX - rect.right : 0;
      const dy = clientY < rect.top ? rect.top - clientY : clientY > rect.bottom ? clientY - rect.bottom : 0;
      const distance = dx * dx + dy * dy;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = row;
      }
    }
    return best;
  }

  function isLowerTailPoint(clientY) {
    const last = logicalRows().at(-1);
    if (!last) return true;
    return clientY >= last.getBoundingClientRect().bottom;
  }

  function showBoundary(previous, next) {
    activeBoundary = { previous, next };
    const previousIsCon = Boolean(previous?.classList.contains('story-con'));
    const nextIsCon = Boolean(next?.classList.contains('story-con'));

    if (previousIsCon && nextIsCon) {
      showVerticalBefore(next);
      return;
    }

    if (activeDragKind === 'con' && previousIsCon) {
      showVerticalAfter(previous);
      return;
    }

    if (activeDragKind === 'con' && nextIsCon) {
      showVerticalBefore(next);
      return;
    }

    if (next) {
      showHorizontal(next.getBoundingClientRect().top);
      return;
    }
    if (previous) {
      showHorizontal(previous.getBoundingClientRect().bottom);
      return;
    }
    hideGuide();
  }

  function showBlankPointBoundary(event) {
    if (isLowerTailPoint(event.clientY)) {
      const rows = logicalRows();
      showBoundary(rows.at(-1) || null, null);
      return;
    }

    if (activeDragKind === 'con') {
      const sameLineCons = [...storyList.querySelectorAll(':scope > .story-con')]
        .filter(row => !isMovingRow(row))
        .filter(row => {
          const rect = row.getBoundingClientRect();
          return event.clientY >= rect.top - 4 && event.clientY <= rect.bottom + 4;
        });

      if (sameLineCons.length) {
        let nearest = sameLineCons[0];
        let distance = Infinity;
        for (const row of sameLineCons) {
          const rect = row.getBoundingClientRect();
          const center = rect.left + rect.width / 2;
          const current = Math.abs(event.clientX - center);
          if (current < distance) {
            distance = current;
            nearest = row;
          }
        }
        const rect = nearest.getBoundingClientRect();
        if (event.clientX >= rect.left + rect.width / 2) {
          showBoundary(nearest, nextStoryItem(nearest));
        } else {
          showBoundary(previousStoryItem(nearest), nearest);
        }
        return;
      }
    }

    const row = nearestRow(event.clientX, event.clientY);
    if (!row) {
      hideGuide();
      return;
    }
    showBoundary(previousStoryItem(row), row);
  }

  function showGuideForEvent(event) {
    if (activeDragKind !== 'block' && activeDragKind !== 'con') return;

    const slot = event.target.closest('.story-insert-slot');
    if (slot) {
      showBoundary(previousStoryItem(slot), nextStoryItem(slot));
      return;
    }

    const tail = event.target.closest('.story-tail-drop');
    if (tail) {
      const rows = logicalRows();
      showBoundary(rows.at(-1) || null, null);
      return;
    }

    let row = event.target.closest('.story-item');
    if (isMovingRow(row)) {
      showBoundary(previousStoryItem(row), nextStoryItem(row));
      return;
    }

    if (!row && event.target === storyList) {
      showBlankPointBoundary(event);
      return;
    }

    if (!row) row = nearestRow(event.clientX, event.clientY);
    if (!row) {
      hideGuide();
      return;
    }

    showBoundary(previousStoryItem(row), row);
  }

  document.addEventListener('dragstart', event => {
    const kind = dragKindFromTarget(event.target);
    if (!kind) return;
    activeDragKind = kind;
    sourceRow = event.target?.closest?.('.story-item') || null;
    captureMovingRows(kind, sourceRow);
    storyList.classList.add('story-guide-dragging');
    if (kind === 'con') storyList.classList.add('story-con-dragging');
    if (kind === 'block') {
      requestAnimationFrame(() => {
        if (activeDragKind === 'block') storyList.classList.add('story-block-dragging');
      });
    }
  }, true);

  storyList.addEventListener('dragover', event => {
    if (activeDragKind !== 'block' && activeDragKind !== 'con') return;
    if (activeDragKind === 'block') storyList.classList.add('story-block-dragging');
    if (activeDragKind === 'con') storyList.classList.add('story-con-dragging');
    showGuideForEvent(event);
  }, true);

  storyList.addEventListener('dragover', () => {
    if (activeDragKind !== 'block' && activeDragKind !== 'con') return;
    clearLegacyHighlights();
  });

  storyList.addEventListener('drop', event => {
    if (!activeBoundary || (activeDragKind !== 'block' && activeDragKind !== 'con')) return;
    if (!transferHasType(event.dataTransfer, STORY_IDS_MIME) && !transferHasType(event.dataTransfer, CON_IDS_MIME)) return;

    const directRow = event.target.closest?.('.story-item');
    if (isMovingRow(directRow)) return;

    const target = activeBoundary.next || storyList.querySelector(':scope > .story-tail-drop');
    if (!target) return;
    if (event.target === target || target.contains(event.target)) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    forwardDrop(target, event.dataTransfer);
  }, true);

  function finishDrag() {
    hideGuide();
    clearLegacyHighlights();
    storyList.classList.remove('story-guide-dragging', 'story-block-dragging', 'story-con-dragging');
    activeDragKind = null;
    sourceRow = null;
    movingStoryIds = new Set();
  }

  document.addEventListener('dragend', finishDrag, true);
  document.addEventListener('drop', () => queueMicrotask(finishDrag), true);
}
