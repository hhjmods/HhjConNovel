const storyList = document.getElementById('storyList');

if (storyList) {
  let armedButton = null;
  let armedRow = null;

  function isDialogueDeleteButton(target) {
    const button = target.closest('button');
    if (!button || !storyList.contains(button)) return null;
    const tools = button.closest('.story-tools');
    const row = button.closest('.story-item.story-text');
    if (!tools || !row || row.classList.contains('story-break')) return null;
    if (button.textContent.trim() !== '×') return null;
    return { button, row };
  }

  function disarm() {
    armedButton?.classList.remove('text-delete-armed');
    armedRow?.classList.remove('text-delete-confirming');
    armedButton = null;
    armedRow = null;
  }

  function arm(button, row) {
    disarm();
    armedButton = button;
    armedRow = row;
    button.classList.add('text-delete-armed');
    row.classList.add('text-delete-confirming');
  }

  document.addEventListener('pointerdown', event => {
    if (!armedButton) return;
    if (event.target.closest('button') === armedButton) return;
    disarm();
  }, true);

  document.addEventListener('click', event => {
    if (!armedButton) return;
    if (event.target.closest('button') === armedButton) return;
    disarm();
  }, true);

  document.addEventListener('keydown', event => {
    if (!armedButton) return;
    const sameButtonActivation = event.target === armedButton && (event.key === 'Enter' || event.key === ' ');
    if (!sameButtonActivation) disarm();
  }, true);

  document.addEventListener('focusin', event => {
    if (!armedButton) return;
    if (event.target === armedButton) return;
    disarm();
  }, true);

  document.addEventListener('dragstart', disarm, true);
  document.addEventListener('input', disarm, true);

  storyList.addEventListener('click', event => {
    const match = isDialogueDeleteButton(event.target);
    if (!match) return;

    if (armedButton === match.button) {
      disarm();
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    arm(match.button, match.row);
  }, true);
}
