let hideTimer = null;
const RELOAD_TOAST_KEY = 'hhjcon-reload-toast';

export function showToast(message, duration = 2400) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  const dialogs = document.querySelectorAll?.('dialog:modal') || [];
  const dialog = dialogs[dialogs.length - 1];
  if (dialog && toast.parentElement !== dialog) {
    dialog.append(toast);
    dialog.addEventListener('close', () => {
      if (toast.parentElement === dialog) document.body.append(toast);
    }, { once: true });
  }
  toast.textContent = String(message);
  toast.classList.add('show');
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    toast.classList.remove('show');
    hideTimer = null;
  }, duration);
}

export function saveToastForReload(message) {
  sessionStorage.setItem(RELOAD_TOAST_KEY, String(message));
}

const reloadMessage = sessionStorage.getItem(RELOAD_TOAST_KEY);
if (reloadMessage) {
  sessionStorage.removeItem(RELOAD_TOAST_KEY);
  setTimeout(() => showToast(reloadMessage), 100);
}
