import { wrongBackupTypeMessage } from '../core/backup-format.js?v=20260910-1';

export const FORMAT = 'hhjcon-story-save';
export const VERSION = 1;
export const BUNDLE_FORMAT = 'hhjcon-story-saves';
export const BUNDLE_VERSION = 1;

const clone = value => structuredClone(value);
const asObject = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};

export function normalizeConRef(value) {
  const ref = asObject(value);
  const normalized = {
    sourceNo: String(ref.sourceNo || ''), packageId: String(ref.packageId || ''),
    sourcePackageId: String(ref.sourcePackageId || ref.packageId || ''),
    name: String(ref.name || ''), packageName: String(ref.packageName || '')
  };
  return Object.values(normalized).some(Boolean) ? normalized : null;
}

export function filtered(items, ids) {
  const out = {};
  Object.entries(asObject(items)).forEach(([id, value]) => { if (ids.has(id)) out[id] = clone(value); });
  return out;
}

export function exportSave(save) {
  return {
    format: FORMAT,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    name: save.name,
    story: clone(save.story),
    metadata: clone(save.metadata || {}),
    conRefs: clone(save.conRefs || {})
  };
}

export function exportBundle(saves) {
  return {
    format: BUNDLE_FORMAT,
    version: BUNDLE_VERSION,
    exportedAt: new Date().toISOString(),
    saves: saves.map(exportSave)
  };
}

function parseSave(data) {
  if (!data || data.format !== FORMAT || Number(data.version) !== VERSION || !Array.isArray(data.story?.items) || !data.story.items.length) {
    throw new Error('지원하지 않는 콘문학 원고 파일입니다.');
  }
  const seen = new Set();
  const conRefs = asObject(data.conRefs);
  const items = data.story.items.map(item => {
    const id = String(item?.id || '');
    if (!id || seen.has(id) || !['con', 'text'].includes(item?.type)) throw new Error('올바르지 않은 원고 블록이 있습니다.');
    seen.add(id);
    if (item.type === 'con') {
      const conId = String(item.conId || '');
      if (!conId) throw new Error('디시콘 블록 정보가 없습니다.');
      const conRef = normalizeConRef(item.conRef || conRefs[conId]);
      return conRef ? { id, type: 'con', conId, conRef } : { id, type: 'con', conId };
    }
    return { id, type: 'text', text: String(item.text ?? '') };
  });
  const ids = new Set(items.map(item => item.id));
  const metadata = asObject(data.metadata);
  return {
    name: String(data.name || '가져온 콘문학').trim() || '가져온 콘문학',
    story: { items, updatedAt: Date.now() },
    metadata: {
      rich: filtered(metadata.rich, ids), display: filtered(metadata.display, ids), breaks: filtered(metadata.breaks, ids),
      memo: filtered(metadata.memo, ids), heights: filtered(metadata.heights, ids)
    },
    conRefs: clone(conRefs)
  };
}

export function parseImportData(data) {
  const typeMessage = wrongBackupTypeMessage(data?.format, 'story');
  if (typeMessage) throw new Error(typeMessage);
  if (data?.format === BUNDLE_FORMAT) {
    if (Number(data.version) !== BUNDLE_VERSION || !Array.isArray(data.saves) || !data.saves.length) {
      throw new Error('지원하지 않는 콘문학 백업 파일입니다.');
    }
    return data.saves.map(parseSave);
  }
  return [parseSave(data)];
}
