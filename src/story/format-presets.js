import { createDialog } from '../ui/action-dialogs.js?v=20260917-2';
import { showToast } from '../ui/toast.js?v=20260909-2';
import {
  FORMAT_PRESET_LIMIT,
  FORMAT_PRESET_NAME_MAX,
  normalizeFormatPreset,
  normalizeFormatPresets
} from './format-preset-model.js?v=20260916-2';

const STORAGE_KEY = 'hhjcon-format-presets-v1';
const toolbar = document.querySelector('.text-format-toolbar');
const trigger = document.createElement('button');
trigger.type = 'button';
trigger.className = 'small story-format-presets';
trigger.textContent = '서식 프리셋';
toolbar?.querySelector('[data-format="font"]')?.before(trigger);

if (toolbar && trigger.isConnected) {
  const fontSelect = toolbar.querySelector('[data-format="font"]');
  const sizeSelect = toolbar.querySelector('[data-format="size"]');
  const colorInput = toolbar.querySelector('[data-format="color"]');
  const backgroundInput = toolbar.querySelector('[data-format="background"]');
  const fonts = [...fontSelect.options].map(option => option.value).filter(Boolean);
  const sizes = [...sizeSelect.options].map(option => option.value).filter(Boolean);

  function loadPresets() {
    try {
      return normalizeFormatPresets(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'), fonts, sizes);
    } catch {
      return [];
    }
  }

  function savePresets(items) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      return true;
    } catch {
      showToast('서식 프리셋을 저장하지 못했습니다.');
      return false;
    }
  }

  function presetSummary(preset) {
    const parts = [];
    if (preset.font) parts.push(fontSelect.querySelector(`option[value="${CSS.escape(preset.font)}"]`)?.textContent || preset.font);
    if (preset.size) parts.push(preset.size);
    if (preset.color) parts.push('글자색');
    if (preset.background) parts.push('배경색');
    if (preset.bold) parts.push('굵게');
    if (preset.italic) parts.push('기울임');
    if (preset.underline) parts.push('밑줄');
    if (preset.strikeThrough) parts.push('취소선');
    if (preset.align) parts.push({ justifyLeft: '왼쪽 정렬', justifyCenter: '가운데 정렬', justifyRight: '오른쪽 정렬' }[preset.align]);
    return parts.join(' · ');
  }

  function presetSample(preset) {
    const sample = document.createElement('span');
    sample.className = 'format-preset-sample';
    sample.textContent = '가나다ABCabc123';
    if (preset.font) sample.style.fontFamily = preset.font;
    if (preset.size) sample.style.fontSize = `${Math.min(Number.parseInt(preset.size, 10), 20)}px`;
    if (preset.color) sample.style.color = preset.color;
    if (preset.background) sample.style.backgroundColor = preset.background;
    if (preset.bold) sample.style.fontWeight = '700';
    if (preset.italic) sample.style.fontStyle = 'italic';
    const decorations = [];
    if (preset.underline) decorations.push('underline');
    if (preset.strikeThrough) decorations.push('line-through');
    if (decorations.length) sample.style.textDecoration = decorations.join(' ');
    return sample;
  }

  function openPresetDialog() {
    const { dialog, body, footer } = createDialog('서식 프리셋');
    dialog.addEventListener('close', () => toolbar.dispatchEvent(new Event('hhjcon:close-format-color-picker')), { once: true });
    dialog.classList.add('format-preset-dialog');
    body.classList.add('format-preset-body');

    const guide = document.createElement('p');
    guide.className = 'format-preset-guide';
    guide.textContent = '대사의 글자를 선택해 적용하세요. 기존 서식은 지우고 저장된 서식으로 바꿉니다.';
    const list = document.createElement('div');
    list.className = 'format-preset-list';
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'format-preset-add';
    add.textContent = '+ 새 프리셋';

    const form = document.createElement('form');
    form.className = 'format-preset-form';
    form.hidden = true;
    form.innerHTML = `
      <label class="format-preset-name"><span>이름</span><input name="name" type="text" maxlength="${FORMAT_PRESET_NAME_MAX}" placeholder="예: 강조 대사" required></label>
      <div class="format-preset-fields">
        <label><input type="checkbox" data-use="font"><span>글꼴</span><select name="font"></select></label>
        <label><input type="checkbox" data-use="size"><span>크기</span><select name="size"></select></label>
        <label><input type="checkbox" data-use="color"><span>글자색</span><input name="color" type="color"></label>
        <label><input type="checkbox" data-use="background"><span>배경색</span><input name="background" type="color"></label>
        <label><input type="checkbox" data-use="align"><span>정렬</span><select name="align"><option value="justifyLeft">왼쪽</option><option value="justifyCenter">가운데</option><option value="justifyRight">오른쪽</option></select></label>
      </div>
      <div class="format-preset-toggles">
        <label><input name="bold" type="checkbox">굵게</label>
        <label><input name="italic" type="checkbox">기울임</label>
        <label><input name="underline" type="checkbox">밑줄</label>
        <label><input name="strikeThrough" type="checkbox">취소선</label>
      </div>
      <p class="format-preset-error" aria-live="polite"></p>
      <div class="format-preset-form-actions"><button type="button" data-form-action="cancel">취소</button><button type="submit" class="primary">저장</button></div>
    `;
    const formFont = form.elements.font;
    const formSize = form.elements.size;
    [...fontSelect.options].filter(option => option.value).forEach(option => formFont.append(option.cloneNode(true)));
    [...sizeSelect.options].filter(option => option.value).forEach(option => formSize.append(option.cloneNode(true)));
    formFont.value = fontSelect.value || fonts[0];
    formSize.value = sizeSelect.value || '12px';
    form.elements.color.value = colorInput.value;
    form.elements.background.value = backgroundInput.value;
    let editingId = null;

    function syncOptionalControls() {
      form.querySelectorAll('[data-use]').forEach(check => {
        form.elements[check.dataset.use].disabled = !check.checked;
      });
    }

    function closeForm() {
      toolbar.dispatchEvent(new Event('hhjcon:close-format-color-picker'));
      form.hidden = true;
      editingId = null;
      form.querySelector('.format-preset-error').textContent = '';
    }

    function openForm(preset = null) {
      toolbar.dispatchEvent(new Event('hhjcon:close-format-color-picker'));
      editingId = preset?.id || null;
      form.reset();
      form.elements.name.value = preset?.name || '';
      ['font', 'size', 'color', 'background', 'align'].forEach(key => {
        form.querySelector(`[data-use="${key}"]`).checked = Boolean(preset?.[key]);
      });
      formFont.value = preset?.font || fontSelect.value || fonts[0];
      formSize.value = preset?.size || sizeSelect.value || '12px';
      form.elements.color.value = preset?.color || colorInput.value;
      form.elements.background.value = preset?.background || backgroundInput.value;
      form.elements.align.value = preset?.align || 'justifyLeft';
      ['bold', 'italic', 'underline', 'strikeThrough'].forEach(key => {
        form.elements[key].checked = Boolean(preset?.[key]);
      });
      syncOptionalControls();
      form.querySelector('[type="submit"]').textContent = preset ? '변경 저장' : '저장';
      form.querySelector('.format-preset-error').textContent = '';
      form.hidden = false;
      form.elements.name.focus();
    }

    function renderList() {
      const presets = loadPresets();
      list.replaceChildren();
      if (!presets.length) {
        const empty = document.createElement('p');
        empty.className = 'format-preset-empty';
        empty.textContent = '저장된 프리셋이 없습니다.';
        list.append(empty);
        return;
      }
      presets.forEach(preset => {
        const row = document.createElement('div');
        row.className = 'format-preset-row';
        const apply = document.createElement('button');
        apply.type = 'button';
        apply.className = 'format-preset-apply';
        const text = document.createElement('span');
        text.className = 'format-preset-text';
        const name = document.createElement('strong');
        name.textContent = preset.name;
        const summary = document.createElement('small');
        summary.textContent = presetSummary(preset);
        text.append(name, summary);
        apply.append(presetSample(preset), text);
        apply.addEventListener('click', () => {
          const detail = { preset, applied: false };
          dialog.close('apply');
          toolbar.dispatchEvent(new CustomEvent('hhjcon:apply-format-preset', { detail }));
          showToast(detail.applied ? `“${preset.name}” 서식을 적용했습니다.` : '대사에서 적용할 글자를 먼저 선택해주세요.');
        });
        const edit = document.createElement('button');
        edit.type = 'button';
        edit.textContent = '수정';
        edit.setAttribute('aria-label', `${preset.name} 프리셋 수정`);
        edit.addEventListener('click', () => openForm(preset));
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'format-preset-delete';
        remove.textContent = '삭제';
        remove.setAttribute('aria-label', `${preset.name} 프리셋 삭제`);
        remove.addEventListener('click', () => {
          const next = loadPresets().filter(item => item.id !== preset.id);
          if (!savePresets(next)) return;
          if (editingId === preset.id) closeForm();
          renderList();
          showToast(`“${preset.name}” 프리셋을 삭제했습니다.`);
        });
        row.append(apply, edit, remove);
        list.append(row);
      });
    }

    add.addEventListener('click', () => {
      if (!form.hidden && !editingId) closeForm();
      else openForm();
    });
    form.querySelectorAll('[data-use]').forEach(check => check.addEventListener('change', syncOptionalControls));
    const openColorPicker = source => {
      const detail = { source, kind: source.name === 'color' ? 'color' : 'background', opened: false };
      toolbar.dispatchEvent(new CustomEvent('hhjcon:open-format-color-picker', { detail }));
      return detail.opened;
    };
    form.addEventListener('pointerdown', event => {
      const source = event.target.closest('input[type="color"]');
      if (!source || source.disabled || !openColorPicker(source)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
    form.addEventListener('click', event => {
      if (!event.target.closest('input[type="color"]')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
    form.addEventListener('keydown', event => {
      const source = event.target.closest('input[type="color"]');
      if (!source || !['Enter', ' '].includes(event.key) || !openColorPicker(source)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
    form.querySelector('[data-form-action="cancel"]').addEventListener('click', closeForm);
    form.addEventListener('submit', event => {
      event.preventDefault();
      const presets = loadPresets();
      const error = form.querySelector('.format-preset-error');
      if (!editingId && presets.length >= FORMAT_PRESET_LIMIT) {
        error.textContent = `프리셋은 최대 ${FORMAT_PRESET_LIMIT}개까지 저장할 수 있습니다.`;
        return;
      }
      if (editingId && !presets.some(item => item.id === editingId)) {
        error.textContent = '수정할 프리셋을 찾을 수 없습니다.';
        return;
      }
      const raw = {
        id: editingId || crypto.randomUUID(),
        name: form.elements.name.value
      };
      ['font', 'size', 'color', 'background', 'align'].forEach(key => {
        if (form.querySelector(`[data-use="${key}"]`).checked) raw[key] = form.elements[key].value;
      });
      ['bold', 'italic', 'underline', 'strikeThrough'].forEach(key => {
        if (form.elements[key].checked) raw[key] = true;
      });
      const preset = normalizeFormatPreset(raw, fonts, sizes);
      if (!preset) {
        error.textContent = raw.name.trim() ? '적용할 서식을 한 개 이상 선택하세요.' : '프리셋 이름을 입력하세요.';
        return;
      }
      const updated = Boolean(editingId);
      const next = updated ? presets.map(item => item.id === editingId ? preset : item) : [...presets, preset];
      if (!savePresets(next)) return;
      closeForm();
      renderList();
      showToast(`“${preset.name}” 프리셋을 ${updated ? '수정' : '저장'}했습니다.`);
    });

    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = '닫기';
    close.addEventListener('click', () => dialog.close('cancel'));
    footer.append(close);
    body.append(guide, list, add, form);
    syncOptionalControls();
    renderList();
    dialog.showModal();
  }

  trigger.addEventListener('pointerdown', event => event.preventDefault());
  trigger.addEventListener('click', openPresetDialog);
}
