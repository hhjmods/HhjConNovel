const storyList = document.getElementById('storyList');

if (storyList) {
  let armedButton = null;
  let armedByDeleteKey = false;
  let armedRows = [];

  function isDialogueRow(row) {
    return row?.classList.contains('story-text') && !row.classList.contains('story-break');
  }

  function selectedDialogueRows() {
    return [...storyList.querySelectorAll(':scope > .story-item.selected')].filter(isDialogueRow);
  }

  function deletionContext(target) {
    const button = target.closest('button');
    if (!button || !storyList.contains(button)) return null;
    const tools = button.closest('.story-tools');
    const row = button.closest('.story-item');
    if (!tools || !row) return null;
    if (button.textContent.trim() !== '×') return null;
    const rows = row.classList.contains('selected')
      ? [...storyList.querySelectorAll(':scope > .story-item.selected')]
      : [row];
    const dialogueRows = rows.filter(isDialogueRow);
    return dialogueRows.length ? { button, dialogueRows } : null;
  }

  function disarm() {
    armedButton?.classList.remove('text-delete-armed');
    armedRows.forEach(row => row.classList.remove('text-delete-confirming'));
    armedButton = null;
    armedByDeleteKey = false;
    armedRows = [];
  }

  function arm(dialogueRows, button = null, byDeleteKey = false) {
    disarm();
    armedButton = button;
    armedByDeleteKey = byDeleteKey;
    armedRows = dialogueRows;
    button?.classList.add('text-delete-armed');
    armedRows.forEach(row => row.classList.add('text-delete-confirming'));
  }

  function block(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

  document.addEventListener('pointerdown', event => {
    if (!armedButton && !armedByDeleteKey) return;
    if (armedButton && event.target.closest('button') === armedButton) return;
    disarm();
  }, true);

  document.addEventListener('click', event => {
    if (!armedButton && !armedByDeleteKey) return;
    if (armedButton && event.target.closest('button') === armedButton) return;
    disarm();
  }, true);

  document.addEventListener('keydown', event => {
    const editing = document.activeElement?.matches('textarea, input, [contenteditable="true"]');
    const dialogueRows = event.key === 'Delete' && !editing ? selectedDialogueRows() : [];
    if (dialogueRows.length) {
      if (armedByDeleteKey && !event.repeat) {
        disarm();
        return;
      }
      block(event);
      if (!event.repeat) arm(dialogueRows, null, true);
      return;
    }
    if (!armedButton && !armedByDeleteKey) return;
    const sameButtonActivation = event.target === armedButton && (event.key === 'Enter' || event.key === ' ');
    if (!sameButtonActivation) disarm();
  }, true);

  document.addEventListener('focusin', event => {
    if (!armedButton && !armedByDeleteKey) return;
    if (armedButton && event.target === armedButton) return;
    disarm();
  }, true);

  document.addEventListener('dragstart', disarm, true);
  document.addEventListener('input', disarm, true);

  storyList.addEventListener('click', event => {
    const match = deletionContext(event.target);
    if (!match) return;

    if (armedButton === match.button) {
      disarm();
      return;
    }

    block(event);
    arm(match.dialogueRows, match.button);
  }, true);
}
