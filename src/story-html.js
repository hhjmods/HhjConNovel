import { getAll, getOne } from './db.js';

export const BREAK_SENTINEL = '\uE000HHJCON_BREAK\uE001';
export const IMAGE_SENTINEL = '\uE000HHJCON_IMAGE_PLACEHOLDER\uE001';
export const IMAGE_PLACEHOLDER_TEXT = '【이미지 자료 삽입 위치 - 이 문구를 지우고 이미지를 첨부하세요】';

const RICH_DOC_ID = 'rich-text-v1';
const CON_DISPLAY_DOC_ID = 'con-display-v1';
const BREAK_COUNT_DOC_ID = 'break-count-v1';
const IMAGE_MEMO_DOC_ID = 'image-marker-memo-v1';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[char]);
}

function escapeAttr(value) {
  return escapeHtml(value);
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
      html: editor.innerHTML
    };
  }
  const saved = richDoc?.items?.[item.id];
  if (saved?.html && saved.text === source) return { text: source, html: saved.html };
  return { text: source, html: escapeHtml(source).replace(/\n/g, '<br>') };
}

function wrapDialogue(html) {
  const value = String(html || '');
  if (!value) return '<p><br></p>';
  const template = document.createElement('template');
  template.innerHTML = value;
  const hasTopBlock = [...template.content.childNodes].some(node =>
    node.nodeType === Node.ELEMENT_NODE && ['P', 'DIV'].includes(node.tagName)
  );
  return hasTopBlock ? value : `<p>${value}</p>`;
}

function conHtml(item, con, big) {
  const src = con?.imageUrl || con?.thumbnailUrl || '';
  if (!src) return `<span data-hhjcon-missing="${escapeAttr(item.conId)}">【미보유/미동기화 콘】</span>`;
  const sourceNo = String(con?.sourceNo || '');
  const className = big ? 'written_dccon bigdccon' : 'written_dccon';
  const attr = escapeAttr(sourceNo);
  return `<img class="${className}" src="${escapeAttr(src)}" conalt="${attr}" alt="${attr}" con_alt="${attr}" title="${attr}">`;
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

  const flushCons = () => {
    if (!conBuffer.length) return;
    htmlParts.push(`<p>${conBuffer.join('')}</p>`);
    conBuffer = [];
  };

  for (const item of items) {
    const row = rowFor(root, item.id);
    if (item.type === 'con') {
      conCount += 1;
      const big = row?.classList.contains('story-con-big') || Boolean(displayDoc?.items?.[item.id]?.big);
      conBuffer.push(conHtml(item, consById.get(item.conId), big));
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
    htmlParts.push(wrapDialogue(dialogue.html));
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
    imageCount
  };
}
