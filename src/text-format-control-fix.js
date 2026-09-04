const toolbar = document.querySelector('.text-format-toolbar');
const storyList = document.getElementById('storyList');

if (toolbar && storyList) {
  let activeEditor = null;
  let savedRange = null;

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
    }
  });

  document.addEventListener('selectionchange', () => captureSelection());
  storyList.addEventListener('mouseup', captureSelection, true);
  storyList.addEventListener('keyup', captureSelection, true);

  toolbar.addEventListener('pointerdown', event => {
    if (event.target.closest('select, input[type="color"]')) captureSelection();
  }, true);

  toolbar.addEventListener('input', event => {
    if (event.target.matches('input[type="color"]')) event.stopImmediatePropagation();
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
      applyCommand('foreColor', control.value);
      return;
    }

    if (control.matches('[data-format="background"]')) {
      event.stopImmediatePropagation();
      applyCommand('hiliteColor', control.value, 'backColor');
    }
  }, true);
}
