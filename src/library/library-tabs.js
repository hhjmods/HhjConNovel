export function libraryViewKey(type, id) {
  return `${type}:${id}`;
}

export function openLibraryView(openViews, activeViewKey, { type, id, name }, activate = true) {
  const key = libraryViewKey(type, id);
  const index = openViews.findIndex(view => libraryViewKey(view.type, view.id) === key);
  const view = index < 0
    ? { type, id: String(id), name: String(name || '콘') }
    : name ? { ...openViews[index], name: String(name) } : openViews[index];
  const views = index < 0
    ? [...openViews, view]
    : openViews.map((item, itemIndex) => itemIndex === index ? view : item);
  return { views, activeViewKey: activate ? key : activeViewKey, view };
}

export function closeLibraryView(openViews, activeViewKey, closingKey) {
  const index = openViews.findIndex(view => libraryViewKey(view.type, view.id) === closingKey);
  if (index < 0) return null;
  const views = openViews.filter((_, itemIndex) => itemIndex !== index);
  const closedActive = activeViewKey === closingKey;
  const nextView = closedActive ? views[Math.min(index, views.length - 1)] || null : null;
  return {
    views,
    activeViewKey: closedActive && nextView ? libraryViewKey(nextView.type, nextView.id) : closedActive ? '' : activeViewKey,
    closedActive,
    nextView
  };
}

export function reconcileLibraryViews(openViews, activeViewKey, packages, collections, openDefault = false) {
  const available = new Set([
    ...packages.map(item => libraryViewKey('packages', item.id)),
    ...collections.map(item => libraryViewKey('collections', item.id))
  ]);
  let views = openViews.filter(view => available.has(libraryViewKey(view.type, view.id)));
  let openedDefault = false;
  if (!views.length && openDefault && packages[0]) {
    views = [{ type: 'packages', id: String(packages[0].id), name: String(packages[0].name) }];
    openedDefault = true;
  }
  const nextActiveKey = views.some(view => libraryViewKey(view.type, view.id) === activeViewKey)
    ? activeViewKey
    : views[0] ? libraryViewKey(views[0].type, views[0].id) : '';
  return { views, activeViewKey: nextActiveKey, openedDefault };
}
