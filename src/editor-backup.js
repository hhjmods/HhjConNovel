import { getAll, replaceStores } from './db.js?v=20260906-1';

const FORMAT = 'hhjcon-editor-backup';
const VERSION = 1;
const STORE_KEYS = {
  packages: 'id',
  cons: 'id',
  collections: 'id',
  documents: 'id',
  meta: 'key'
};
const COLLECTION_FORMATS = new Set(['hhjcon-collection', 'hhjcon-collections']);
const STORY_FORMATS = new Set(['hhjcon-story-save', 'hhjcon-story-saves']);
const STORAGE_PREFIX = 'hhjcon-';
const TOAST_KEY = 'hhjcon-editor-backup-toast';
const backupButton = document.getElementById('editorBackupBtn');
const restoreButton = document.getElementById('editorBackupRestoreBtn');
const toast = document.getElementById('toast');

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2400);
}

function defaultName() {
  const d = new Date();
  const p = value => String(value).padStart(2, '0');
  return `에디터 백업 ${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}${p(d.getMinutes())}`;
}

function safeFileName(name) {
  return String(name || '에디터 백업').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80);
}

function downloadJson(name, value) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function readEditorLocalStorage() {
  const data = {};
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key?.startsWith(STORAGE_PREFIX)) data[key] = localStorage.getItem(key);
  }
  return data;
}

async function captureBackup(name) {
  await new Promise(resolve => setTimeout(resolve, 250));
  const names = Object.keys(STORE_KEYS);
  const values = await Promise.all(names.map(store => getAll(store)));
  const stores = Object.fromEntries(names.map((store, index) => [store, values[index]]));
  return {
    format: FORMAT,
    version: VERSION,
    name,
    exportedAt: new Date().toISOString(),
    stores,
    localStorage: readEditorLocalStorage()
  };
}

function validateStore(name, values) {
  if (!Array.isArray(values)) throw new Error('invalid');
  const keyField = STORE_KEYS[name];
  const seen = new Set();
  values.forEach(value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid');
    const key = value[keyField];
    if (key == null || String(key) === '' || seen.has(String(key))) throw new Error('invalid');
    seen.add(String(key));
  });
  return structuredClone(values);
}

function parseBackup(data) {
  if (COLLECTION_FORMATS.has(data?.format)) {
    throw new Error('해당 파일은 콘묶음 백업파일입니다. 콘묶음 불러오기를 이용해주세요.');
  }
  if (STORY_FORMATS.has(data?.format)) {
    throw new Error('해당 파일은 원고 백업파일입니다. 원고 불러오기를 이용해주세요.');
  }
  if (!data || data.format !== FORMAT || Number(data.version) !== VERSION || !data.stores || typeof data.stores !== 'object') {
    throw new Error('정상적인 에디터 백업데이터 파일이 아닙니다. 에디터 백업 파일을 불러와주세요.');
  }
  try {
    const stores = {};
    Object.keys(STORE_KEYS).forEach(name => { stores[name] = validateStore(name, data.stores[name]); });
    const storage = {};
    if (data.localStorage != null) {
      if (!data.localStorage || typeof data.localStorage !== 'object' || Array.isArray(data.localStorage)) throw new Error('invalid');
      Object.entries(data.localStorage).forEach(([key, value]) => {
        if (!key.startsWith(STORAGE_PREFIX) || typeof value !== 'string') throw new Error('invalid');
        storage[key] = value;
      });
    }
    return { stores, localStorage: storage };
  } catch (error) {
    if (error.message !== 'invalid') throw error;
    throw new Error('정상적인 에디터 백업데이터 파일이 아닙니다. 에디터 백업 파일을 불러와주세요.');
  }
}

function replaceEditorLocalStorage(values) {
  const remove = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key?.startsWith(STORAGE_PREFIX)) remove.push(key);
  }
  remove.forEach(key => localStorage.removeItem(key));
  Object.entries(values).forEach(([key, value]) => localStorage.setItem(key, value));
}

function makeDialog(title) {
  const dialog = document.createElement('dialog');
  dialog.className = 'editor-backup-dialog';
  const head = document.createElement('div');
  head.className = 'editor-backup-head';
  const strong = document.createElement('strong');
  strong.textContent = title;
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'icon-button';
  close.textContent = '×';
  close.title = '닫기';
  head.append(strong, close);
  const body = document.createElement('div');
  body.className = 'editor-backup-body';
  const footer = document.createElement('div');
  footer.className = 'editor-backup-footer';
  dialog.append(head, body, footer);
  document.body.append(dialog);
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  return { dialog, body, footer };
}

function openBackupDialog() {
  const ui = makeDialog('에디터 백업');
  const description = document.createElement('p');
  description.textContent = '현재 에디터 연동된 dc콘목록과 제작한 콘묶음, 작성중 원고, 저장된 원고 데이터를 전부 백업합니다. 작업 환경을 옮기거나, 작업중인 데이터 백업에 사용해주세요.';
  const label = document.createElement('label');
  label.className = 'editor-backup-name';
  const labelText = document.createElement('span');
  labelText.textContent = '저장할 백업 데이터의 이름을 입력해주세요';
  const input = document.createElement('input');
  input.type = 'text';
  input.value = defaultName();
  input.maxLength = 80;
  label.append(labelText, input);
  ui.body.append(description, label);
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.textContent = '취소';
  const save = document.createElement('button');
  save.type = 'button';
  save.className = 'primary';
  save.textContent = '저장';
  ui.footer.append(cancel, save);
  cancel.addEventListener('click', () => ui.dialog.close());
  save.addEventListener('click', async () => {
    const name = input.value.trim();
    if (!name) return alert('저장할 백업 데이터의 이름을 입력해주세요.');
    save.disabled = true;
    save.textContent = '저장 중...';
    try {
      const data = await captureBackup(name);
      downloadJson(`${safeFileName(name)}.hhjconbackup.json`, data);
      ui.dialog.close();
      showToast('에디터 백업 파일을 저장했습니다.');
    } catch (error) {
      save.disabled = false;
      save.textContent = '저장';
      alert(`에디터 백업에 실패했습니다.\n${error.message || error}`);
    }
  });
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      save.click();
    }
  });
  ui.dialog.showModal();
  input.focus();
  input.select();
}

function openRestoreWarning(fileInput) {
  const ui = makeDialog('경고!');
  ui.dialog.classList.add('editor-backup-warning-dialog');
  const first = document.createElement('p');
  first.textContent = '현재 작업중이던 데이터를 전부 새로 불러오는 백업 데이터로 덮어씌웁니다.';
  const second = document.createElement('p');
  second.textContent = '작업중이던 모든 원고, 저장된 원고, 만들어둔 콘묶음 등 모든 데이터가 덮어씌워집니다.';
  const third = document.createElement('p');
  third.textContent = '이어서 진행하시려면 확인을, 아니라면 취소를 누르십시오.';
  ui.body.append(first, second, third);
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.textContent = '취소';
  const confirm = document.createElement('button');
  confirm.type = 'button';
  confirm.className = 'primary';
  confirm.textContent = '확인';
  ui.footer.append(cancel, confirm);
  cancel.addEventListener('click', () => ui.dialog.close());
  confirm.addEventListener('click', () => {
    ui.dialog.close();
    fileInput.value = '';
    fileInput.click();
  });
  ui.dialog.showModal();
}

async function restoreFromFile(file) {
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error('정상적인 에디터 백업데이터 파일이 아닙니다. 에디터 백업 파일을 불러와주세요.');
  }
  const parsed = parseBackup(data);
  await replaceStores(parsed.stores);
  replaceEditorLocalStorage(parsed.localStorage);
  sessionStorage.setItem(TOAST_KEY, `“${String(data.name || file.name)}” 에디터 백업을 불러왔습니다.`);
  location.reload();
}

if (backupButton && restoreButton) {
  const style = document.createElement('style');
  style.textContent = '.editor-backup-dialog{width:min(620px,calc(100vw - 28px));padding:0;border:1px solid var(--line);border-radius:12px;background:var(--panel);color:var(--text);box-shadow:0 22px 70px #0009}.editor-backup-dialog::backdrop{background:#0009}.editor-backup-head,.editor-backup-footer{display:flex;align-items:center;gap:8px;padding:12px;border-bottom:1px solid var(--line)}.editor-backup-head{justify-content:space-between}.editor-backup-body{padding:16px;line-height:1.65}.editor-backup-body p{margin:0 0 12px}.editor-backup-name{display:flex;flex-direction:column;gap:7px;margin-top:18px}.editor-backup-name input{width:100%}.editor-backup-footer{justify-content:flex-end;border-top:1px solid var(--line);border-bottom:0}.editor-backup-warning-dialog .editor-backup-head strong{color:#ff9aa7}.editor-backup-warning-dialog .editor-backup-body p:last-child{margin-bottom:0}';
  document.head.append(style);
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'application/json,.json,.hhjconbackup';
  fileInput.hidden = true;
  document.body.append(fileInput);
  backupButton.addEventListener('click', openBackupDialog);
  restoreButton.addEventListener('click', () => openRestoreWarning(fileInput));
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    try {
      await restoreFromFile(file);
    } catch (error) {
      alert(error.message || '에디터 백업 파일을 불러올 수 없습니다.');
    }
  });
  const message = sessionStorage.getItem(TOAST_KEY);
  if (message) {
    sessionStorage.removeItem(TOAST_KEY);
    setTimeout(() => showToast(message), 100);
  }
}
