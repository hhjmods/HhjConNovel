const toolbar = document.querySelector('.text-format-toolbar');
const storyList = document.getElementById('storyList');

if (toolbar && storyList) {
  let activeEditor = null;
  let savedRange = null;
  const colorInput = toolbar.querySelector('[data-format="color"]');
  const backgroundInput = toolbar.querySelector('[data-format="background"]');
  let pendingColor = colorInput?.value || '#000000';
  let pendingBackground = backgroundInput?.value || '#ffffff';

  function addConfirmButton(input, kind, title) {
    if (!input) return null;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'format-color-confirm';
    button.dataset.colorConfirm = kind;
    button.textContent = '확인';
    button.title = title;
    button.disabled = true;
    const label = input.closest('.format-color');
    if (label) label.insertAdjacentElement('afterend', button);
    else input.insertAdjacentElement('afterend', button);
    return button;
  }

  const colorConfirm = addConfirmButton(colorInput, 'color', '선택한 글자색 적용');
  const backgroundConfirm = addConfirmButton(backgroundInput, 'background', '선택한 배경색 적용');

  function setConfirmEnabled(enabled) {
    if (colorConfirm) colorConfirm.disabled = !enabled;
    if (backgroundConfirm) backgroundConfirm.disabled = !enabled;
  }

  function rangeInsideEditor(range, editor) {
    return Boolean(range && editor && editor.contains(range.commonAncestorContainer));
  }

  function captureSelection() {
    const selection = window.getSelection();
    if (!selection?.rangeCount || !activeEditor) return;
    const range = selection.getRangeAt(0);
    if (rangeInsideEditor(range, activeEditor)) savedRange = range.cloneRange();
  }

  function restoreSelection() {
    if (!activeEditor || !savedRange || !activeEditor.isConnected) return false;
    const selection = window.getSelection();
    activeEditor.focus({ preventScroll: true });
    selection.removeAllRanges();
    selection.addRange(savedRange.cloneRange());
    return true;
  }

  function applyCommand(command, value, fallbackCommand = null) {
    if (!restoreSelection()) return;
    document.execCommand('styleWithCSS', false, true);
    const applied = document.execCommand(command, false, value);
    if (!applied && fallbackCommand) document.execCommand(fallbackCommand, false, value);
    captureSelection();
    activeEditor.dispatchEvent(new Event('input', { bubbles: true }));
  }

  document.addEventListener('focusin', event => {
    const editor = event.target.closest?.('.rich-text-editor');
    if (editor) {
      activeEditor = editor;
      captureSelection();
      setConfirmEnabled(true);
    }
  });

  document.addEventListener('selectionchange', () => captureSelection());
  storyList.addEventListener('mouseup', captureSelection, true);
  storyList.addEventListener('keyup', captureSelection, true);

  toolbar.addEventListener('pointerdown', event => {
    if (event.target.closest('select, input[type="color"]')) captureSelection();
  }, true);

  toolbar.addEventListener('input', event => {
    const control = event.target;
    if (!(control instanceof HTMLInputElement) || !control.matches('input[type="color"]')) return;
    event.stopImmediatePropagation();
    if (control.matches('[data-format="color"]')) pendingColor = control.value;
    if (control.matches('[data-format="background"]')) pendingBackground = control.value;
  }, true);

  toolbar.addEventListener('change', event => {
    const control = event.target;
    if (!(control instanceof HTMLSelectElement) && !(control instanceof HTMLInputElement)) return;

    if (control.matches('[data-format="font"]')) {
      event.stopImmediatePropagation();
      if (control.value) applyCommand('fontName', control.value);
      return;
    }

    if (control.matches('[data-format="size"]')) {
      event.stopImmediatePropagation();
      if (control.value) applyCommand('fontSize', control.value);
      return;
    }

    if (control.matches('[data-format="color"]')) {
      event.stopImmediatePropagation();
      pendingColor = control.value;
      return;
    }

    if (control.matches('[data-format="background"]')) {
      event.stopImmediatePropagation();
      pendingBackground = control.value;
    }
  }, true);

  toolbar.addEventListener('click', event => {
    const button = event.target.closest('button[data-color-confirm]');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (button.dataset.colorConfirm === 'color') {
      applyCommand('foreColor', pendingColor);
      return;
    }
    if (button.dataset.colorConfirm === 'background') {
      applyCommand('hiliteColor', pendingBackground, 'backColor');
    }
  }, true);
}
