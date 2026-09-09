const root = document.documentElement;

requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    root.classList.remove('hhj-app-booting');
    root.removeAttribute('aria-busy');
  });
});
