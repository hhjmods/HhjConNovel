import { getOne, putOne } from './db.js';

const BREAK_SENTINEL = '\uE000HHJCON_BREAK\uE001';
const RICH_DOC_ID = 'rich-text-v1';
const storyList = document.getElementById('storyList');
const editorPanel = document.querySelector('.editor-panel');
const editorHeader = editorPanel?.querySelector('.editor-header');

if (storyList && editorPanel && editorHeader) {
  let richDoc = { id: RICH_DOC_ID, version: 1, items: {}, updatedAt: Date.now() };
  let saveTimer = null;
  let activeEditor = null;
  let activeRow = null;
  let savedRange = null;

  const toolbar = document.createElement('div');
  toolbar.className = 'text-format-toolbar';
  toolbar.innerHTML = `
    <select data-format="font" aria-label="서체" title="서체">
      <option value="">서체</option>
      <option value="Arial">Arial</option>
      <option value="Malgun Gothic">맑은 고딕</option>
      <option value="Gulim">굴림</option>
      <option value="Dotum">돋움</option>
      <option value="Batang">바탕</option>
      <option value="Gungsuh">궁서</option>
    </select>
    <select data-format="size" aria-label="크기" title="글자 크기">
      <option value="">크기</option>
      <option value="2">12</option>
      <option value="3">14</option>
      <option value="4">18</option>
      <option value="5">24</option>
      <option value="6">32</option>
      <option value="7">48</option>
    </select>
    <label class="format-color" title="글자색"><span>글자색</span><input data-format="color" type="color" value="#e8edf5" aria-label="글자색"></label>
    <label class="format-color" title="배경색"><span>배경색</span><input data-format="background" type="color" value="#27344f" aria-label="배경색"></label>
    <button type="button" class="format-toggle" data-command="bold" title="굵게"><strong>B</strong></button>
    <button type="button" class="format-toggle" data-command="italic" title="기울임"><em>I</em></button>
    <button type="button" class="format-toggle" data-command="underline" title="밑줄"><u>U</u></button>
    <button type="button" class="format-toggle" data-command="strikeThrough" title="취소선"><s>S</s></button>
    <button type="button" data-command="justifyLeft" title="왼쪽 정렬">왼쪽</button>
    <button type="button" data-command="justifyCenter" title="가운데 정렬">가운데</button>
    <button type="button" data-command="justifyRight" title="오른쪽 정렬">오른쪽</button>
    <button type="button" data-action="clear-background">배경 없음</button>
    <button type="button" data-action="remove-format">서식 초기화</button>
  `;
  editorPanel.insertBefore(toolbar, editorHeader.nextSibling);

  const controls = [...toolbar.querySelectorAll('button, select, input')];
  const fontSelect = toolbar.querySelector('[data-format="font"]');
  const sizeSelect = toolbar.querySelector('[data-format="size"]');
  const colorInput = toolbar.querySelector('[data-format="color"]');
  const backgroundInput = toolbar.querySelector('[data-format="background"]');

  function setToolbarEnabled(enabled) {
    controls.forEach(control => { control.disabled = !enabled; });
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      richDoc.updatedAt = Date.now();
      putOne('documents', richDoc).catch(() => {});
    }, 160);
  }

  function flushSave() {
    clearTimeout(saveTimer);
    saveTimer = null;
    richDoc.updatedAt = Date.now();
    return putOne('documents', richDoc).catch(() => {});
  }

  function plainToHtml(text) {
    const box = document.createElement('div');
    const parts = String(text || '').split('\n');
    parts.forEach((part, index) => {
      if (index) box.append(document.createElement('br'));
      box.append(document.createTextNode(part));
    });
    return box.innerHTML;
  }

  function copyStyle(source, target) {
    const style = source.style;
    if (!style) return;
    const allowed = [
      'color', 'backgroundColor', 'fontFamily', 'fontSize', 'fontWeight',
      'fontStyle', 'textDecorationLine', 'textAlign'
    ];
    allowed.forEach(prop => {
      const value = style[prop];
      if (value) target.style[prop] = value;
    });
  }

  function sanitizeHtml(html) {
    const template = document.createElement('template');
    template.innerHTML = String(html || '');
    const output = document.createElement('div');
    const allowed = new Set(['SPAN', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'DIV', 'P']);
    const blocked = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META']);
    const sizeMap = { '1': '10px', '2': '12px', '3': '14px', '4': '18px', '5': '24px', '6': '32px', '7': '48px' };

    function appendClean(node, parent) {
      if (node.nodeType === Node.TEXT_NODE) {
        parent.append(document.createTextNode(node.data));
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const tag = node.tagName;
      if (blocked.has(tag)) return;
      if (tag === 'BR') {
        parent.append(document.createElement('br'));
        return;
      }
      if (tag === 'FONT') {
        const span = document.createElement('span');
        const face = node.getAttribute('face');
        const color = node.getAttribute('color');
        const size = node.getAttribute('size');
        if (face) span.style.fontFamily = face;
        if (color) span.style.color = color;
        if (sizeMap[size]) span.style.fontSize = sizeMap[size];
        copyStyle(node, span);
        [...node.childNodes].forEach(child => appendClean(child, span));
        parent.append(span);
        return;
      }
      if (!allowed.has(tag)) {
        [...node.childNodes].forEach(child => appendClean(child, parent));
        return;
      }
      const clean = document.createElement(tag.toLowerCase());
      copyStyle(node, clean);
      [...node.childNodes].forEach(child => appendClean(child, clean));
      parent.append(clean);
    }

    [...template.content.childNodes].forEach(node => appendClean(node, output));
    return output.innerHTML;
  }

  function editorPlainText(editor) {
    if (!editor.textContent && !editor.querySelector('br')) return '';
    return editor.innerText.replace(/\r\n?/g, '\n');
  }

  function selectionInside(editor) {
    const selection = window.getSelection();
    if (!selection?.rangeCount) return false;
    const range = selection.getRangeAt(0);
    return editor.contains(range.commonAncestorContainer);
  }

  function captureSelection() {
    if (!activeEditor || !selectionInside(activeEditor)) return;
    const selection = window.getSelection();
    savedRange = selection.getRangeAt(0).cloneRange();
    syncToolbarState();
  }

  function restoreSelection() {
    if (!activeEditor || !savedRange) return false;
    const selection = window.getSelection();
    activeEditor.focus({ preventScroll: true });
    selection.removeAllRanges();
    selection.addRange(savedRange);
    return true;
  }

  function syncToolbarState() {
    toolbar.querySelectorAll('.format-toggle[data-command]').forEach(button => {
      button.classList.toggle('active', Boolean(document.queryCommandState(button.dataset.command)));
    });
  }

  function setActive(editor) {
    activeEditor = editor;
    activeRow = editor.closest('.story-item[data-story-id]');
    savedRange = null;
    setToolbarEnabled(true);
    requestAnimationFrame(captureSelection);
  }

  function saveEditor(editor) {
    const row = editor.closest('.story-item[data-story-id]');
    const textarea = row?.querySelector('textarea');
    const storyId = row?.dataset.storyId;
    if (!row || !textarea || !storyId || textarea.value === BREAK_SENTINEL) return;

    const text = editorPlainText(editor);
    textarea.value = text;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    richDoc.items[storyId] = {
      text,
      html: sanitizeHtml(editor.innerHTML),
      updatedAt: Date.now()
    };
    scheduleSave();
  }

  function runCommand(command, value = null) {
    if (!activeEditor) return;
    restoreSelection();
    document.execCommand('styleWithCSS', false, true);
    document.execCommand(command, false, value);
    captureSelection();
    saveEditor(activeEditor);
  }

  function removeEditorForBreak(row, textarea) {
    row.querySelector('.rich-text-editor')?.remove();
    textarea.classList.remove('rich-text-source');
    row.classList.remove('rich-text-row');
    row.dataset.richTextReady = 'break';
    if (row.dataset.storyId && richDoc.items[row.dataset.storyId]) {
      delete richDoc.items[row.dataset.storyId];
      scheduleSave();
    }
  }

  function upgradeRow(row) {
    if (!row.classList.contains('story-text')) return;
    const textarea = row.querySelector('textarea');
    if (!textarea) return;
    if (textarea.value === BREAK_SENTINEL || row.classList.contains('story-break')) {
      removeEditorForBreak(row, textarea);
      return;
    }
    if (row.dataset.richTextReady === '1') return;

    row.dataset.richTextReady = '1';
    row.classList.add('rich-text-row');
    textarea.classList.add('rich-text-source');

    const editor = document.createElement('div');
    editor.className = 'rich-text-editor';
    editor.contentEditable = 'true';
    editor.spellcheck = false;
    editor.dataset.placeholder = textarea.placeholder || '대사를 입력하세요.';

    const entry = richDoc.items[row.dataset.storyId];
    if (entry && entry.text === textarea.value && entry.html) editor.innerHTML = sanitizeHtml(entry.html);
    else editor.innerHTML = plainToHtml(textarea.value);

    row.insertBefore(editor, textarea);

    editor.addEventListener('focus', () => setActive(editor));
    editor.addEventListener('mouseup', captureSelection);
    editor.addEventListener('keyup', captureSelection);
    editor.addEventListener('input', () => {
      if (activeEditor !== editor) setActive(editor);
      saveEditor(editor);
      captureSelection();
    });
    editor.addEventListener('paste', event => {
      event.preventDefault();
      const html = event.clipboardData?.getData('text/html');
      const text = event.clipboardData?.getData('text/plain') || '';
      if (html) document.execCommand('insertHTML', false, sanitizeHtml(html));
      else document.execCommand('insertText', false, text);
    });
    editor.addEventListener('blur', () => { flushSave(); });

    textarea.addEventListener('input', () => {
      if (textarea.value === BREAK_SENTINEL) removeEditorForBreak(row, textarea);
    });
  }

  function upgradeStory() {
    storyList.querySelectorAll(':scope > .story-text').forEach(upgradeRow);
  }

  toolbar.addEventListener('pointerdown', event => {
    if (!activeEditor) return;
    captureSelection();
    if (event.target.closest('button')) event.preventDefault();
  });

  toolbar.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button || !activeEditor) return;
    const command = button.dataset.command;
    if (command) {
      runCommand(command);
      return;
    }
    if (button.dataset.action === 'clear-background') {
      runCommand('backColor', 'transparent');
      return;
    }
    if (button.dataset.action === 'remove-format') runCommand('removeFormat');
  });

  fontSelect.addEventListener('change', () => {
    if (fontSelect.value) runCommand('fontName', fontSelect.value);
  });
  sizeSelect.addEventListener('change', () => {
    if (sizeSelect.value) runCommand('fontSize', sizeSelect.value);
  });
  colorInput.addEventListener('input', () => runCommand('foreColor', colorInput.value));
  backgroundInput.addEventListener('input', () => runCommand('backColor', backgroundInput.value));

  document.addEventListener('selectionchange', () => {
    if (activeEditor && selectionInside(activeEditor)) captureSelection();
  });

  const observer = new MutationObserver(() => queueMicrotask(upgradeStory));
  observer.observe(storyList, { childList: true });

  setToolbarEnabled(false);
  getOne('documents', RICH_DOC_ID).then(saved => {
    if (saved?.items && typeof saved.items === 'object') richDoc = saved;
    upgradeStory();
  }).catch(() => upgradeStory());
}
