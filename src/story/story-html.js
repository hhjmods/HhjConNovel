import { getAll, getOne } from '../db.js';
import { copySafeStyle, sanitizeRichHtml } from './rich-html.js?v=20260914-1';
import { buildDcConHtml, escapeHtml, estimateDcHtmlCharCount, validDcConSource } from './story-html-utils.js?v=20260912-3';

export const BREAK_SENTINEL = '\uE000HHJCON_BREAK\uE001';
export const IMAGE_SENTINEL = '\uE000HHJCON_IMAGE_PLACEHOLDER\uE001';
export const IMAGE_PLACEHOLDER_TEXT = '【이미지 자료 삽입 위치 - 이 문구를 지우고 이미지를 첨부하세요】';

const RICH_DOC_ID = 'rich-text-v1';
const CON_DISPLAY_DOC_ID = 'con-display-v1';
const BREAK_COUNT_DOC_ID = 'break-count-v1';
const IMAGE_MEMO_DOC_ID = 'image-marker-memo-v1';

function replaceLiteralNewlines(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const targets = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!/[\r\n]/.test(node.data)) continue;
    if (node.parentNode === root && !node.data.trim()) continue;
    targets.push(node);
  }

  targets.forEach(node => {
    const parts = node.data.replace(/\r\n?/g, '\n').split('\n');
    const fragment = document.createDocumentFragment();
    parts.forEach((part, index) => {
      if (index) fragment.append(document.createElement('br'));
      if (part) fragment.append(document.createTextNode(part));
    });
    node.replaceWith(fragment);
  });
}

function normalizeDialogueHtml(html) {
  const clean = sanitizeRichHtml(html);
  if (!clean) return '<p><br></p>';

  const template = document.createElement('template');
  template.innerHTML = clean;
  replaceLiteralNewlines(template.content);
  const nodes = [...template.content.childNodes];
  const hasTopBlock = nodes.some(node =>
    node.nodeType === Node.ELEMENT_NODE && ['P', 'DIV'].includes(node.tagName)
  );
  if (!hasTopBlock) return `<p>${template.innerHTML}</p>`;

  const output = document.createElement('div');
  let paragraph = null;
  let paragraphStyleKey = null;
  let lineStarted = false;

  const flushParagraph = () => {
    if (!paragraph) return;
    if (!paragraph.childNodes.length) paragraph.append(document.createElement('br'));
    output.append(paragraph);
    paragraph = null;
    paragraphStyleKey = null;
    lineStarted = false;
  };

  const ensureParagraph = styleSource => {
    const styleKey = styleSource?.getAttribute?.('style') || '';
    if (paragraph && paragraphStyleKey === styleKey) return;
    flushParagraph();
    paragraph = document.createElement('p');
    paragraphStyleKey = styleKey;
    if (styleSource) copySafeStyle(styleSource, paragraph);
  };

  const isEmptyBlockPlaceholder = block => {
    const significant = [...block.childNodes].filter(node =>
      !(node.nodeType === Node.TEXT_NODE && !node.data.trim())
    );
    if (!significant.length) return true;
    return significant.length === 1
      && significant[0].nodeType === Node.ELEMENT_NODE
      && significant[0].tagName === 'BR';
  };

  nodes.forEach(node => {
    const isBlock = node.nodeType === Node.ELEMENT_NODE && ['P', 'DIV'].includes(node.tagName);
    if (isBlock) {
      ensureParagraph(node);
      if (lineStarted) paragraph.append(document.createElement('br'));
      lineStarted = true;
      if (!isEmptyBlockPlaceholder(node)) {
        [...node.childNodes].forEach(child => paragraph.append(child.cloneNode(true)));
      }
      return;
    }

    if (node.nodeType === Node.TEXT_NODE && !node.data.trim()) return;
    ensureParagraph(null);
    paragraph.append(node.cloneNode(true));
    lineStarted = true;
  });
  flushParagraph();

  return output.innerHTML || '<p><br></p>';
}

function rowFor(root, storyId) {
  if (!root || !storyId) return null;
  return root.querySelector(`:scope > .story-item[data-story-id="${CSS.escape(storyId)}"]`);
}

function breakCountFor(row, breakDoc, storyId) {
  const liveInput = row?.querySelector('.story-break-count-input');
  const live = Number(liveInput?.value || row?.dataset.breakCount);
  if (Number.isInteger(live) && live >= 1) return live;
  const saved = Number(breakDoc?.items?.[storyId]?.count);
  return Number.isInteger(saved) && saved >= 1 ? saved : 1;
}

function imageMemoFor(row, memoDoc, storyId) {
  const liveInput = row?.querySelector('.story-image-memo-input');
  if (liveInput) return String(liveInput.value || '').trim();
  return String(memoDoc?.items?.[storyId]?.text || '').trim();
}

function dialogueFor(row, item, richDoc) {
  const source = row?.querySelector('textarea')?.value ?? String(item.text || '');
  const editor = row?.querySelector('.rich-text-editor');
  if (editor) {
    return {
      text: editor.innerText.replace(/\r\n?/g, '\n'),
      html: sanitizeRichHtml(editor.innerHTML)
    };
  }
  const saved = richDoc?.items?.[item.id];
  if (saved?.html && saved.text === source) return { text: source, html: sanitizeRichHtml(saved.html) };
  return { text: source, html: escapeHtml(source).replace(/\n/g, '<br>') };
}

export async function buildStoryHtmlSnapshot(root = document.getElementById('storyList')) {
  const [story, cons, richDoc, displayDoc, breakDoc, memoDoc] = await Promise.all([
    getOne('documents', 'current'),
    getAll('cons'),
    getOne('documents', RICH_DOC_ID),
    getOne('documents', CON_DISPLAY_DOC_ID),
    getOne('documents', BREAK_COUNT_DOC_ID),
    getOne('documents', IMAGE_MEMO_DOC_ID)
  ]);

  const items = Array.isArray(story?.items) ? story.items : [];
  const consById = new Map(cons.map(con => [con.id, con]));
  const htmlParts = [];
  let conBuffer = [];
  let textCharCount = 0;
  let conCount = 0;
  let dialogueCount = 0;
  let breakCount = 0;
  let imageCount = 0;
  let imageMarkerHtmlLength = 0;
  let missingConCount = 0;

  const flushCons = () => {
    if (!conBuffer.length) return;
    htmlParts.push(`<p>${conBuffer.join('')}</p>`);
    conBuffer = [];
  };

  for (const item of items) {
    const row = rowFor(root, item.id);
    if (item.type === 'con') {
      conCount += 1;
      const con = consById.get(item.conId);
      const big = row?.classList.contains('story-con-big') || Boolean(displayDoc?.items?.[item.id]?.big);
      if (!validDcConSource(con?.imageUrl || con?.thumbnailUrl || '')) missingConCount += 1;
      conBuffer.push(buildDcConHtml(item, con, big));
      continue;
    }

    flushCons();
    if (item.type !== 'text') continue;
    const source = row?.querySelector('textarea')?.value ?? String(item.text || '');

    if (source === BREAK_SENTINEL) {
      const count = breakCountFor(row, breakDoc, item.id);
      breakCount += count;
      for (let index = 0; index < count; index += 1) htmlParts.push('<p><br></p>');
      continue;
    }

    if (source === IMAGE_SENTINEL) {
      imageCount += 1;
      const memo = imageMemoFor(row, memoDoc, item.id);
      const marker = `<span style="font-size:32px;color:#ff0000;background-color:#ffff00;font-weight:700;">${escapeHtml(IMAGE_PLACEHOLDER_TEXT)}</span>`;
      const memoHtml = memo
        ? `<br><span style="color:#ff0000;background-color:#ffff00;font-weight:700;">${escapeHtml(memo)}</span>`
        : '';
      const markerHtml = `<p>${marker}${memoHtml}</p>`;
      htmlParts.push(markerHtml);
      imageMarkerHtmlLength += markerHtml.length;
      continue;
    }

    dialogueCount += 1;
    const dialogue = dialogueFor(row, item, richDoc);
    textCharCount += dialogue.text.length;
    htmlParts.push(normalizeDialogueHtml(dialogue.html));
  }

  flushCons();
  const html = htmlParts.join('\n');
  const dcHtmlCharCount = estimateDcHtmlCharCount(
    htmlParts.join(''),
    conCount - missingConCount,
    imageMarkerHtmlLength,
    imageCount
  );
  return {
    html,
    textCharCount,
    htmlCharCount: html.length,
    dcHtmlCharCount,
    conCount,
    dialogueCount,
    breakCount,
    imageCount,
    missingConCount
  };
}
