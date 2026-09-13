export function createCollectionEditControls(container) {
  const root = document.createElement('div');
  root.className = 'collection-edit-controls';
  const editButton = document.createElement('button');
  editButton.className = 'small';
  editButton.textContent = '콘 편집';
  const deleteButton = document.createElement('button');
  deleteButton.className = 'small danger';
  deleteButton.textContent = '삭제';
  deleteButton.title = '선택한 콘을 이 콘묶음에서 삭제';
  const saveButton = document.createElement('button');
  saveButton.className = 'small primary';
  saveButton.textContent = '저장';
  const cancelButton = document.createElement('button');
  cancelButton.className = 'small';
  cancelButton.textContent = '취소';
  root.append(editButton, deleteButton, saveButton, cancelButton);
  container.prepend(root);

  return {
    editButton,
    deleteButton,
    saveButton,
    cancelButton,
    render({ isCollection, editing, hasItems }) {
      root.classList.toggle('hidden', !isCollection || (!editing && !hasItems));
      editButton.classList.toggle('hidden', !hasItems || editing);
      deleteButton.classList.toggle('hidden', !isCollection || !editing);
      saveButton.classList.toggle('hidden', !isCollection || !editing);
      cancelButton.classList.toggle('hidden', !isCollection || !editing);
    }
  };
}
