import { STORY_BLOCK_MIME } from '../story-dnd-utils.js?v=20260906-2';

export const STORY_CREATE_MIME = 'application/x-hhjstory-create';

export function writeStoryCreateTransfer(dataTransfer, text) {
  if (!dataTransfer) return false;
  dataTransfer.effectAllowed = 'copy';
  dataTransfer.setData(STORY_CREATE_MIME, JSON.stringify({ text: String(text ?? '') }));
  dataTransfer.setData(STORY_BLOCK_MIME, '1');
  return true;
}

export function readStoryCreateText(dataTransfer) {
  try {
    const payload = JSON.parse(dataTransfer?.getData(STORY_CREATE_MIME) || 'null');
    return typeof payload?.text === 'string' ? payload.text : null;
  } catch {
    return null;
  }
}
