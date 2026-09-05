const toolbar = document.querySelector('.text-format-toolbar');
const storyList = document.getElementById('storyList');

if (toolbar && storyList) {
  let activeEditor = null;
  let savedRange = null;
  const colorInput = toolbar.querySelector('[data-format="color"]');
  const backgroundInput = toolbar.querySelector('[data-format="background"]');

  const popup = document.createElement('div');
  popup.className = 'format-color-popup';
  popup.hidden = true;
  popup.innerHTML = `
    <strong class="format-color-popup-title"></strong>
    <div class="format-color-popup-controls">
      <input class="format-color-popup-picker" type="color" aria-label="색상 선택">
      <input class="format-color-popup-hex" type="text" maxlength="7" spellcheck="false" autocomplete="off" aria-label="색상 코드">
    </div>
    <div class="format-color-popup-actions">
      <button type="button" data-popup-action="cancel">취소</button>
      <button type="button" data-popup-action="confirm">확인</button>
    </div>
  `;
  document.body.append(popup);

  const style = document.createElement('style');
  style.id = 'format-color-popup-style';
  style.textContent = `
.format-color-popup{position:fixed;z-index:2147483000;width:220px;padding:10px;border:1px solid var(--line);border-radius:9px;background:#171d27;color:var(--text);box-shadow:0 8px 28px rgba(0,0,0,.35)}.format-color-popup[hidden]{display:none!important}.format-color-popup-title{display:block;margin-bottom:8px;font-size:12px}.format-color-popup-controls{display:grid;grid-template-columns:52px 1fr;gap:8px;align-items:center}.format-color-popup-picker{width:52px;height:34px;padding:2px;border:1px solid var(--line);border-radius:6px;background:#121720}.format-color-popup-hex{min-width:0;height:34px;padding:6px 8px;border:1px solid var(--line);border-radius:6px;background:#121720;color:var(--text);font:12px ui-monospace,SFMono-Regular,Consolas,monospace}.format-color-popup-hex.invalid{border-color:#d85757}.format-color-popup-actions{display:flex;justify-content:flex-end;gap:6px;margin-top:9px}.format-color-popup-actions button{min-height:30px;padding:5px 10px;border-radius:7px;font-size:12px}:root[data-theme="light"] .format-color-popup{background:#fff;color:#1f2937}:root[data-theme="light"] .format-color-popup-picker,:root[data-theme="light"] .format-color-popup-hex{background:#fff;color:#1f2937}
`;
  document.head.append(style);

  const popupTitle = popup.querySelector('.format-color-popup-title');
  const popupPicker = popup.querySelector('.format-color-popup-picker');
  const popupHex = popup.querySelector('.format-color-popup-hex');
  let popupSource = null;
  let popupKind = null;
  let pendingColor = '#000000';

  function normalizeHex(value) {
    const text = String(value || '').trim();
    if (/^#[0-9a-f]{6}$/i.test(text)) return text.toLowerCase();
    const short = text.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
    return short ? `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toLowerCase() : '';
  }

  function rangeInsideEditor(range, editor) {
    return Boolean(range && editor && editor.contains(range.commonAncestorContainer));
  }

  function captureSelection() {
    const selection = window.getSelection();
    if (!selection?.rangeCount || !activeEditor) return;
    const range = selection.getRangeAt(0);
    if (rangeInsideEditor(range, activeEditor)) savedRange = range.cloneRange();
  }

  function restoreSelection() {
    if (!activeEditor || !savedRange || !activeEditor.isConnected) return false;
    const selection = window.getSelection();
    activeEditor.focus({ preventScroll: true });
    selection.removeAllRanges();
    selection.addRange(savedRange.cloneRange());
    return true;
  }

  function applyCommand(command, value, fallbackCommand = null) {
    if (!restoreSelection()) return false;
    document.execCommand('styleWithCSS', false, true);
    const applied = document.execCommand(command, false, value);
    if (!applied && fallbackCommand) document.execCommand(fallbackCommand, false, value);
    captureSelection();
    activeEditor.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }

  function closePopup() {
    popup.hidden = true;
    popupSource = null;
    popupKind = null;
    popupHex.classList.remove('invalid');
  }

  function positionPopup(source) {
    const rect = source.getBoundingClientRect();
    const width = popup.offsetWidth || 220;
    const height = popup.offsetHeight || 120;
    let left = rect.left;
    let top = rect.bottom + 6;
    if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - width - 8);
    if (top + height > window.innerHeight - 8) top = Math.max(8, rect.top - height - 6);
    popup.style.left = `${Math.round(left)}px`;
    popup.style.top = `${Math.round(top)}px`;
  }

  function openPopup(source, kind) {
    if (!source || !activeEditor || !savedRange) return;
    captureSelection();
    const initial = normalizeHex(source.value) || '#000000';
    popupSource = source;
    popupKind = kind;
    pendingColor = initial;
    popupTitle.textContent = kind === 'color' ? '글자색' : '배경색';
    popupPicker.value = initial;
    popupHex.value = initial;
    popupHex.classList.remove('invalid');
    popup.hidden = false;
    positionPopup(source);
  }

  document.addEventListener('focusin', event => {
    const editor = event.target.closest?.('.rich-text-editor');
    if (editor) {
      activeEditor = editor;
      captureSelection();
    }
  });

  document.addEventListener('selectionchange', () => captureSelection());
  storyList.addEventListener('mouseup', captureSelection, true);
  storyList.addEventListener('keyup', captureSelection, true);

  toolbar.addEventListener('pointerdown', event => {
    const source = event.target.closest('input[type="color"][data-format]');
    if (source) {
      captureSelection();
      event.preventDefault();
      event.stopImmediatePropagation();
      openPopup(source, source.matches('[data-format="color"]') ? 'color' : 'background');
      return;
    }
    if (event.target.closest('select')) captureSelection();
  }, true);

  toolbar.addEventListener('click', event => {
    if (!event.target.closest('input[type="color"][data-format]')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  toolbar.addEventListener('change', event => {
    const control = event.target;
    if (!(control instanceof HTMLSelectElement)) return;
    if (control.matches('[data-format="font"]')) {
      event.stopImmediatePropagation();
      if (control.value) applyCommand('fontName', control.value);
      return;
    }
    if (control.matches('[data-format="size"]')) {
      event.stopImmediatePropagation();
      if (control.value) applyCommand('fontSize', control.value);
    }
  }, true);

  popupPicker.addEventListener('input', () => {
    pendingColor = popupPicker.value.toLowerCase();
    popupHex.value = pendingColor;
    popupHex.classList.remove('invalid');
  });

  popupHex.addEventListener('input', () => {
    const value = normalizeHex(popupHex.value);
    popupHex.classList.toggle('invalid', !value);
    if (!value) return;
    pendingColor = value;
    popupPicker.value = value;
  });

  popup.addEventListener('click', event => {
    const button = event.target.closest('button[data-popup-action]');
    if (!button) return;
    event.preventDefault();
    if (button.dataset.popupAction === 'cancel') {
      closePopup();
      return;
    }
    const value = normalizeHex(popupHex.value) || normalizeHex(pendingColor);
    if (!value || !popupSource || !popupKind) {
      popupHex.classList.add('invalid');
      popupHex.focus();
      return;
    }
    popupSource.value = value;
    if (popupKind === 'color') applyCommand('foreColor', value);
    else applyCommand('hiliteColor', value, 'backColor');
    closePopup();
  });

  popup.addEventListener('keydown', event => {
    if (event.key === 'Escape') closePopup();
    if (event.key === 'Enter' && event.target === popupHex) popup.querySelector('[data-popup-action="confirm"]')?.click();
  });

  window.addEventListener('resize', () => { if (!popup.hidden && popupSource) positionPopup(popupSource); });
  window.addEventListener('scroll', () => { if (!popup.hidden && popupSource) positionPopup(popupSource); }, true);
}
