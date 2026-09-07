export function planOrderedSelection(orderedIds, selectedIds, anchorId, targetId, { toggle = false, range = false } = {}) {
  const order = Array.isArray(orderedIds) ? orderedIds : [];
  const selected = new Set(selectedIds || []);

  if (range && anchorId && order.includes(anchorId) && order.includes(targetId)) {
    const anchorIndex = order.indexOf(anchorId);
    const targetIndex = order.indexOf(targetId);
    const rangeIds = order.slice(Math.min(anchorIndex, targetIndex), Math.max(anchorIndex, targetIndex) + 1);
    return {
      ids: toggle ? [...new Set([...selected, ...rangeIds])] : rangeIds,
      anchorId
    };
  }

  if (toggle) {
    if (selected.has(targetId)) selected.delete(targetId);
    else selected.add(targetId);
    return { ids: [...selected], anchorId: targetId };
  }

  return { ids: [targetId], anchorId: targetId };
}
