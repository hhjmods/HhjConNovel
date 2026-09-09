(() => {
  const root = document.documentElement;
  root.classList.add('hhj-app-booting');
  root.setAttribute('aria-busy', 'true');
  window.setTimeout(() => {
    root.classList.remove('hhj-app-booting');
    root.removeAttribute('aria-busy');
  }, 4000);

  const key = 'hhjcon-ui-theme';
  const saved = localStorage.getItem(key);
  root.dataset.theme = saved === 'light' ? 'light' : 'dark';
})();
