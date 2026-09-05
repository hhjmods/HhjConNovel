const storyList = document.getElementById('storyList');

if (storyList) {
  const EDGE_SIZE = 72;
  const OUTSIDE_TOLERANCE = 28;
  const MAX_SPEED = 20;

  let dragging = false;
  let pointerX = null;
  let pointerY = null;
  let frameId = null;

  function isSupportedDrag(target) {
    return Boolean(target?.closest?.('.story-item, .con-card'));
  }

  function pointerWithinScrollLane(rect) {
    if (pointerX == null || pointerY == null) return false;
    return pointerX >= rect.left - OUTSIDE_TOLERANCE &&
      pointerX <= rect.right + OUTSIDE_TOLERANCE &&
      pointerY >= rect.top - OUTSIDE_TOLERANCE &&
      pointerY <= rect.bottom + OUTSIDE_TOLERANCE;
  }

  function edgeScrollDelta(rect) {
    if (!pointerWithinScrollLane(rect)) return 0;

    const topEdge = rect.top + EDGE_SIZE;
    const bottomEdge = rect.bottom - EDGE_SIZE;

    if (pointerY < topEdge) {
      const ratio = Math.min(1, (topEdge - pointerY) / (EDGE_SIZE + OUTSIDE_TOLERANCE));
      return -Math.max(2, Math.round(MAX_SPEED * ratio));
    }

    if (pointerY > bottomEdge) {
      const ratio = Math.min(1, (pointerY - bottomEdge) / (EDGE_SIZE + OUTSIDE_TOLERANCE));
      return Math.max(2, Math.round(MAX_SPEED * ratio));
    }

    return 0;
  }

  function autoScrollFrame() {
    frameId = null;
    if (!dragging) return;

    if (storyList.scrollHeight > storyList.clientHeight) {
      const delta = edgeScrollDelta(storyList.getBoundingClientRect());
      if (delta) storyList.scrollTop += delta;
    }

    frameId = requestAnimationFrame(autoScrollFrame);
  }

  function startAutoScroll() {
    if (frameId == null) frameId = requestAnimationFrame(autoScrollFrame);
  }

  function finishDrag() {
    dragging = false;
    pointerX = null;
    pointerY = null;
    if (frameId != null) cancelAnimationFrame(frameId);
    frameId = null;
  }

  document.addEventListener('dragstart', event => {
    if (!isSupportedDrag(event.target)) return;
    dragging = true;
    pointerX = event.clientX;
    pointerY = event.clientY;
    startAutoScroll();
  }, true);

  document.addEventListener('dragover', event => {
    if (!dragging) return;
    pointerX = event.clientX;
    pointerY = event.clientY;
  }, true);

  document.addEventListener('wheel', event => {
    if (!dragging) return;
    const rect = storyList.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return;

    const scale = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 :
      event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? storyList.clientHeight : 1;
    const delta = event.deltaY * scale;
    if (!delta) return;

    const before = storyList.scrollTop;
    storyList.scrollTop += delta;
    if (storyList.scrollTop !== before) event.preventDefault();
  }, { capture: true, passive: false });

  document.addEventListener('dragend', finishDrag, true);
  document.addEventListener('drop', () => queueMicrotask(finishDrag), true);
}
