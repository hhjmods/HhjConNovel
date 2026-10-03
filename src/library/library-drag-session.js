let activeKind = '';

export function beginLibraryDrag(kind) {
  activeKind = String(kind || '');
}

export function endLibraryDrag(kind = '') {
  if (!kind || activeKind === kind) activeKind = '';
}

export function libraryDragKind() {
  return activeKind;
}
