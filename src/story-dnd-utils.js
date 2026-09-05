export const CON_IDS_MIME = 'application/x-hhjcon-ids';
export const STORY_IDS_MIME = 'application/x-hhjstory-ids';
export const STORY_BLOCK_MIME = 'application/x-hhjstory-block';

export function transferHasType(dataTransfer, type) {
  return Boolean(dataTransfer?.types?.includes(type));
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
