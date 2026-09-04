const storyList = document.getElementById('storyList');

if (storyList) {
  let activeDragKind = null;
  let sourceRow = null;
  let proxySlot = null;

  function previousStoryItem(slot) {
    let node = slot.previousElementSibling;
    while (node && !node.classList.contains('story-item')) node = node.previousElementSibling;
    return node;
  }

  function nextStoryItem(slot) {
    let node = slot.nextElementSibling;
    while (node && !node.classList.contains('story-item')) node = node.nextElementSibling;
    return node;
  }

  function setMode(slot, mode) {
    slot.classList.toggle('inline', mode === 'inline');
    slot.classList.toggle('block', mode === 'block');
  }

  function defaultMode(slot) {
    return previousStoryItem(slot)?.classList.contains('story-con') ? 'inline' : 'block';
  }

  function modeFor(slot, kind) {
    const previousIsCon = Boolean(previousStoryItem(slot)?.classList.contains('story-con'));
    const nextIsCon = Boolean(nextStoryItem(slot)?.classList.contains('story-con'));
    if (kind === 'block') return previousIsCon && nextIsCon ? 'inline' : 'block';
    return previousIsCon ? 'inline' : 'block';
  }

  function clearProxy() {
    if (!proxySlot) return;
    proxySlot.classList.remove('drop-target');
    setMode(proxySlot, defaultMode(proxySlot));
    proxySlot = null;
  }

  function precedingSlot(row) {
    let node = row?.previousElementSibling || null;
    while (node && !node.classList.contains('story-item')) {
      if (node.classList.contains('story-insert-slot')) return node;
      node = node.previousElementSibling;
    }
    return null;
  }

  function dragKindFromTarget(target) {
    const storyItem = target?.closest?.('.story-item');
    if (storyItem?.classList.contains('story-con')) return 'con';
    if (storyItem?.classList.contains('story-text')) return 'block';
    if (target?.closest?.('.con-card')) return 'con';
    return null;
  }

  document.addEventListener('dragstart', event => {
    const kind = dragKindFromTarget(event.target);
    if (!kind) return;
    activeDragKind = kind;
    sourceRow = event.target?.closest?.('.story-item') || null;
  }, true);

  storyList.addEventListener('dragover', event => {
    if (!activeDragKind) return;
    if (event.target.closest('.story-insert-slot')) {
      clearProxy();
      return;
    }

    const row = event.target.closest('.story-item');
    if (!row || row === sourceRow) {
      clearProxy();
      return;
    }

    const slot = precedingSlot(row);
    if (!slot) {
      clearProxy();
      return;
    }

    if (proxySlot !== slot) clearProxy();
    setMode(slot, modeFor(slot, activeDragKind));
    slot.classList.add('drop-target');
    proxySlot = slot;
  }, true);

  function finishDrag() {
    clearProxy();
    activeDragKind = null;
    sourceRow = null;
  }

  document.addEventListener('dragend', finishDrag, true);
  document.addEventListener('drop', finishDrag, true);
}
