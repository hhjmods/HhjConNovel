(() => {
  const key = 'hhjcon-ui-theme';
  const saved = localStorage.getItem(key);
  document.documentElement.dataset.theme = saved === 'light' ? 'light' : 'dark';
})();
