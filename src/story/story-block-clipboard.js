import { normalizeConRef } from './story-save-format.js?v=20260915-2';

export const STORY_BLOCK_CLIPBOARD_FORMAT = 'hhjcon-story-blocks';
export const STORY_BLOCK_CLIPBOARD_VERSION = 1;
export const STORY_BLOCK_CLIPBOARD_MIME = 'application/x-hhjcon-story-blocks+json';
export const STORY_BLOCKS_PASTED_EVENT = 'hhjcon:story-blocks-pasted';

const asObject = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};

function normalizeMetadata(value) {
  const source = asObject(value);
  const metadata = {};
  const rich = asObject(source.rich);
  if (typeof rich.text === 'string' && typeof rich.html === 'string') {
    metadata.rich = { text: rich.text, html: rich.html };
  }
  const breakCount = Number(source.breakCount);
  if (Number.isSafeInteger(breakCount) && breakCount >= 1) metadata.breakCount = breakCount;
  if (typeof source.imageMemo === 'string' && source.imageMemo.trim()) metadata.imageMemo = source.imageMemo;
  if (source.big === true) metadata.big = true;
  const height = Number(source.height);
  if (Number.isFinite(height)) metadata.height = Math.min(4000, Math.max(72, Math.round(height)));
  return metadata;
}

function normalizeBlock(value) {
  const source = asObject(value);
  const item = asObject(source.item);
  let normalizedItem = null;
  if (item.type === 'text') normalizedItem = { type: 'text', text: String(item.text ?? '') };
  if (item.type === 'con' && String(item.conId || '')) {
    const conRef = normalizeConRef(item.conRef);
    normalizedItem = { type: 'con', conId: String(item.conId), ...(conRef ? { conRef } : {}) };
  }
  return normalizedItem ? { item: normalizedItem, metadata: normalizeMetadata(source.metadata) } : null;
}

export function normalizeStoryBlockClipboardPayload(value) {
  const source = asObject(value);
  if (source.format !== STORY_BLOCK_CLIPBOARD_FORMAT || Number(source.version) !== STORY_BLOCK_CLIPBOARD_VERSION
    || !Array.isArray(source.blocks)) return null;
  const blocks = source.blocks.map(normalizeBlock).filter(Boolean);
  return blocks.length ? { format: STORY_BLOCK_CLIPBOARD_FORMAT, version: STORY_BLOCK_CLIPBOARD_VERSION, blocks } : null;
}

export function createStoryBlockClipboardPayload(items, selectedIds, metadataForId = () => ({})) {
  const selected = new Set([...(selectedIds || [])].map(String));
  const blocks = (Array.isArray(items) ? items : [])
    .filter(item => selected.has(String(item?.id || '')))
    .map(item => normalizeBlock({ item, metadata: metadataForId(String(item.id), item) }))
    .filter(Boolean);
  return blocks.length ? { format: STORY_BLOCK_CLIPBOARD_FORMAT, version: STORY_BLOCK_CLIPBOARD_VERSION, blocks } : null;
}

export function parseStoryBlockClipboardPayload(raw) {
  try {
    return normalizeStoryBlockClipboardPayload(typeof raw === 'string' ? JSON.parse(raw) : raw);
  } catch {
    return null;
  }
}

export function materializeStoryBlockClipboardPayload(value, makeId) {
  const payload = normalizeStoryBlockClipboardPayload(value);
  if (!payload || typeof makeId !== 'function') return { items: [], metadataEntries: [] };
  const items = [];
  const metadataEntries = [];
  payload.blocks.forEach(block => {
    const id = String(makeId() || '');
    if (!id) return;
    items.push({ id, ...structuredClone(block.item) });
    metadataEntries.push({ storyId: id, metadata: structuredClone(block.metadata) });
  });
  return { items, metadataEntries };
}
