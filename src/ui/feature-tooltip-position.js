// 좌표 계산만 분리해 화면 가장자리와 위쪽 전환을 브라우저 없이 검증한다.
export function placeFeatureTooltip(anchor, size, viewport) {
  const margin = 8;
  const below = anchor.bottom + margin;
  const above = anchor.top - size.height - margin;
  const left = Math.max(margin, Math.min(
    anchor.left + anchor.width / 2 - size.width / 2,
    viewport.width - size.width - margin
  ));
  const top = below + size.height <= viewport.height - margin
    ? below
    : above >= margin
      ? above
      : Math.max(margin, Math.min(below, viewport.height - size.height - margin));
  return { left, top };
}
