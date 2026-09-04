const libraryPanel = document.querySelector('.library-panel');
const viewTabs = document.querySelector('.library-view-tabs');

if (libraryPanel && viewTabs) {
  function ensureCloseAllButton() {
    let button = viewTabs.querySelector('.library-view-close-all');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'library-view-close-all';
      button.textContent = '탭 전체 닫기';
      button.title = '탭 전체 닫기';
      button.addEventListener('click', () => {
        const tabs = [...viewTabs.querySelectorAll('.library-view-tab')];
        if (!tabs.length) return;

        const active = tabs.find(tab => tab.classList.contains('active')) || null;
        const others = tabs.filter(tab => tab !== active);

        others.forEach(tab => tab.querySelector('.library-view-tab-close')?.click());
        active?.querySelector('.library-view-tab-close')?.click();

        libraryPanel.classList.add('library-tabs-empty');
        ensureCloseAllButton();
      });
      viewTabs.append(button);
    }
    button.disabled = !viewTabs.querySelector('.library-view-tab');
  }

  const observer = new MutationObserver(() => {
    if (viewTabs.querySelector('.library-view-tab')) {
      libraryPanel.classList.remove('library-tabs-empty');
    }
    ensureCloseAllButton();
  });

  observer.observe(viewTabs, { childList: true });

  document.addEventListener('click', event => {
    if (event.target.closest('.nav-item[data-view-id], .collection-main[data-view-id]')) {
      libraryPanel.classList.remove('library-tabs-empty');
    }
  }, true);

  ensureCloseAllButton();
}
