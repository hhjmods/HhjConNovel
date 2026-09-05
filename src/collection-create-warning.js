import { getAll, getOne } from './db.js';

const COLLECTION_WARNING = '(만들어둔 콘묶음은 브라우저 데이터 삭제시 지워집니다. 콘묶음 내보내기로 백업을 해두십시오.)';
const PENDING_ALERT_KEY = 'hhjcon-ui-pending-alerts';
const nativePrompt = window.prompt.bind(window);
const nativeConfirm = window.confirm.bind(window);
let replaying = false;
let alertChain = Promise.resolve();

function installStyles() {
  if (document.getElementById('hhjcon-ui-dialog-style')) return;
  const style = document.createElement('style');
  style.id = 'hhjcon-ui-dialog-style';
  style.textContent = `
.hhj-ui-dialog{width:min(620px,calc(100vw - 28px));max-height:min(82vh,720px);padding:0;border:1px solid var(--line);border-radius:12px;background:var(--panel);color:var(--text);box-shadow:0 22px 70px #0009;overflow:hidden}
.hhj-ui-dialog::backdrop{background:#0009}
.hhj-ui-dialog-head,.hhj-ui-dialog-footer{display:flex;align-items:center;gap:8px;padding:12px 14px}
.hhj-ui-dialog-head{justify-content:space-between;border-bottom:1px solid var(--line)}
.hhj-ui-dialog-head strong{font-size:14px}
.hhj-ui-dialog-body{padding:16px;overflow:auto;line-height:1.65}
.hhj-ui-dialog-message{margin:0;white-space:pre-line;overflow-wrap:anywhere}
.hhj-ui-dialog-field{display:flex;flex-direction:column;gap:7px;margin-top:14px}
.hhj-ui-dialog-field>span{font-size:12px;color:var(--muted)}
.hhj-ui-dialog-field input{width:100%;min-width:0}
.hhj-ui-dialog-note{margin:12px 0 0;color:var(--muted);font-size:12px;line-height:1.55;white-space:pre-line}
.hhj-ui-dialog-error{min-height:18px;margin:6px 0 0;color:#ff9aa7;font-size:12px}
.hhj-ui-dialog-footer{justify-content:flex-end;border-top:1px solid var(--line)}
.hhj-ui-dialog.danger .hhj-ui-dialog-head strong{color:#ff9aa7}
.hhj-ui-dialog.warning .hhj-ui-dialog-head strong{color:#ffd08a}
.hhj-ui-dialog .danger-action{background:#74313b;border-color:#a34a58;color:#fff}
.hhj-ui-dialog .danger-action:hover{border-color:#d16a79}
.editor-backup-dialog,.story-save-dialog,.collection-backup-dialog{border-color:var(--line)!important;border-radius:12px!important;background:var(--panel)!important;color:var(--text)!important;box-shadow:0 22px 70px #0009!important}
.editor-backup-dialog::backdrop,.story-save-dialog::backdrop,.collection-backup-dialog::backdrop{background:#0009!important}
.editor-backup-head,.story-save-head,.collection-backup-header{padding:12px 14px!important;border-bottom:1px solid var(--line)!important}
.editor-backup-footer,.collection-backup-footer{padding:12px 14px!important;border-top:1px solid var(--line)!important}
`;
  document.head.append(style);
}

function createDialog(title, tone = '') {
  const dialog = document.createElement('dialog');
  dialog.className = `hhj-ui-dialog${tone ? ` ${tone}` : ''}`;
  const head = document.createElement('div');
  head.className = 'hhj-ui-dialog-head';
  const heading = document.createElement('strong');
  heading.textContent = title;
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'icon-button';
  close.textContent = '×';
  close.title = '닫기';
  const body = document.createElement('div');
  body.className = 'hhj-ui-dialog-body';
  const footer = document.createElement('div');
  footer.className = 'hhj-ui-dialog-footer';
  head.append(heading, close);
  dialog.append(head, body, footer);
  document.body.append(dialog);
  close.addEventListener('click', () => dialog.close('cancel'));
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close('cancel'); });
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  return { dialog, body, footer };
}

function messageNode(message) {
  const node = document.createElement('p');
  node.className = 'hhj-ui-dialog-message';
  node.textContent = String(message ?? '');
  return node;
}

function inferAlertOptions(message) {
  const text = String(message ?? '');
  if (/실패|오류|지원하지|올바르지|불러올 수 없|저장할 수 없/.test(text)) return { title: '오류', tone: 'danger' };
  return { title: '알림', tone: '' };
}

function showAlert(message, options = {}) {
  const inferred = inferAlertOptions(message);
  const { dialog, body, footer } = createDialog(options.title || inferred.title, options.tone ?? inferred.tone);
  body.append(messageNode(message));
  const ok = document.createElement('button');
  ok.type = 'button';
  ok.className = 'primary';
  ok.textContent = options.confirmText || '확인';
  footer.append(ok);
  ok.addEventListener('click', () => dialog.close('ok'));
  return new Promise(resolve => {
    dialog.addEventListener('close', () => resolve(), { once: true });
    dialog.showModal();
    queueMicrotask(() => ok.focus());
  });
}

function showConfirm(message, options = {}) {
  const { dialog, body, footer } = createDialog(options.title || '확인', options.tone || (options.danger ? 'danger' : ''));
  body.append(messageNode(message));
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.textContent = options.cancelText || '취소';
  const confirm = document.createElement('button');
  confirm.type = 'button';
  confirm.className = options.danger ? 'danger-action' : 'primary';
  confirm.textContent = options.confirmText || '확인';
  footer.append(cancel, confirm);
  cancel.addEventListener('click', () => dialog.close('cancel'));
  confirm.addEventListener('click', () => dialog.close('confirm'));
  return new Promise(resolve => {
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true });
    dialog.showModal();
    queueMicrotask(() => (options.danger ? cancel : confirm).focus());
  });
}

function showPrompt(message, defaultValue = '', options = {}) {
  const { dialog, body, footer } = createDialog(options.title || '입력');
  body.append(messageNode(message));
  const field = document.createElement('label');
  field.className = 'hhj-ui-dialog-field';
  const label = document.createElement('span');
  label.textContent = options.label || '이름';
  const input = document.createElement('input');
  input.type = 'text';
  input.value = String(defaultValue ?? '');
  input.placeholder = options.placeholder || '';
  input.maxLength = Number(options.maxLength) > 0 ? Number(options.maxLength) : 120;
  const error = document.createElement('div');
  error.className = 'hhj-ui-dialog-error';
  field.append(label, input, error);
  body.append(field);
  if (options.note) {
    const note = document.createElement('p');
    note.className = 'hhj-ui-dialog-note';
    note.textContent = options.note;
    body.append(note);
  }
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.textContent = options.cancelText || '취소';
  const confirm = document.createElement('button');
  confirm.type = 'button';
  confirm.className = 'primary';
  confirm.textContent = options.confirmText || '확인';
  footer.append(cancel, confirm);

  const submit = () => {
    const value = input.value.trim();
    if (options.required !== false && !value) {
      error.textContent = options.requiredMessage || '값을 입력해주세요.';
      input.focus();
      return;
    }
    dialog.dataset.result = input.value;
    dialog.close('confirm');
  };
  cancel.addEventListener('click', () => dialog.close('cancel'));
  confirm.addEventListener('click', submit);
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.isComposing) {
      event.preventDefault();
      submit();
    }
  });
  input.addEventListener('input', () => { error.textContent = ''; });

  return new Promise(resolve => {
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm' ? dialog.dataset.result ?? '' : null), { once: true });
    dialog.showModal();
    queueMicrotask(() => { input.focus(); input.select(); });
  });
}

function pendingAlerts() {
  try {
    const value = JSON.parse(sessionStorage.getItem(PENDING_ALERT_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function savePendingAlerts(items) {
  if (items.length) sessionStorage.setItem(PENDING_ALERT_KEY, JSON.stringify(items));
  else sessionStorage.removeItem(PENDING_ALERT_KEY);
}

function enqueueAlert(message) {
  const entry = { id: crypto.randomUUID(), message: String(message ?? '') };
  const items = pendingAlerts();
  items.push(entry);
  savePendingAlerts(items);
  alertChain = alertChain.then(async () => {
    await showAlert(entry.message);
    savePendingAlerts(pendingAlerts().filter(item => item.id !== entry.id));
  });
}

const restoredAlerts = pendingAlerts();
sessionStorage.removeItem(PENDING_ALERT_KEY);
window.alert = message => enqueueAlert(message);
restoredAlerts.forEach(item => enqueueAlert(item.message));

window.hhjUiAlert = showAlert;
window.hhjUiConfirm = showConfirm;
window.hhjUiPrompt = showPrompt;

function armOneShot(kind, value) {
  const native = kind === 'prompt' ? nativePrompt : nativeConfirm;
  const wrapper = () => {
    if (window[kind] === wrapper) window[kind] = native;
    return value;
  };
  window[kind] = wrapper;
  setTimeout(() => { if (window[kind] === wrapper) window[kind] = native; }, 10000);
}

function replay(button, answers = {}) {
  if (Object.hasOwn(answers, 'prompt')) armOneShot('prompt', answers.prompt);
  if (Object.hasOwn(answers, 'confirm')) armOneShot('confirm', answers.confirm);
  replaying = true;
  try {
    button.click();
  } finally {
    replaying = false;
  }
}

function defaultStoryName() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `콘문학 ${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}${p(d.getMinutes())}`;
}

async function currentStoryHasItems() {
  const current = await getOne('documents', 'current');
  return Boolean(current?.items?.length);
}

async function storySaveExists(name) {
  const documents = await getAll('documents');
  return documents.some(item => item?.format === 'hhjcon-story-save' && String(item.name || '') === name);
}

installStyles();

document.addEventListener('click', async event => {
  if (replaying) return;
  const button = event.target.closest('button');
  if (!button) return;
  const text = button.textContent.trim();
  let task = null;

  if (button.id === 'newCollectionBtn') {
    task = async () => {
      const name = await showPrompt('새 콘묶음 이름을 입력하세요.', '', {
        title: '새 콘묶음', label: '콘묶음 이름', confirmText: '만들기', maxLength: 80,
        requiredMessage: '콘묶음 이름을 입력하세요.', note: COLLECTION_WARNING
      });
      if (name == null) return;
      replay(button, { prompt: name.trim() });
    };
  } else if (button.title === '콘묶음 삭제' && button.closest('.collection-row')) {
    task = async () => {
      const name = button.closest('.collection-row')?.querySelector('.collection-main span')?.textContent?.trim() || '선택한';
      const ok = await showConfirm(`“${name}” 콘묶음을 삭제할까요?\n콘묶음만 삭제되며 원본 디시콘은 삭제되지 않습니다.`, {
        title: '콘묶음 삭제', confirmText: '삭제', danger: true
      });
      if (ok) replay(button, { confirm: true });
    };
  } else if (button.id === 'clearStoryBtn') {
    task = async () => {
      if (!await currentStoryHasItems()) return replay(button);
      const ok = await showConfirm('현재 원고를 모두 비울까요?\n이 동작은 현재 편집 중인 내용을 비웁니다.', {
        title: '원고 비우기', confirmText: '비우기', danger: true
      });
      if (ok) replay(button, { confirm: true });
    };
  } else if (button.id === 'demoBtn') {
    task = async () => {
      if (!(await getAll('packages')).length) return replay(button);
      const ok = await showConfirm('현재 원본 DC콘 DB를 개발용 데모 데이터로 교체할까요?\n사용자 콘묶음은 유지됩니다.', {
        title: '개발용 데모', confirmText: '교체', danger: true
      });
      if (ok) replay(button, { confirm: true });
    };
  } else if ((text === '원고 저장' && button.closest('.editor-header')) || (text === '현재 원고 저장' && button.closest('.story-save-dialog'))) {
    task = async () => {
      const value = await showPrompt('저장할 콘문학 이름을 입력하세요.', defaultStoryName(), {
        title: '원고 저장', label: '원고 이름', confirmText: '저장', maxLength: 80,
        requiredMessage: '콘문학 이름을 입력하세요.'
      });
      if (value == null) return;
      const name = value.trim();
      const duplicate = await storySaveExists(name);
      if (duplicate) {
        const overwrite = await showConfirm(`“${name}” 저장 원고가 이미 있습니다.\n현재 내용으로 덮어쓸까요?`, {
          title: '원고 덮어쓰기', confirmText: '덮어쓰기', tone: 'warning'
        });
        if (!overwrite) return;
      }
      replay(button, duplicate ? { prompt: name, confirm: true } : { prompt: name });
    };
  } else if (text === '불러오기' && button.closest('.story-save-actions')) {
    task = async () => {
      if (!await currentStoryHasItems()) return replay(button);
      const ok = await showConfirm('현재 작성 중인 원고가 선택한 저장 원고로 교체됩니다.\n남겨둘 현재 버전이 있다면 먼저 원고 저장을 해주세요.\n\n계속 불러올까요?', {
        title: '원고 불러오기', confirmText: '불러오기', tone: 'warning'
      });
      if (ok) replay(button, { confirm: true });
    };
  } else if (text === '삭제' && button.closest('.story-save-actions')) {
    task = async () => {
      const name = button.closest('.story-save-row')?.querySelector('.story-save-info strong')?.textContent?.trim() || '선택한 원고';
      const ok = await showConfirm(`“${name}” 저장 원고를 삭제할까요?`, {
        title: '저장 원고 삭제', confirmText: '삭제', danger: true
      });
      if (ok) replay(button, { confirm: true });
    };
  }

  if (!task) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  try {
    await task();
  } catch (error) {
    enqueueAlert(error?.message || error || '팝업 처리 중 오류가 발생했습니다.');
  }
}, true);
