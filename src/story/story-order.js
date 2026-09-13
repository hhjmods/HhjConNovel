export function insertStoryItemsBefore(items, insertingItems, beforeId = null) {
  const nextItems = [...items];
  if (!insertingItems.length) return nextItems;

  let insertAt = beforeId ? nextItems.findIndex(item => item.id === beforeId) : nextItems.length;
  if (insertAt < 0) insertAt = nextItems.length;
  nextItems.splice(insertAt, 0, ...insertingItems);
  return nextItems;
}

export function planStoryItemReorder(items, movingIds, beforeId = null) {
  const moving = new Set(movingIds);
  if (beforeId && moving.has(beforeId)) return null;
  const movingItems = items.filter(item => moving.has(item.id));
  if (!movingItems.length) return null;

  const remainingItems = items.filter(item => !moving.has(item.id));
  return { items: insertStoryItemsBefore(remainingItems, movingItems, beforeId), movingItems };
}

export function planStorySelectionStep(items, movingIds, delta) {
  const moving = new Set(movingIds);
  const firstIndex = items.findIndex(item => moving.has(item.id));
  if (firstIndex < 0 || delta === 0) return null;

  let lastIndex = firstIndex;
  items.forEach((item, index) => {
    if (moving.has(item.id)) lastIndex = index;
  });

  if (delta < 0) {
    let targetIndex = firstIndex - 1;
    while (targetIndex >= 0 && moving.has(items[targetIndex].id)) targetIndex -= 1;
    if (targetIndex < 0) return null;
    return planStoryItemReorder(items, movingIds, items[targetIndex].id);
  }

  let targetIndex = lastIndex + 1;
  while (targetIndex < items.length && moving.has(items[targetIndex].id)) targetIndex += 1;
  if (targetIndex >= items.length) return null;

  const remainingItems = items.filter(item => !moving.has(item.id));
  const targetId = items[targetIndex].id;
  const targetPosition = remainingItems.findIndex(item => item.id === targetId);
  const beforeId = remainingItems[targetPosition + 1]?.id || null;
  return planStoryItemReorder(items, movingIds, beforeId);
}
