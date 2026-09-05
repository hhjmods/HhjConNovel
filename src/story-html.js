import { getAll, getOne } from './db.js';

export const BREAK_SENTINEL = '\uE000HHJCON_BREAK\uE001';
export const IMAGE_SENTINEL = '\uE000HHJCON_IMAGE_PLACEHOLDER\uE001';
export const IMAGE_PLACEHOLDER_TEXT = '【이미지 자료 삽입 위치 - 이 문구를 지우고 이미지를 첨부하세요】';

const RICH_DOC_ID = 'rich-text-v1';
const CON_DISPLAY_DOC_ID = 'con-display-v1';
const BREAK_COUNT_DOC_ID = 'break-count-v1';
const IMAGE_MEMO_DOC_ID = 'image-marker-memo-v1';
const FONT_SIZE_MAP = { '1': '10px', '2': '12px', '3': '14px', '4': '18px', '5': '24px', '6': '32px', '7': '48px' };
const ALLOWED_RICH_TAGS = new Set(['SPAN', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'DIV', 'P']);
const BLOCKED_RICH_TAGS = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META']);
const ALLOWED_STYLE_PROPS = [
  'color', 'backgroundColor', 'fontFamily', 'fontSize', 'fontWeight',
  'fontStyle', 'textDecoration', 'textDecorationLine', 'textAlign'
];

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[char]);
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function copySafeStyle(source, target) {
  const style = source?.style;
  if (!style) return;
  ALLOWED_STYLE_PROPS.forEach(prop => {
    const value = style[prop];
    if (!value || /(?:javascript\s*:|expression\s*\(|url\s*\()/i.test(value)) return;
    target.style[prop] = value;
  });
}

function sanitizeRichHtml(html) {
  const template = document.createElement('template');
  template.innerHTML = String(html || '');
  const output = document.createElement('div');

  function appendClean(node, parent) {
    if (node.nodeType === Node.TEXT_NODE) {
      parent.append(document.createTextNode(node.data));
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = node.tagName;
    if (BLOCKED_RICH_TAGS.has(tag)) return;
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
      if (FONT_SIZE_MAP[size]) span.style.fontSize = FONT_SIZE_MAP[size];
      copySafeStyle(node, span);
      [...node.childNodes].forEach(child => appendClean(child, span));
      parent.append(span);
      return;
    }
    if (!ALLOWED_RICH_TAGS.has(tag)) {
      [...node.childNodes].forEach(child => appendClean(child, parent));
      return;
    }
    const clean = document.createElement(tag.toLowerCase());
    copySafeStyle(node, clean);
    [...node.childNodes].forEach(child => appendClean(child, clean));
    parent.append(clean);
  }

  [...template.content.childNodes].forEach(node => appendClean(node, output));
  return output.innerHTML;
}

function normalizeDialogueHtml(html) {
  const clean = sanitizeRichHtml(html);
  if (!clean) return '<p><br></p>';

  const template = document.createElement('template');
  template.innerHTML = clean;
  const nodes = [...template.content.childNodes];
  const hasTopBlock = nodes.some(node =>
    node.nodeType === Node.ELEMENT_NODE && ['P', 'DIV'].includes(node.tagName)
  );
  if (!hasTopBlock) return `<p>${clean}</p>`;

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

function validDcConSource(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:'
      && url.hostname === 'dcimg5.dcinside.com'
      && url.pathname === '/dccon.php'
      && Boolean(url.searchParams.get('no'))
      ? url.href
      : '';
  } catch {
    return '';
  }
}

function validDetailId(value) {
  const detailId = String(value ?? '').trim();
  return /^\d+$/.test(detailId) ? detailId : '';
}

function conHtml(item, con, big) {
  const src = validDcConSource(con?.imageUrl || con?.thumbnailUrl || '');
  if (!src) {
    return '<span style="color:#ff0000;background-color:#ffff00;font-weight:700;">【미보유/미동기화 디시콘】</span>';
  }
  const detailId = validDetailId(con?.detailId);
  if (!detailId) {
    return '<span style="color:#ff0000;background-color:#ffff00;font-weight:700;">【디시콘 게시정보 없음 - DC 재동기화 필요】</span>';
  }
  const label = String(con?.name || con?.sourceNo || item.conId || '디시콘');
  const className = big ? 'written_dccon bigdccon' : 'written_dccon ';
  const attr = escapeAttr(label);
  return `<img class="${className}" src="${escapeAttr(src)}" conalt="${attr}" alt="${attr}" con_alt="${attr}" title="${attr}" detail="${escapeAttr(detailId)}">`;
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
      if (!validDcConSource(con?.imageUrl || con?.thumbnailUrl || '') || !validDetailId(con?.detailId)) missingConCount += 1;
      conBuffer.push(conHtml(item, con, big));
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
      htmlParts.push(`<p>${marker}${memoHtml}</p>`);
      continue;
    }

    dialogueCount += 1;
    const dialogue = dialogueFor(row, item, richDoc);
    textCharCount += dialogue.text.length;
    htmlParts.push(normalizeDialogueHtml(dialogue.html));
  }

  flushCons();
  const html = htmlParts.join('\n');
  return {
    html,
    textCharCount,
    htmlCharCount: html.length,
    conCount,
    dialogueCount,
    breakCount,
    imageCount,
    missingConCount
  };
}
