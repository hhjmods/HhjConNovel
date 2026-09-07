const libraryPanel = document.querySelector('.library-panel');
const viewTabs = document.querySelector('.library-view-tabs');
const CLOSE_ALL_EVENT = 'hhjcon:library-close-all';

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

  function updateViewState() {
    const hasTabs = Boolean(viewTabs.querySelector('.library-view-tab'));
    button.disabled = !hasTabs;
    libraryPanel.classList.toggle('library-tabs-empty', !hasTabs);
  }

  button.addEventListener('click', () => {
    viewTabs.dispatchEvent(new CustomEvent(CLOSE_ALL_EVENT));
    updateViewState();
  });

  const observer = new MutationObserver(updateViewState);

  observer.observe(viewTabs, { childList: true });
  updateViewState();
}
