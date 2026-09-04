const STORAGE_KEY = 'hhjcon-story-text-formats-v1';

const toolbar = document.getElementById('textFormatToolbar');
const fontFamily = document.getElementById('textFontFamily');
const fontSize = document.getElementById('textFontSize');
const textColor = document.getElementById('textColor');
const textBgColor = document.getElementById('textBgColor');
const boldBtn = document.getElementById('textBoldBtn');
const italicBtn = document.getElementById('textItalicBtn');
const underlineBtn = document.getElementById('textUnderlineBtn');
const strikeBtn = document.getElementById('textStrikeBtn');
const alignLeftBtn = document.getElementById('textAlignLeftBtn');
const alignCenterBtn = document.getElementById('textAlignCenterBtn');
const alignRightBtn = document.getElementById('textAlignRightBtn');
const clearBgBtn = document.getElementById('textClearBgBtn');
const resetBtn = document.getElementById('textFormatResetBtn');

let activeTextarea = null;
let activeStoryId = null;
let formats = loadFormats();

function loadFormats() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveFormats() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(formats));
}

function controls() {
  return toolbar ? [...toolbar.querySelectorAll('button, select, input')] : [];
}

function setEnabled(enabled) {
  controls().forEach(control => { control.disabled = !enabled; });
}

function normalizeDecoration(value) {
  return String(value || '').split(/\s+/).filter(Boolean);
}

function getFormat(id) {
  return formats[id] || {};
}

function setFormat(patch) {
  if (!activeTextarea || !activeStoryId) return;
  const current = getFormat(activeStoryId);
  const next = { ...current, ...patch };
  Object.keys(next).forEach(key => {
    if (next[key] == null || next[key] === '') delete next[key];
  });
  formats[activeStoryId] = next;
  saveFormats();
  applyFormat(activeTextarea, next);
  syncControls();
}

function applyFormat(textarea, format) {
  textarea.style.fontFamily = format.fontFamily || '';
  textarea.style.fontSize = format.fontSize || '';
  textarea.style.color = format.color || '';
  textarea.style.backgroundColor = format.backgroundColor || '';
  textarea.style.fontWeight = format.fontWeight || '';
  textarea.style.fontStyle = format.fontStyle || '';
  textarea.style.textDecorationLine = format.textDecorationLine || '';
  textarea.style.textAlign = format.textAlign || '';
}

function syncControls() {
  const format = activeStoryId ? getFormat(activeStoryId) : {};
  if (fontFamily) fontFamily.value = format.fontFamily || '';
  if (fontSize) fontSize.value = format.fontSize || '';
  if (textColor) textColor.value = normalizeHexColor(format.color, '#e8edf5');
  if (textBgColor) textBgColor.value = normalizeHexColor(format.backgroundColor, '#191f29');
  boldBtn?.classList.toggle('active', format.fontWeight === '700');
  italicBtn?.classList.toggle('active', format.fontStyle === 'italic');
  const decorations = normalizeDecoration(format.textDecorationLine);
  underlineBtn?.classList.toggle('active', decorations.includes('underline'));
  strikeBtn?.classList.toggle('active', decorations.includes('line-through'));
  alignLeftBtn?.classList.toggle('active', !format.textAlign || format.textAlign === 'left');
  alignCenterBtn?.classList.toggle('active', format.textAlign === 'center');
  alignRightBtn?.classList.toggle('active', format.textAlign === 'right');
}

function normalizeHexColor(value, fallback) {
  if (/^#[0-9a-f]{6}$/i.test(String(value || ''))) return value;
  return fallback;
}

function toggleDecoration(name) {
  const current = new Set(normalizeDecoration(getFormat(activeStoryId).textDecorationLine));
  if (current.has(name)) current.delete(name);
  else current.add(name);
  setFormat({ textDecorationLine: [...current].join(' ') });
}

function activateTextarea(textarea) {
  const row = textarea.closest('.story-item[data-story-id]');
  if (!row) return;
  activeTextarea = textarea;
  activeStoryId = row.dataset.storyId;
  setEnabled(true);
  applyFormat(textarea, getFormat(activeStoryId));
  syncControls();
}

function applyStoredFormats(root = document) {
  root.querySelectorAll?.('.story-text textarea').forEach(textarea => {
    const row = textarea.closest('.story-item[data-story-id]');
    if (row) applyFormat(textarea, getFormat(row.dataset.storyId));
  });
}

fontFamily?.addEventListener('change', () => setFormat({ fontFamily: fontFamily.value }));
fontSize?.addEventListener('change', () => setFormat({ fontSize: fontSize.value }));
textColor?.addEventListener('input', () => setFormat({ color: textColor.value }));
textBgColor?.addEventListener('input', () => setFormat({ backgroundColor: textBgColor.value }));
boldBtn?.addEventListener('click', () => setFormat({ fontWeight: getFormat(activeStoryId).fontWeight === '700' ? '' : '700' }));
italicBtn?.addEventListener('click', () => setFormat({ fontStyle: getFormat(activeStoryId).fontStyle === 'italic' ? '' : 'italic' }));
underlineBtn?.addEventListener('click', () => toggleDecoration('underline'));
strikeBtn?.addEventListener('click', () => toggleDecoration('line-through'));
alignLeftBtn?.addEventListener('click', () => setFormat({ textAlign: 'left' }));
alignCenterBtn?.addEventListener('click', () => setFormat({ textAlign: 'center' }));
alignRightBtn?.addEventListener('click', () => setFormat({ textAlign: 'right' }));
clearBgBtn?.addEventListener('click', () => setFormat({ backgroundColor: '' }));
resetBtn?.addEventListener('click', () => {
  if (!activeStoryId || !activeTextarea) return;
  delete formats[activeStoryId];
  saveFormats();
  applyFormat(activeTextarea, {});
  syncControls();
});

document.addEventListener('focusin', event => {
  const textarea = event.target.closest?.('.story-text textarea');
  if (textarea) activateTextarea(textarea);
});

const observer = new MutationObserver(records => {
  records.forEach(record => record.addedNodes.forEach(node => {
    if (node.nodeType === Node.ELEMENT_NODE) applyStoredFormats(node);
  }));
});
observer.observe(document.documentElement, { childList: true, subtree: true });

setEnabled(false);
applyStoredFormats();
