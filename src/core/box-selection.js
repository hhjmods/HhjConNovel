export function planBoxSelection(baseIds, hitIds, toggle = false) {
  const selected = toggle ? new Set(baseIds) : new Set();
  for (const id of hitIds) {
    if (toggle && selected.has(id)) selected.delete(id);
    else selected.add(id);
  }
  return [...selected];
}

export function isScrollbarPointer(container, clientX, clientY) {
  const rect = container.getBoundingClientRect();
  return clientX >= rect.left + container.clientLeft + container.clientWidth
    || clientY >= rect.top + container.clientTop + container.clientHeight;
}

export function boxSelectionRect(startX, startY, clientX, clientY, scrollX = 0, scrollY = 0) {
  const contentStartX = startX - scrollX;
  const contentStartY = startY - scrollY;
  return {
    left: Math.min(contentStartX, clientX),
    top: Math.min(contentStartY, clientY),
    right: Math.max(contentStartX, clientX),
    bottom: Math.max(contentStartY, clientY)
  };
}

export function clipBoxSelectionRect(rect, bounds) {
  const left = Math.max(bounds.left, Math.min(rect.left, bounds.right));
  const top = Math.max(bounds.top, Math.min(rect.top, bounds.bottom));
  return {
    left,
    top,
    right: Math.max(left, Math.min(rect.right, bounds.right)),
    bottom: Math.max(top, Math.min(rect.bottom, bounds.bottom))
  };
}

export function installBoxSelection(container, { itemSelector, idKey, getSelectedIds, setSelection }) {
  const selectionBox = document.createElement('div');
  selectionBox.className = 'story-selection-box hidden';
  document.body.append(selectionBox);
  let drag = null;

  container.addEventListener('pointerdown', event => {
    if (event.button !== 0
      || event.target.closest('.story-item, button, input, textarea')
      || isScrollbarPointer(container, event.clientX, event.clientY)) return;
    const toggle = event.ctrlKey || event.metaKey;
    drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      clientX: event.clientX,
      clientY: event.clientY,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop,
      base: toggle ? [...getSelectedIds()] : [],
      toggle
    };
    if (!toggle) setSelection([]);
    selectionBox.style.left = `${event.clientX}px`;
    selectionBox.style.top = `${event.clientY}px`;
    selectionBox.style.width = '0';
    selectionBox.style.height = '0';
    container.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  function updateSelection(clientX, clientY) {
    if (!drag) return;
    drag.clientX = clientX;
    drag.clientY = clientY;
    selectionBox.classList.remove('hidden');
    const rect = boxSelectionRect(
      drag.startX,
      drag.startY,
      clientX,
      clientY,
      container.scrollLeft - drag.scrollLeft,
      container.scrollTop - drag.scrollTop
    );
    const containerRect = container.getBoundingClientRect();
    const visibleRect = clipBoxSelectionRect(rect, {
      left: containerRect.left + container.clientLeft,
      top: containerRect.top + container.clientTop,
      right: containerRect.left + container.clientLeft + container.clientWidth,
      bottom: containerRect.top + container.clientTop + container.clientHeight
    });
    selectionBox.style.left = `${visibleRect.left}px`;
    selectionBox.style.top = `${visibleRect.top}px`;
    selectionBox.style.width = `${visibleRect.right - visibleRect.left}px`;
    selectionBox.style.height = `${visibleRect.bottom - visibleRect.top}px`;

    const hitIds = [...container.querySelectorAll(itemSelector)].filter(item => {
      const itemRect = item.getBoundingClientRect();
      return itemRect.left < rect.right && itemRect.right > rect.left
        && itemRect.top < rect.bottom && itemRect.bottom > rect.top;
    }).map(item => item.dataset[idKey]);
    const next = planBoxSelection(drag.base, hitIds, drag.toggle);
    setSelection(next, next[0] || null);
  }

  container.addEventListener('pointermove', event => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    updateSelection(event.clientX, event.clientY);
  });

  container.addEventListener('scroll', () => {
    if (drag) updateSelection(drag.clientX, drag.clientY);
  });

  const finish = event => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (container.hasPointerCapture(event.pointerId)) container.releasePointerCapture(event.pointerId);
    drag = null;
    selectionBox.classList.add('hidden');
  };

  container.addEventListener('pointerup', finish);
  container.addEventListener('pointercancel', finish);
}
