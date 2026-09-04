const storyList = document.getElementById('storyList');

if (storyList) {
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

  function hasStoryPayload(dataTransfer) {
    const types = dataTransfer?.types;
    return Boolean(
      types?.includes('application/x-hhjcon-ids') ||
      types?.includes('application/x-hhjstory-ids')
    );
  }

  function isStoryMove(dataTransfer) {
    return Boolean(dataTransfer?.types?.includes('application/x-hhjstory-ids'));
  }

  function isLowerBlankPoint(clientY) {
    const rows = [...storyList.querySelectorAll(':scope > .story-item')];
    const last = rows.at(-1);
    if (!last) return true;
    return clientY >= last.getBoundingClientRect().bottom;
  }

  function forwardDrop(target, dataTransfer) {
    if (!target || !dataTransfer) return;
    const forwarded = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(forwarded, 'dataTransfer', { value: dataTransfer });
    target.dispatchEvent(forwarded);
  }

  storyList.addEventListener('dragover', event => {
    if (event.target !== storyList || !hasStoryPayload(event.dataTransfer) || !isLowerBlankPoint(event.clientY)) {
      storyList.classList.remove('story-tail-blank-hover');
      return;
    }
    const tail = ensureTailReady();
    if (!tail) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = isStoryMove(event.dataTransfer) ? 'move' : 'copy';
    storyList.classList.add('story-tail-blank-hover');
  });

  storyList.addEventListener('dragleave', event => {
    if (event.target !== storyList) return;
    storyList.classList.remove('story-tail-blank-hover');
  });

  storyList.addEventListener('drop', event => {
    if (event.target !== storyList || !hasStoryPayload(event.dataTransfer) || !isLowerBlankPoint(event.clientY)) return;
    const tail = ensureTailReady();
    if (!tail) return;
    event.preventDefault();
    event.stopPropagation();
    storyList.classList.remove('story-tail-blank-hover');
    forwardDrop(tail, event.dataTransfer);
  });

  document.addEventListener('dragend', () => storyList.classList.remove('story-tail-blank-hover'), true);

  const observer = new MutationObserver(() => queueMicrotask(ensureTailReady));
  observer.observe(storyList, { childList: true });

  ensureTailReady();
}
