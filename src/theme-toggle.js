const button = document.getElementById('themeToggleBtn');
const key = 'hhjcon-ui-theme';

if (button) {
  function currentTheme() {
    return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
  }

  function renderButton() {
    const light = currentTheme() === 'light';
    button.textContent = light ? '☾ 다크모드' : '☀ 라이트모드';
    button.title = light ? '다크 모드로 전환' : '라이트 모드로 전환';
    button.setAttribute('aria-label', button.title);
  }

  button.addEventListener('click', () => {
    const next = currentTheme() === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    localStorage.setItem(key, next);
    renderButton();
  });

  renderButton();
}
