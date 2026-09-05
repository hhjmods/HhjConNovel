const storyList = document.getElementById('storyList');

if (storyList) {
  storyList.addEventListener('keydown', event => {
    const editor = event.target?.closest?.('.rich-text-editor');
    if (!editor || !storyList.contains(editor)) return;
    if (event.key !== 'Enter' || event.isComposing || event.keyCode === 229) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const selection = window.getSelection();
    if (!selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (!editor.contains(range.startContainer) || !editor.contains(range.endContainer)) return;

    event.preventDefault();
    event.stopPropagation();

    range.deleteContents();
    const br = document.createElement('br');
    range.insertNode(br);
    range.setStartAfter(br);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);

    editor.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      inputType: 'insertLineBreak',
      data: null
    }));
  }, true);
}
