const storyList = document.getElementById('storyList');

if (storyList) {
  let activeDragKind = null;

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

  function modeFor(slot, kind) {
    const previousIsCon = Boolean(previousStoryItem(slot)?.classList.contains('story-con'));
    const nextIsCon = Boolean(nextStoryItem(slot)?.classList.contains('story-con'));
    if (kind === 'block') return previousIsCon && nextIsCon ? 'inline' : 'block';
    return previousIsCon ? 'inline' : 'block';
  }

  function applyModes(kind = activeDragKind) {
    storyList.querySelectorAll(':scope > .story-insert-slot').forEach(slot => {
      setMode(slot, modeFor(slot, kind));
    });
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
    applyModes(kind);
  }, true);

  storyList.addEventListener('dragover', () => {
    if (activeDragKind) applyModes(activeDragKind);
  }, true);

  function finishDrag() {
    if (!activeDragKind) return;
    activeDragKind = null;
    setTimeout(() => applyModes(null), 0);
  }

  document.addEventListener('dragend', finishDrag, true);
  document.addEventListener('drop', finishDrag, true);
}
