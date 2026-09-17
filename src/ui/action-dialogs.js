import { getAll } from '../db.js';
import { COLLECTION_NAME_MAX_LENGTH } from '../model.js?v=20260912-1';
import { nextAvailableStoryName } from '../story/story-save-folders.js?v=20260917-1';
import {
  clearCurrentStory,
  createNamedCollection,
  deleteCollectionById,
  hasCurrentStoryItems
} from '../app.js?v=20260917-2';

const COLLECTION_WARNING = '(만들어둔 콘묶음은 브라우저 데이터 삭제시 지워집니다. 콘묶음 내보내기로 백업을 해두십시오.)';
const PENDING_ALERT_KEY = 'hhjcon-ui-pending-alerts';
let alertChain = Promise.resolve();

export function createDialog(title, tone = '') {
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

export function showConfirm(message, options = {}) {
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

export function chooseNameConflict(title, message, matches, existingText, separateText) {
  const { dialog, body, footer } = createDialog(title, 'warning');
  dialog.classList.add('story-save-conflict-dialog');
  body.append(messageNode(message));
  let selectedId = matches.length === 1 ? matches[0].id : '';
  const existing = document.createElement('button'); existing.type = 'button'; existing.textContent = existingText;
  existing.disabled = !selectedId;
  if (matches.length === 1) {
    const note = document.createElement('p');
    note.className = 'hhj-ui-dialog-note';
    note.textContent = `기존 항목: ${matches[0].label}`;
    body.append(note);
  } else {
    const field = document.createElement('label'); field.className = 'hhj-ui-dialog-field';
    const caption = document.createElement('span'); caption.textContent = '기존 항목 선택';
    const select = document.createElement('select'); select.className = 'story-save-conflict-select';
    select.append(new Option('기존 항목을 선택하세요', ''));
    matches.forEach(item => select.append(new Option(item.label, item.id)));
    select.addEventListener('change', () => { selectedId = select.value; existing.disabled = !selectedId; });
    field.append(caption, select); body.append(field);
  }
  const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = '취소';
  const separate = document.createElement('button'); separate.type = 'button'; separate.className = 'primary'; separate.textContent = separateText;
  footer.append(cancel, separate, existing);
  cancel.addEventListener('click', () => dialog.close('cancel'));
  separate.addEventListener('click', () => dialog.close('separate'));
  existing.addEventListener('click', () => { if (selectedId) dialog.close('existing'); });
  return new Promise(resolve => {
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'existing' ? { action: 'existing', id: selectedId }
      : dialog.returnValue === 'separate' ? { action: 'separate' } : null), { once: true });
    dialog.showModal();
    queueMicrotask(() => cancel.focus());
  });
}

export function showPrompt(message, defaultValue = '', options = {}) {
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

document.addEventListener('click', async event => {
  const button = event.target.closest('button');
  if (!button) return;
  let task = null;

  if (button.id === 'newCollectionBtn') {
    task = async () => {
      const name = await showPrompt('새 콘묶음 이름을 입력하세요.', '', {
        title: '새 콘묶음', label: `콘묶음 이름 (최대 ${COLLECTION_NAME_MAX_LENGTH}자)`, confirmText: '만들기', maxLength: COLLECTION_NAME_MAX_LENGTH,
        requiredMessage: '콘묶음 이름을 입력하세요.', note: COLLECTION_WARNING
      });
      if (name == null) return;
      let collectionName = name.trim();
      const collections = await getAll('collections');
      const matches = collections.filter(item => item.name.toLocaleLowerCase('ko-KR') === collectionName.toLocaleLowerCase('ko-KR'));
      if (matches.length) {
        const separateName = nextAvailableStoryName(collectionName, collections.map(item => item.name), COLLECTION_NAME_MAX_LENGTH, true);
        const choice = await chooseNameConflict('콘묶음 이름 중복',
          `“${collectionName}” 콘묶음이 이미 있습니다. 기존 콘묶음을 열거나 “${separateName}”로 새로 만들 수 있습니다.`,
          matches.map(item => ({ id: item.id, label: `${item.name} · 콘 ${item.items.length}개 · ${item.id.slice(-6)}` })),
          '기존 콘묶음 열기', '별도 콘묶음 만들기');
        if (!choice) return;
        if (choice.action === 'existing') {
          const existing = (await getAll('collections')).find(item => item.id === choice.id);
          if (!existing || existing.name.toLocaleLowerCase('ko-KR') !== collectionName.toLocaleLowerCase('ko-KR')) {
            throw new Error('기존 콘묶음이 변경되었습니다. 다시 확인해주세요.');
          }
          const target = [...document.querySelectorAll('#collectionList .collection-row')]
            .find(row => row.dataset.collectionId === existing.id)?.querySelector('.collection-main');
          if (!target) throw new Error('콘묶음 목록이 변경되었습니다. 다시 확인해주세요.');
          target.click();
          return;
        }
        collectionName = separateName;
      }
      if ((await getAll('collections')).some(item => item.name.toLocaleLowerCase('ko-KR') === collectionName.toLocaleLowerCase('ko-KR'))) {
        throw new Error('같은 이름의 콘묶음이 새로 생겼습니다. 다시 확인해주세요.');
      }
      const collectionId = await createNamedCollection(collectionName);
      document.dispatchEvent(new CustomEvent('hhjcon:collection-created', {
        detail: { id: collectionId, name: collectionName }
      }));
    };
  } else if (button.matches('#collectionList .collection-row > .icon-button')) {
    task = async () => {
      const row = button.closest('.collection-row');
      const collectionId = row?.dataset.collectionId || '';
      const name = row?.querySelector('.collection-main span')?.textContent?.trim() || '선택한';
      const ok = await showConfirm(`“${name}” 콘묶음을 삭제할까요?\n콘묶음만 삭제되며 원본 디시콘은 삭제되지 않습니다.`, {
        title: '콘묶음 삭제', confirmText: '삭제', danger: true
      });
      if (ok) await deleteCollectionById(collectionId);
    };
  } else if (button.id === 'clearStoryBtn') {
    task = async () => {
      if (hasCurrentStoryItems()) {
        const ok = await showConfirm('현재 원고를 모두 비울까요?\n이 동작은 현재 편집 중인 원고의 모든 내용을 비웁니다.', {
          title: '원고 비우기', confirmText: '비우기', danger: true
        });
        if (!ok) return;
      }
      await clearCurrentStory();
      document.dispatchEvent(new Event('hhjcon:story-cleared'));
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
