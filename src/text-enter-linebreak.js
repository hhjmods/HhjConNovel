const storyList = document.getElementById('storyList');

if (storyList) {
  storyList.addEventListener('keydown', event => {
    const editor = event.target?.closest?.('.rich-text-editor');
    if (!editor || !storyList.contains(editor)) return;
    if (event.key !== 'Enter' || event.isComposing || event.keyCode === 229) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    event.preventDefault();

    let inserted = false;
    try {
      inserted = document.execCommand('insertLineBreak', false, null);
    } catch {
      inserted = false;
    }
    if (!inserted) document.execCommand('insertHTML', false, '<br>');

    editor.dispatchEvent(new Event('input', { bubbles: true }));
  }, true);
}
