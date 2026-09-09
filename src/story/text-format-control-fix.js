import { clamp, hexToHsv, hsvToHex, normalizeHex } from './color-utils.js?v=20260908-1';

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
    <div class="format-color-sv" role="slider" tabindex="0" aria-label="채도와 밝기 선택">
      <span class="format-color-sv-marker"></span>
    </div>
    <div class="format-color-hue" role="slider" tabindex="0" aria-label="색조" aria-valuemin="0" aria-valuemax="360" aria-valuenow="0">
      <span class="format-color-hue-marker"></span>
    </div>
    <div class="format-color-popup-controls">
      <span class="format-color-preview" aria-hidden="true"></span>
      <input class="format-color-popup-hex" type="text" maxlength="7" spellcheck="false" autocomplete="off" aria-label="색상 코드">
    </div>
    <div class="format-color-popup-actions">
      <button type="button" data-popup-action="cancel">취소</button>
      <button type="button" data-popup-action="confirm">확인</button>
    </div>
  `;
  document.body.append(popup);

  const popupTitle = popup.querySelector('.format-color-popup-title');
  const svBox = popup.querySelector('.format-color-sv');
  const svMarker = popup.querySelector('.format-color-sv-marker');
  const hueSlider = popup.querySelector('.format-color-hue');
  const hueMarker = popup.querySelector('.format-color-hue-marker');
  const preview = popup.querySelector('.format-color-preview');
  const popupHex = popup.querySelector('.format-color-popup-hex');
  let popupSource = null;
  let popupKind = null;
  let hue = 0;
  let saturation = 0;
  let value = 0;
  let pendingColor = '#000000';
  let svPointerId = null;
  let huePointerId = null;

  function renderPicker(updateHex = true) {
    hue = clamp(Number(hue), 0, 360);
    saturation = clamp(Number(saturation));
    value = clamp(Number(value));
    pendingColor = hsvToHex(hue, saturation, value);
    svBox.style.background = `linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,hsl(${hue} 100% 50%))`;
    svMarker.style.left = `${saturation * 100}%`;
    svMarker.style.top = `${(1 - value) * 100}%`;
    hueMarker.style.left = `${(hue / 360) * 100}%`;
    hueSlider.setAttribute('aria-valuenow', String(Math.round(hue)));
    preview.style.background = pendingColor;
    if (updateHex) popupHex.value = pendingColor;
    popupHex.classList.remove('invalid');
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

  function applyCommand(command, valueHex, fallbackCommand = null) {
    if (!restoreSelection()) return false;
    document.execCommand('styleWithCSS', false, true);
    const applied = document.execCommand(command, false, valueHex);
    if (!applied && fallbackCommand) document.execCommand(fallbackCommand, false, valueHex);
    captureSelection();
    activeEditor.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }

  function closePopup() {
    popup.hidden = true;
    popupSource = null;
    popupKind = null;
    popupHex.classList.remove('invalid');
    svPointerId = null;
    huePointerId = null;
  }

  function positionPopup(source) {
    const rect = source.getBoundingClientRect();
    const width = popup.offsetWidth || 260;
    const height = popup.offsetHeight || 260;
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
    const hsv = hexToHsv(initial);
    popupSource = source;
    popupKind = kind;
    hue = hsv.h;
    saturation = hsv.s;
    value = hsv.v;
    popupTitle.textContent = kind === 'color' ? '글자색' : '배경색';
    popup.hidden = false;
    renderPicker();
    positionPopup(source);
  }

  function updateSvFromPointer(event) {
    const rect = svBox.getBoundingClientRect();
    saturation = clamp((event.clientX - rect.left) / Math.max(1, rect.width));
    value = 1 - clamp((event.clientY - rect.top) / Math.max(1, rect.height));
    renderPicker();
  }

  function updateHueFromPointer(event) {
    const rect = hueSlider.getBoundingClientRect();
    if (event.clientX <= rect.left + 1) hue = 0;
    else if (event.clientX >= rect.right - 1) hue = 360;
    else hue = clamp((event.clientX - rect.left) / Math.max(1, rect.width)) * 360;
    renderPicker();
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

  toolbar.addEventListener('keydown', event => {
    const source = event.target.closest('input[type="color"][data-format]');
    if (!source || !['Enter', ' '].includes(event.key)) return;
    captureSelection();
    event.preventDefault();
    event.stopImmediatePropagation();
    openPopup(source, source.matches('[data-format="color"]') ? 'color' : 'background');
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

  svBox.addEventListener('pointerdown', event => {
    event.preventDefault();
    svPointerId = event.pointerId;
    svBox.setPointerCapture?.(event.pointerId);
    updateSvFromPointer(event);
  });
  svBox.addEventListener('pointermove', event => {
    if (svPointerId !== event.pointerId) return;
    updateSvFromPointer(event);
  });
  const endSvPointer = event => {
    if (svPointerId !== event.pointerId) return;
    svPointerId = null;
    if (svBox.hasPointerCapture?.(event.pointerId)) svBox.releasePointerCapture(event.pointerId);
  };
  svBox.addEventListener('pointerup', endSvPointer);
  svBox.addEventListener('pointercancel', endSvPointer);

  hueSlider.addEventListener('pointerdown', event => {
    event.preventDefault();
    huePointerId = event.pointerId;
    hueSlider.setPointerCapture?.(event.pointerId);
    updateHueFromPointer(event);
  });
  hueSlider.addEventListener('pointermove', event => {
    if (huePointerId !== event.pointerId) return;
    updateHueFromPointer(event);
  });
  const endHuePointer = event => {
    if (huePointerId !== event.pointerId) return;
    huePointerId = null;
    if (hueSlider.hasPointerCapture?.(event.pointerId)) hueSlider.releasePointerCapture(event.pointerId);
  };
  hueSlider.addEventListener('pointerup', endHuePointer);
  hueSlider.addEventListener('pointercancel', endHuePointer);
  hueSlider.addEventListener('keydown', event => {
    let next = null;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = 360;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = hue - 1;
    else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = hue + 1;
    else if (event.key === 'PageDown') next = hue - 15;
    else if (event.key === 'PageUp') next = hue + 15;
    if (next === null) return;
    event.preventDefault();
    hue = clamp(next, 0, 360);
    renderPicker();
  });

  popupHex.addEventListener('input', () => {
    const valueHex = normalizeHex(popupHex.value);
    popupHex.classList.toggle('invalid', !valueHex);
    if (!valueHex) return;
    const hsv = hexToHsv(valueHex);
    hue = hsv.h;
    saturation = hsv.s;
    value = hsv.v;
    renderPicker(false);
  });

  popup.addEventListener('click', event => {
    const button = event.target.closest('button[data-popup-action]');
    if (!button) return;
    event.preventDefault();
    if (button.dataset.popupAction === 'cancel') {
      closePopup();
      return;
    }
    const valueHex = normalizeHex(popupHex.value) || normalizeHex(pendingColor);
    if (!valueHex || !popupSource || !popupKind) {
      popupHex.classList.add('invalid');
      popupHex.focus();
      return;
    }
    popupSource.value = valueHex;
    if (popupKind === 'color') applyCommand('foreColor', valueHex);
    else applyCommand('hiliteColor', valueHex, 'backColor');
    closePopup();
  });

  popup.addEventListener('keydown', event => {
    if (event.key === 'Escape') closePopup();
    if (event.key === 'Enter' && event.target === popupHex) popup.querySelector('[data-popup-action="confirm"]')?.click();
  });

  window.addEventListener('resize', () => { if (!popup.hidden && popupSource) positionPopup(popupSource); });
  window.addEventListener('scroll', () => { if (!popup.hidden && popupSource) positionPopup(popupSource); }, true);
}
