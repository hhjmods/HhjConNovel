const libraryPanel = document.querySelector('.library-panel');
const viewTabs = document.querySelector('.library-view-tabs');

if (libraryPanel && viewTabs) {
  const shell = document.createElement('div');
  shell.className = 'library-view-tabs-shell';
  libraryPanel.insertBefore(shell, viewTabs);
  shell.append(viewTabs);

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'library-view-close-all';
  button.textContent = '탭 전체 닫기';
  button.title = '탭 전체 닫기';
  shell.append(button);

  function updateButton() {
    button.disabled = !viewTabs.querySelector('.library-view-tab');
  }

  button.addEventListener('click', () => {
    let remaining = viewTabs.querySelectorAll('.library-view-tab-close').length;
    while (remaining > 0) {
      const close = viewTabs.querySelector('.library-view-tab-close');
      if (!close) break;
      close.click();
      remaining -= 1;
    }
    libraryPanel.classList.add('library-tabs-empty');
    updateButton();
  });

  const observer = new MutationObserver(() => {
    if (viewTabs.querySelector('.library-view-tab')) {
      libraryPanel.classList.remove('library-tabs-empty');
    }
    updateButton();
  });

  observer.observe(viewTabs, { childList: true });

  document.addEventListener('click', event => {
    if (event.target.closest('.nav-item[data-view-id], .collection-main[data-view-id]')) {
      libraryPanel.classList.remove('library-tabs-empty');
    }
  }, true);

  updateButton();
}
