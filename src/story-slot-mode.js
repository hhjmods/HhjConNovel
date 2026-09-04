const storyList = document.getElementById('storyList');

if (storyList) {
  let activeDragKind = null;
  let sourceRow = null;
  let guide = null;

  function ensureGuide() {
    if (guide?.isConnected) return guide;
    guide = document.createElement('div');
    guide.className = 'story-drop-guide hidden';
    document.body.append(guide);
    return guide;
  }

  function previousStoryItem(row) {
    let node = row?.previousElementSibling || null;
    while (node && !node.classList.contains('story-item')) node = node.previousElementSibling;
    return node;
  }

  function dragKindFromTarget(target) {
    const storyItem = target?.closest?.('.story-item');
    if (storyItem?.classList.contains('story-con')) return 'con';
    if (storyItem?.classList.contains('story-text') || storyItem?.classList.contains('story-image-placeholder')) return 'block';
    if (target?.closest?.('.con-card')) return 'con';
    return null;
  }

  function hideGuide() {
    if (!guide) return;
    guide.classList.add('hidden');
    guide.classList.remove('horizontal', 'vertical');
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

  function showVertical(row) {
    const marker = ensureGuide();
    const rect = row.getBoundingClientRect();
    marker.classList.remove('hidden', 'horizontal');
    marker.classList.add('vertical');
    marker.style.left = `${rect.left - 4}px`;
    marker.style.top = `${rect.top}px`;
    marker.style.width = '8px';
    marker.style.height = `${rect.height}px`;
  }

  function nearestRow(clientX, clientY) {
    const rows = [...storyList.querySelectorAll(':scope > .story-item')].filter(row => row !== sourceRow);
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

  function showGuideForEvent(event) {
    if (activeDragKind !== 'block') return;

    const tail = event.target.closest('.story-tail-drop');
    if (tail) {
      showHorizontal(tail.getBoundingClientRect().top);
      return;
    }

    let row = event.target.closest('.story-item');
    if (row === sourceRow) {
      showHorizontal(sourceRow.getBoundingClientRect().top);
      return;
    }
    if (!row) row = nearestRow(event.clientX, event.clientY);
    if (!row || row === sourceRow) {
      hideGuide();
      return;
    }

    const previous = previousStoryItem(row);
    if (previous?.classList.contains('story-con') && row.classList.contains('story-con')) {
      showVertical(row);
    } else {
      showHorizontal(row.getBoundingClientRect().top);
    }
  }

  document.addEventListener('dragstart', event => {
    const kind = dragKindFromTarget(event.target);
    if (!kind) return;
    activeDragKind = kind;
    sourceRow = event.target?.closest?.('.story-item') || null;
    if (kind === 'block') {
      requestAnimationFrame(() => {
        if (activeDragKind === 'block') storyList.classList.add('story-block-dragging');
      });
    }
  }, true);

  storyList.addEventListener('dragover', event => {
    if (activeDragKind !== 'block') return;
    storyList.classList.add('story-block-dragging');
    showGuideForEvent(event);
  }, true);

  function finishDrag() {
    hideGuide();
    storyList.classList.remove('story-block-dragging');
    activeDragKind = null;
    sourceRow = null;
  }

  document.addEventListener('dragend', finishDrag, true);
  document.addEventListener('drop', finishDrag, true);
}
