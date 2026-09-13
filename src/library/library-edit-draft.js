import { planOrderedSelection } from '../core/selection.js?v=20260907-1';
import { reorderOrderedIds } from '../model.js?v=20260912-1';

export function createCollectionEditDraft(collectionId, items, selectedIds = []) {
  const orderedItems = Array.isArray(items) ? [...items] : [];
  const selected = new Set([...selectedIds].filter(id => orderedItems.includes(id)));
  return {
    collectionId: String(collectionId),
    items: orderedItems,
    selectedIds: selected,
    anchorId: orderedItems.find(id => selected.has(id)) || null
  };
}

export function selectCollectionEditDraft(draft, targetId, options) {
  if (!draft) return draft;
  const next = planOrderedSelection(draft.items, draft.selectedIds, draft.anchorId, targetId, options);
  return { ...draft, selectedIds: new Set(next.ids), anchorId: next.anchorId };
}

export function prepareCollectionEditDrag(draft, fallbackId) {
  if (!draft) return { draft, ids: [] };
  const next = fallbackId && !draft.selectedIds.has(fallbackId)
    ? { ...draft, selectedIds: new Set([fallbackId]), anchorId: fallbackId }
    : draft;
  return { draft: next, ids: next.items.filter(id => next.selectedIds.has(id)) };
}

export function reorderCollectionEditDraft(draft, movingIds, beforeId = null) {
  if (!draft || (beforeId && new Set(movingIds).has(beforeId))) return draft;
  const items = reorderOrderedIds(draft.items, movingIds, beforeId);
  return items === draft.items ? draft : { ...draft, items };
}

export function deleteCollectionEditSelection(draft) {
  if (!draft?.selectedIds.size) return draft;
  return {
    ...draft,
    items: draft.items.filter(id => !draft.selectedIds.has(id)),
    selectedIds: new Set(),
    anchorId: null
  };
}
