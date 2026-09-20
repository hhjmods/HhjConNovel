import { getOne, putOne } from '../db.js';
import { sanitizeRichHtml as sanitizeHtml } from './rich-html.js?v=20260914-1';
import { STORY_BLOCKS_PASTED_EVENT } from './story-block-clipboard.js?v=20260921-1';

const BREAK_SENTINEL = '\uE000HHJCON_BREAK\uE001';
const RICH_DOC_ID = 'rich-text-v1';
const RICH_EDITORS_RENDERED_EVENT = 'hhjcon:rich-editors-rendered';
const storyList = document.getElementById('storyList');
const editorPanel = document.querySelector('.editor-panel');
const editorHeader = editorPanel?.querySelector('.editor-header');

if (storyList && editorPanel && editorHeader) {
  let richDoc = { id: RICH_DOC_ID, version: 1, items: {}, updatedAt: Date.now() };
  let richDocLoaded = false;
  let saveTimer = null;
  let activeEditor = null;
  let activeRow = null;
  let savedRange = null;
  let resolveRichDocReady;
  const richDocReady = new Promise(resolve => { resolveRichDocReady = resolve; });

  const toolbar = document.createElement('div');
  toolbar.className = 'text-format-toolbar';
  const colorResetIcon = `<svg class="format-color-reset-icon" viewBox="0 0 24 18" aria-hidden="true" focusable="false" shape-rendering="geometricPrecision"><rect x="0.75" y="0.75" width="22.5" height="16.5" rx="0.5" fill="#fff" stroke="#d92332" stroke-width="1.5"/><path d="M1.5 1.5 22.5 16.5" fill="none" stroke="#d92332" stroke-width="1.5" stroke-linecap="round"/></svg>`;
  const alignPaths = {
    left: 'M2 4h16 M2 9h10 M2 14h14',
    center: 'M2 4h16 M5 9h10 M3 14h14',
    right: 'M2 4h16 M8 9h10 M4 14h14'
  };
  const alignIcon = side => `<svg viewBox="0 0 20 18" aria-hidden="true" focusable="false"><path d="${alignPaths[side]}"/></svg>`;
  toolbar.innerHTML = `
    <select data-format="font" aria-label="글꼴" title="글꼴">
      <option value="">글꼴</option>
      <option value="Malgun Gothic" style="font-family:'Malgun Gothic'">맑은 고딕</option>
      <option value="GulimChe" style="font-family:GulimChe">굴림체</option>
      <option value="Gulim" style="font-family:Gulim">굴림</option>
      <option value="BatangChe" style="font-family:BatangChe">바탕체</option>
      <option value="Batang" style="font-family:Batang">바탕</option>
      <option value="Gungsuh" style="font-family:Gungsuh">궁서</option>
      <option value="NanumGothic" style="font-family:NanumGothic">나눔고딕</option>
      <option value="NanumMyeongjo" style="font-family:NanumMyeongjo">나눔명조</option>
      <option value="NanumSquare" style="font-family:NanumSquare">나눔스퀘어</option>
      <option value="Helvetica" style="font-family:Helvetica">helvetica</option>
      <option value="Arial" style="font-family:Arial">Arial</option>
      <option value="Arial Black" style="font-family:'Arial Black'">Arial Black</option>
      <option value="Comic Sans MS" style="font-family:'Comic Sans MS'">Comic Sans MS</option>
      <option value="Courier New" style="font-family:'Courier New'">Courier New</option>
      <option value="Impact" style="font-family:Impact">Impact</option>
      <option value="Tahoma" style="font-family:Tahoma">Tahoma</option>
      <option value="Times New Roman" style="font-family:'Times New Roman'">Times New Roman</option>
      <option value="Verdana" style="font-family:Verdana">Verdana</option>
      <option value="MS Gothic" style="font-family:'MS Gothic'">MS Gothic</option>
      <option value="MS PGothic" style="font-family:'MS PGothic'">MS PGothic</option>
      <option value="MS UI Gothic" style="font-family:'MS UI Gothic'">MS UI Gothic</option>
    </select>
    <select data-format="size" aria-label="크기" title="글자 크기">
      <option value="">크기</option>
      <option value="8px">8</option>
      <option value="9px">9</option>
      <option value="10px">10</option>
      <option value="11px">11</option>
      <option value="12px">12</option>
      <option value="14px">14</option>
      <option value="16px">16</option>
      <option value="18px">18</option>
      <option value="20px">20</option>
      <option value="22px">22</option>
      <option value="24px">24</option>
      <option value="28px">28</option>
      <option value="30px">30</option>
      <option value="36px">36</option>
      <option value="50px">50</option>
      <option value="72px">72</option>
      <option value="96px">96</option>
    </select>
    <span class="format-color"><button type="button" data-color-apply="color" title="현재 글자색 적용">글자색</button><span class="format-color-chip"><input data-format="color" type="color" value="#e8edf5" aria-label="글자색 선택" title="글자색 선택">${colorResetIcon}</span></span>
    <span class="format-color"><button type="button" data-color-apply="background" title="현재 배경색 적용">배경색</button><span class="format-color-chip"><input data-format="background" type="color" value="#27344f" aria-label="배경색 선택" title="배경색 선택">${colorResetIcon}</span></span>
    <button type="button" class="format-toggle" data-command="bold" title="굵게"><strong>B</strong></button>
    <button type="button" class="format-toggle" data-command="italic" title="기울임"><em>I</em></button>
    <button type="button" class="format-toggle" data-command="underline" title="밑줄"><u>U</u></button>
    <button type="button" class="format-toggle" data-command="strikeThrough" title="취소선"><s>S</s></button>
    <span class="format-align">
      <button type="button" data-action="toggle-align-menu" aria-haspopup="menu" aria-expanded="false" aria-label="문단 정렬" title="문단 정렬">${alignIcon('left')}<span aria-hidden="true">▾</span></button>
      <span class="format-align-menu" role="menu" popover="manual">
        <button type="button" data-command="justifyLeft" role="menuitem" aria-label="왼쪽 정렬" title="왼쪽 정렬">${alignIcon('left')}</button>
        <button type="button" data-command="justifyCenter" role="menuitem" aria-label="가운데 정렬" title="가운데 정렬">${alignIcon('center')}</button>
        <button type="button" data-command="justifyRight" role="menuitem" aria-label="오른쪽 정렬" title="오른쪽 정렬">${alignIcon('right')}</button>
      </span>
    </span>
    <button type="button" data-action="remove-format">서식 초기화</button>
  `;
  editorPanel.insertBefore(toolbar, editorHeader.nextSibling);

  const controls = [...toolbar.querySelectorAll('button, select, input')];
  const fontSelect = toolbar.querySelector('[data-format="font"]');
  const sizeSelect = toolbar.querySelector('[data-format="size"]');
  const colorInput = toolbar.querySelector('[data-format="color"]');
  const backgroundInput = toolbar.querySelector('[data-format="background"]');
  const alignMenu = toolbar.querySelector('.format-align-menu');
  const alignMenuTrigger = toolbar.querySelector('[data-action="toggle-align-menu"]');

  function setAlignMenuOpen(open) {
    if (!open) {
      if (alignMenu.matches(':popover-open')) alignMenu.hidePopover();
      alignMenuTrigger.setAttribute('aria-expanded', 'false');
      return;
    }
    alignMenu.showPopover();
    const triggerRect = alignMenuTrigger.getBoundingClientRect();
    const width = alignMenu.offsetWidth;
    const height = alignMenu.offsetHeight;
    const left = Math.max(8, Math.min(triggerRect.left, window.innerWidth - width - 8));
    let top = triggerRect.bottom + 5;
    if (top + height > window.innerHeight - 8) top = Math.max(8, triggerRect.top - height - 5);
    alignMenu.style.left = `${Math.round(left)}px`;
    alignMenu.style.top = `${Math.round(top)}px`;
    alignMenuTrigger.setAttribute('aria-expanded', String(open));
  }

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

  document.addEventListener(STORY_BLOCKS_PASTED_EVENT, event => {
    if (!Array.isArray(event.detail?.tasks)) return;
    const entries = event.detail?.entries || [];
    const apply = () => {
      let changed = false;
      entries.forEach(entry => {
        const rich = entry?.metadata?.rich;
        if (!entry?.storyId || !rich || typeof rich.text !== 'string' || typeof rich.html !== 'string') return;
        richDoc.items[entry.storyId] = {
          text: rich.text,
          html: sanitizeHtml(rich.html),
          updatedAt: Date.now()
        };
        changed = true;
      });
      return changed ? flushSave() : Promise.resolve();
    };
    event.detail.tasks.push(richDocLoaded ? apply() : richDocReady.then(apply));
  });

  function plainToHtml(text) {
    const box = document.createElement('div');
    const parts = String(text || '').split('\n');
    parts.forEach((part, index) => {
      if (index) box.append(document.createElement('br'));
      box.append(document.createTextNode(part));
    });
    return box.innerHTML;
  }

  function normalizePasteHtml(html, text) {
    const clean = sanitizeHtml(html);
    const plain = String(text || '').replace(/\r\n?/g, '\n').trim();
    if (plain.includes('\n')) return clean;
    const output = document.createElement('div');
    output.innerHTML = clean;
    output.querySelectorAll('br').forEach(lineBreak => lineBreak.remove());
    output.querySelectorAll('div, p').forEach(block => block.replaceWith(...block.childNodes));
    const walker = document.createTreeWalker(output, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    textNodes.forEach(node => {
      node.data = node.data.replace(/[ \t]*[\r\n]+[ \t]*/g, '');
      if (!node.data) node.remove();
    });
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
    if (document.activeElement !== fontSelect) {
      const fontNames = String(document.queryCommandValue('fontName') || '').replace(/["']/g, '').split(',').map(value => value.trim().toLowerCase());
      fontSelect.value = [...fontSelect.options].find(option => option.value && fontNames.includes(option.value.toLowerCase()))?.value || '';
    }
    if (document.activeElement === sizeSelect) return;
    const anchorNode = window.getSelection()?.anchorNode;
    const anchorElement = anchorNode?.nodeType === Node.ELEMENT_NODE ? anchorNode : anchorNode?.parentElement;
    const sizedElement = anchorElement?.closest('font[size], [style*="font-size"]');
    if (!sizedElement || !activeEditor.contains(sizedElement)) {
      const pendingSize = activeEditor.dataset.fontSizePx;
      if (pendingSize && String(document.queryCommandValue('fontSize')) === '7') {
        sizeSelect.value = pendingSize;
        return;
      }
      delete activeEditor.dataset.fontSizePx;
      sizeSelect.value = '12px';
      return;
    }
    const pixelSize = Math.round(parseFloat(getComputedStyle(sizedElement).fontSize));
    const pixelOption = `${pixelSize}px`;
    sizeSelect.value = [...sizeSelect.options].some(option => option.value === pixelOption) ? pixelOption : '';
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

  function clearRepeatedAlignment(command) {
    if (!savedRange || savedRange.collapsed || !restoreSelection()) return false;
    const range = window.getSelection().getRangeAt(0);
    const alignment = command.slice('justify'.length).toLowerCase();
    const texts = document.createTreeWalker(activeEditor, NodeFilter.SHOW_TEXT);
    while (texts.nextNode()) {
      const node = texts.currentNode;
      if (node.textContent.trim() && range.intersectsNode(node)
        && getComputedStyle(node.parentElement).textAlign !== alignment) return false;
    }
    const aligned = [activeEditor, ...activeEditor.querySelectorAll('[style*="text-align"]')]
      .filter(element => element.style.textAlign === alignment && range.intersectsNode(element));
    if (!aligned.length) return false;
    aligned.forEach(element => {
      element.style.removeProperty('text-align');
      if (!element.getAttribute('style')?.trim()) element.removeAttribute('style');
    });
    activeEditor.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
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
      if (html) document.execCommand('insertHTML', false, normalizePasteHtml(html, text));
      else document.execCommand('insertText', false, text);
    });
    editor.addEventListener('blur', () => { flushSave(); });

    textarea.addEventListener('input', () => {
      if (textarea.value !== BREAK_SENTINEL) return;
      removeEditorForBreak(row, textarea);
      storyList.dispatchEvent(new Event(RICH_EDITORS_RENDERED_EVENT));
    });
  }

  function upgradeStory() {
    if (!richDocLoaded) return;
    storyList.querySelectorAll(':scope > .story-text').forEach(upgradeRow);
    storyList.dispatchEvent(new Event(RICH_EDITORS_RENDERED_EVENT));
  }

  toolbar.addEventListener('pointerdown', event => {
    if (!activeEditor) return;
    captureSelection();
    if (event.target.closest('button')) event.preventDefault();
  });

  toolbar.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button || !activeEditor) return;
    if (button === alignMenuTrigger) {
      setAlignMenuOpen(!alignMenu.matches(':popover-open'));
      return;
    }
    const command = button.dataset.command;
    if (command) {
      if (!command.startsWith('justify') || !clearRepeatedAlignment(command)) runCommand(command);
      if (command.startsWith('justify')) setAlignMenuOpen(false);
      return;
    }
    if (button.dataset.action === 'remove-format') runCommand('removeFormat');
  });

  document.addEventListener('pointerdown', event => {
    if (!event.target.closest('.format-align')) setAlignMenuOpen(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') setAlignMenuOpen(false);
  });
  window.addEventListener('resize', () => setAlignMenuOpen(false));
  window.addEventListener('scroll', () => setAlignMenuOpen(false), true);

  fontSelect.addEventListener('change', () => {
    if (fontSelect.value) runCommand('fontName', fontSelect.value);
  });
  colorInput.addEventListener('input', () => runCommand('foreColor', colorInput.value));
  backgroundInput.addEventListener('input', () => runCommand('backColor', backgroundInput.value));

  document.addEventListener('selectionchange', () => {
    if (activeEditor && selectionInside(activeEditor)) captureSelection();
  });

  document.addEventListener('hhjcon:story-rendered', () => queueMicrotask(upgradeStory));

  setToolbarEnabled(false);
  getOne('documents', RICH_DOC_ID).then(saved => {
    if (saved?.items && typeof saved.items === 'object') richDoc = saved;
    richDocLoaded = true;
    resolveRichDocReady();
    upgradeStory();
  }).catch(() => {
    richDocLoaded = true;
    resolveRichDocReady();
    upgradeStory();
  });
}
