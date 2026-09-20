import { applyStoryDropTransfer } from './app.js?v=20260921-1';
import { hasStoryAreaPayload, storyAreaDropEffect } from './story-dnd-utils.js?v=20260906-2';

const storyList = document.getElementById('storyList');

if (storyList) {
  function hasAcceptedPayload(dataTransfer) {
    return hasStoryAreaPayload(dataTransfer) || storyList.classList.contains('story-guide-dragging');
  }

  function acceptedDropEffect(dataTransfer) {
    return hasStoryAreaPayload(dataTransfer) ? storyAreaDropEffect(dataTransfer) : 'copy';
  }

  function tailDrop() {
    return storyList.querySelector(':scope > .story-tail-drop');
  }

  function ensureTailReady() {
    const tail = tailDrop();
    if (!tail) return null;
    if (tail.classList.contains('story-tail-hidden')) tail.classList.remove('story-tail-hidden');
    if (tail.getAttribute('aria-label') !== '원고 맨 뒤에 삽입') tail.setAttribute('aria-label', '원고 맨 뒤에 삽입');
    return tail;
  }

  function isLowerBlankPoint(clientY) {
    const rows = [...storyList.querySelectorAll(':scope > .story-item')];
    const last = rows.at(-1);
    if (!last) return true;
    return clientY >= last.getBoundingClientRect().bottom;
  }

  function isAcceptedBlankPoint(event) {
    return storyList.hasAttribute('data-story-drop-before-id') || isLowerBlankPoint(event.clientY);
  }

  storyList.addEventListener('dragover', event => {
    if (event.target !== storyList || !hasAcceptedPayload(event.dataTransfer) || !isAcceptedBlankPoint(event)) {
      storyList.classList.remove('story-tail-blank-hover');
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = acceptedDropEffect(event.dataTransfer);
    storyList.classList.toggle('story-tail-blank-hover', isLowerBlankPoint(event.clientY));
  });

  storyList.addEventListener('dragleave', event => {
    if (event.target !== storyList) return;
    storyList.classList.remove('story-tail-blank-hover');
  });

  storyList.addEventListener('drop', event => {
    if (event.target !== storyList || !hasAcceptedPayload(event.dataTransfer) || !isAcceptedBlankPoint(event)) return;
    event.preventDefault();
    event.stopPropagation();
    storyList.classList.remove('story-tail-blank-hover');

    void applyStoryDropTransfer(event.dataTransfer, null).catch(error => {
      console.error('원고 빈 경계 drop 적용 중 오류가 발생했습니다.', error);
    });
  });

  document.addEventListener('dragend', () => storyList.classList.remove('story-tail-blank-hover'), true);

  document.addEventListener('hhjcon:story-rendered', () => queueMicrotask(ensureTailReady));

  ensureTailReady();
}
