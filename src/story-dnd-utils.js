export const CON_IDS_MIME = 'application/x-hhjcon-ids';
export const STORY_IDS_MIME = 'application/x-hhjstory-ids';
export const STORY_BLOCK_MIME = 'application/x-hhjstory-block';

function normalizeIds(ids) {
  return Array.isArray(ids) ? ids.filter(id => typeof id === 'string' && id) : [];
}

export function transferHasType(dataTransfer, type) {
  return Boolean(dataTransfer?.types?.includes(type));
}

export function readTransferIds(dataTransfer, type) {
  try {
    const raw = dataTransfer?.getData(type);
    return raw ? normalizeIds(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

export function writeConTransfer(dataTransfer, ids) {
  const normalized = normalizeIds(ids);
  if (!dataTransfer || !normalized.length) return false;
  dataTransfer.effectAllowed = 'copyMove';
  dataTransfer.setData(CON_IDS_MIME, JSON.stringify(normalized));
  dataTransfer.setData('text/plain', normalized.join('\n'));
  return true;
}

export function writeStoryTransfer(dataTransfer, ids, { block = false, plainText = false } = {}) {
  const normalized = normalizeIds(ids);
  if (!dataTransfer || !normalized.length) return false;
  dataTransfer.effectAllowed = 'move';
  dataTransfer.setData(STORY_IDS_MIME, JSON.stringify(normalized));
  if (block) dataTransfer.setData(STORY_BLOCK_MIME, '1');
  if (plainText) dataTransfer.setData('text/plain', normalized.join('\n'));
  return true;
}

export function hasStoryAreaPayload(dataTransfer) {
  return transferHasType(dataTransfer, CON_IDS_MIME) || transferHasType(dataTransfer, STORY_IDS_MIME);
}

export function storyAreaDropEffect(dataTransfer, forceStoryMove = false) {
  if (forceStoryMove || transferHasType(dataTransfer, STORY_IDS_MIME)) return 'move';
  if (transferHasType(dataTransfer, CON_IDS_MIME)) return 'copy';
  return 'none';
}

export function forwardDrop(target, dataTransfer) {
  if (!target || !dataTransfer) return false;
  const forwarded = new Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(forwarded, 'dataTransfer', { value: dataTransfer });
  return target.dispatchEvent(forwarded);
}
