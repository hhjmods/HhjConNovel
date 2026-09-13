const EDGE_SIZE = 72;
const OUTSIDE_TOLERANCE = 28;
const MAX_SPEED = 20;

export function nearestRectIndex(rects, clientX, clientY) {
  let bestIndex = -1;
  let bestDistance = Infinity;
  rects.forEach((rect, index) => {
    const dx = clientX < rect.left ? rect.left - clientX : clientX > rect.right ? clientX - rect.right : 0;
    const dy = clientY < rect.top ? rect.top - clientY : clientY > rect.bottom ? clientY - rect.bottom : 0;
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex;
}

export function edgeScrollDelta(pointerX, pointerY, rect) {
  if (pointerX == null || pointerY == null || !rect) return 0;
  if (pointerX < rect.left - OUTSIDE_TOLERANCE || pointerX > rect.right + OUTSIDE_TOLERANCE ||
      pointerY < rect.top - OUTSIDE_TOLERANCE || pointerY > rect.bottom + OUTSIDE_TOLERANCE) return 0;

  const topEdge = rect.top + EDGE_SIZE;
  const bottomEdge = rect.bottom - EDGE_SIZE;
  if (pointerY < topEdge) {
    const ratio = Math.min(1, (topEdge - pointerY) / (EDGE_SIZE + OUTSIDE_TOLERANCE));
    return -Math.max(2, Math.round(MAX_SPEED * ratio));
  }
  if (pointerY > bottomEdge) {
    const ratio = Math.min(1, (pointerY - bottomEdge) / (EDGE_SIZE + OUTSIDE_TOLERANCE));
    return Math.max(2, Math.round(MAX_SPEED * ratio));
  }
  return 0;
}
