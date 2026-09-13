import { edgeScrollDelta } from './story/story-dnd-geometry.js?v=20260913-1';

const storyList = document.getElementById('storyList');

if (storyList) {
  let dragging = false;
  let pointerX = null;
  let pointerY = null;
  let frameId = null;

  function isSupportedDrag(target) {
    return Boolean(target?.closest?.('.story-item, .con-card'));
  }

  function autoScrollFrame() {
    frameId = null;
    if (!dragging) return;

    if (storyList.scrollHeight > storyList.clientHeight) {
      const delta = edgeScrollDelta(pointerX, pointerY, storyList.getBoundingClientRect());
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

  document.addEventListener('dragend', finishDrag, true);
  document.addEventListener('drop', () => queueMicrotask(finishDrag), true);
}
