export function selectVisibleCons(state) {
  const consById = new Map(state.cons.map(con => [con.id, con]));
  let list = [];
  if (state.activeTab === 'packages') {
    const pkg = state.packages.find(item => item.id === state.activePackageId);
    if (pkg) list = state.cons.filter(con => con.packageId === pkg.id).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  } else {
    const collection = state.collections.find(item => item.id === state.activeCollectionId);
    if (collection) {
      list = collection.items.map(id => consById.get(id) || ({
        id, name: '미보유/미동기화 콘', packageId: '', thumbnailUrl: '', missing: true
      }));
    }
  }
  const query = state.search.trim().toLowerCase();
  return query ? list.filter(con => String(con.name).toLowerCase().includes(query)) : list;
}
