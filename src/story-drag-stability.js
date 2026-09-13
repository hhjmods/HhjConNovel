const storyList = document.getElementById('storyList');

if (storyList) {
  function clearDragDecorations() {
    storyList.classList.remove('story-block-dragging');
    storyList.querySelectorAll('.dragging').forEach(node => node.classList.remove('dragging'));
    storyList.querySelectorAll('.story-drag-target, .drop-target').forEach(node => {
      node.classList.remove('story-drag-target', 'drop-target');
    });
  }

  document.addEventListener('dragend', clearDragDecorations, true);
}
