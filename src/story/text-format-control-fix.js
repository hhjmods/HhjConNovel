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

  const style = document.createElement('style');
  style.id = 'format-color-popup-style';
  style.textContent = `
.format-color-popup{position:fixed;z-index:2147483000;width:260px;max-width:calc(100vw - 16px);max-height:calc(100vh - 16px);overflow:auto;padding:10px;border:1px solid var(--line);border-radius:9px;background:#171d27;color:var(--text);box-shadow:0 8px 28px rgba(0,0,0,.35)}.format-color-popup[hidden]{display:none!important}.format-color-popup-title{display:block;margin-bottom:8px;font-size:12px}.format-color-sv{position:relative;width:100%;height:150px;border:1px solid var(--line);border-radius:7px;cursor:crosshair;touch-action:none;overflow:hidden}.format-color-sv-marker{position:absolute;width:12px;height:12px;border:2px solid #fff;border-radius:50%;box-shadow:0 0 0 1px rgba(0,0,0,.8);transform:translate(-50%,-50%);pointer-events:none}.format-color-hue{position:relative;width:100%;height:18px;margin:9px 0 8px;border:1px solid var(--line);border-radius:999px;box-sizing:border-box;background:linear-gradient(to right,#f00 0%,#ff0 16.666%,#0f0 33.333%,#0ff 50%,#00f 66.666%,#f0f 83.333%,#f00 100%);cursor:pointer;touch-action:none}.format-color-hue-marker{position:absolute;left:0;top:50%;width:12px;height:22px;border:2px solid #fff;border-radius:5px;box-shadow:0 0 0 1px rgba(0,0,0,.8);transform:translate(-50%,-50%);pointer-events:none}.format-color-popup-controls{display:grid;grid-template-columns:38px 1fr;gap:8px;align-items:center}.format-color-preview{width:38px;height:34px;border:1px solid var(--line);border-radius:6px}.format-color-popup-hex{min-width:0;height:34px;padding:6px 8px;border:1px solid var(--line);border-radius:6px;background:#121720;color:var(--text);font:12px ui-monospace,SFMono-Regular,Consolas,monospace}.format-color-popup-hex.invalid{border-color:#d85757}.format-color-popup-actions{display:flex;justify-content:flex-end;gap:6px;margin-top:9px}.format-color-popup-actions button{min-height:30px;padding:5px 10px;border-radius:7px;font-size:12px}:root[data-theme="light"] .format-color-popup{background:#fff;color:#1f2937}:root[data-theme="light"] .format-color-popup-hex{background:#fff;color:#1f2937}
`;
  document.head.append(style);

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

  function clamp(value, min = 0, max = 1) {
    return Math.min(max, Math.max(min, value));
  }

  function normalizeHex(value) {
    const text = String(value || '').trim();
    if (/^#[0-9a-f]{6}$/i.test(text)) return text.toLowerCase();
    const short = text.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
    return short ? `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toLowerCase() : '';
  }

  function hexToHsv(hex) {
    const valueHex = normalizeHex(hex) || '#000000';
    const r = parseInt(valueHex.slice(1, 3), 16) / 255;
    const g = parseInt(valueHex.slice(3, 5), 16) / 255;
    const b = parseInt(valueHex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    let h = 0;
    if (delta) {
      if (max === r) h = 60 * (((g - b) / delta) % 6);
      else if (max === g) h = 60 * ((b - r) / delta + 2);
      else h = 60 * ((r - g) / delta + 4);
    }
    if (h < 0) h += 360;
    return { h, s: max ? delta / max : 0, v: max };
  }

  function hsvToHex(h, s, v) {
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    let r = 0, g = 0, b = 0;
    if (h < 60) [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    return `#${[r, g, b].map(channel => Math.round((channel + m) * 255).toString(16).padStart(2, '0')).join('')}`;
  }

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
