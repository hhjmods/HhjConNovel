import { pasteStoryBlockClipboardPayload, selectedStoryItemsForClipboard } from '../app.js?v=20260921-1';
import {
  createStoryBlockClipboardPayload,
  parseStoryBlockClipboardPayload,
  STORY_BLOCK_CLIPBOARD_MIME
} from '../story/story-block-clipboard.js?v=20260921-1';
import { BREAK_SENTINEL, IMAGE_SENTINEL } from '../story/story-html.js?v=20260914-1';
import { showToast } from './toast.js?v=20260909-2';

const storyList = document.getElementById('storyList');

if (storyList) {
  function editingText(target) {
    return target instanceof Element && Boolean(target.closest('input, textarea, [contenteditable="true"]'));
  }

  function rowFor(storyId) {
    return [...storyList.querySelectorAll(':scope > .story-item[data-story-id]')]
      .find(row => row.dataset.storyId === storyId) || null;
  }

  function metadataFor(storyId, item) {
    const row = rowFor(storyId);
    if (!row) return {};
    const metadata = {};
    const editor = row.querySelector(':scope > .rich-text-editor');
    if (editor) {
      metadata.rich = { text: String(item.text ?? ''), html: editor.innerHTML };
      const height = Number.parseFloat(editor.style.height);
      if (Number.isFinite(height)) metadata.height = height;
    }
    const breakCount = Number(row.querySelector('.story-break-count-input')?.value || row.dataset.breakCount);
    if (row.classList.contains('story-break') && Number.isSafeInteger(breakCount) && breakCount >= 1) {
      metadata.breakCount = breakCount;
    }
    const memo = row.querySelector('.story-image-memo-input')?.value;
    if (row.classList.contains('story-image-placeholder') && typeof memo === 'string' && memo.trim()) {
      metadata.imageMemo = memo;
    }
    if (row.classList.contains('story-con-big')) metadata.big = true;
    return metadata;
  }

  function plainTextFor(payload) {
    return payload.blocks.map(block => {
      if (block.item.type === 'con') return '[디시콘]';
      if (block.item.text === BREAK_SENTINEL) return `[줄바꿈 ${block.metadata.breakCount || 1}줄]`;
      if (block.item.text === IMAGE_SENTINEL) {
        return block.metadata.imageMemo ? `[이미지 마커: ${block.metadata.imageMemo}]` : '[이미지 마커]';
      }
      return block.item.text;
    }).join('\n');
  }

  function payloadFromClipboard(clipboardData) {
    let direct = '';
    try { direct = clipboardData.getData(STORY_BLOCK_CLIPBOARD_MIME); } catch { /* HTML fallback을 사용한다. */ }
    if (direct) return parseStoryBlockClipboardPayload(direct);
    const html = clipboardData.getData('text/html');
    if (!html) return null;
    const template = document.createElement('template');
    template.innerHTML = html;
    const encoded = template.content.querySelector('[data-hhjcon-story-blocks]')?.dataset.hhjconStoryBlocks;
    if (!encoded) return null;
    try { return parseStoryBlockClipboardPayload(decodeURIComponent(encoded)); } catch { return null; }
  }

  document.addEventListener('copy', event => {
    if (!event.clipboardData || editingText(event.target) || editingText(document.activeElement)
      || document.querySelector('dialog[open]')) return;
    const items = selectedStoryItemsForClipboard();
    const payload = createStoryBlockClipboardPayload(items, items.map(item => item.id), metadataFor);
    if (!payload) return;

    const serialized = JSON.stringify(payload);
    const plain = plainTextFor(payload);
    const wrapper = document.createElement('div');
    wrapper.dataset.hhjconStoryBlocks = encodeURIComponent(serialized);
    wrapper.textContent = plain;
    event.preventDefault();
    event.clipboardData.setData('text/plain', plain);
    event.clipboardData.setData('text/html', wrapper.outerHTML);
    try { event.clipboardData.setData(STORY_BLOCK_CLIPBOARD_MIME, serialized); } catch { /* HTML fallback을 사용한다. */ }
    showToast(`${payload.blocks.length}개 원고 블록을 복사했습니다.`, 1400);
  });

  document.addEventListener('paste', event => {
    if (!event.clipboardData || editingText(event.target) || editingText(document.activeElement)
      || document.querySelector('dialog[open]') || document.querySelector('.editor-panel.html-preview-mode')) return;
    const payload = payloadFromClipboard(event.clipboardData);
    if (!payload) return;
    event.preventDefault();
    pasteStoryBlockClipboardPayload(payload)
      .then(count => { if (count) showToast(`${count}개 원고 블록을 붙여넣었습니다.`, 1400); })
      .catch(error => {
        console.error('Story block paste failed', error);
        showToast('원고 블록을 붙여넣지 못했습니다.', 1800);
      });
  });
}
