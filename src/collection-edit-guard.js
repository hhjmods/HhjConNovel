const conGrid = document.getElementById('conGrid');
const toolbar = document.querySelector('.library-toolbar .toolbar-actions');

if (conGrid && toolbar) {
  function controls() {
    return toolbar.querySelector('.collection-edit-controls');
  }

  function editButton() {
    return [...(controls()?.querySelectorAll('button') || [])]
      .find(button => button.textContent.trim() === '순서 편집' || button.textContent.trim() === '콘 편집') || null;
  }

  function isEditing() {
    return conGrid.classList.contains('collection-order-editing');
  }

  function activeCollectionView() {
    return Boolean(document.querySelector('.library-view-tab.collection-tab.active'));
  }

  let deleteButton = null;

  function ensureControls() {
    const group = controls();
    if (!group) return;
    const edit = editButton();
    if (edit) edit.textContent = '콘 편집';
    if (!deleteButton) {
      deleteButton = document.createElement('button');
      deleteButton.className = 'small collection-edit-delete hidden';
      deleteButton.textContent = '삭제';
      deleteButton.title = '선택한 콘을 이 콘묶음에서 삭제';
      const save = [...group.querySelectorAll('button')].find(button => button.textContent.trim() === '저장');
      group.insertBefore(deleteButton, save || null);
      deleteButton.addEventListener('click', () => {
        if (!isEditing()) return;
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
      });
    }
    deleteButton.classList.toggle('hidden', !isEditing());
  }

  const observer = new MutationObserver(ensureControls);
  observer.observe(toolbar, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  observer.observe(conGrid, { attributes: true, attributeFilter: ['class'] });
  ensureControls();

  window.addEventListener('keydown', event => {
    if (event.key !== 'Delete') return;
    if (document.activeElement?.matches('textarea, input, [contenteditable="true"]')) return;
    if (document.querySelector('.story-con.selected')) return;
    if (!activeCollectionView()) return;
    if (isEditing()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
}
