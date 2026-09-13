export const DC_HTML_LIMIT = 65535;
export const DC_CON_DETAIL_ATTRIBUTE_LENGTH = ' detail="0000000000"'.length;
export const DC_IMAGE_UPLOAD_HTML_LENGTH = 296;

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[char]);
}

export function validDcConSource(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:'
      && url.hostname === 'dcimg5.dcinside.com'
      && url.pathname === '/dccon.php'
      && Boolean(url.searchParams.get('no'))
      ? url.href
      : '';
  } catch {
    return '';
  }
}

export function buildDcConHtml(item, con, big) {
  const src = validDcConSource(con?.imageUrl || con?.thumbnailUrl || '');
  if (!src) {
    return '<span style="color:#ff0000;background-color:#ffff00;font-weight:700;">【미보유/미동기화 디시콘】</span>';
  }
  const label = String(con?.name || con?.sourceNo || item.conId || '디시콘');
  const className = big ? 'written_dccon bigdccon' : 'written_dccon';
  const attr = escapeHtml(label);
  return `<img class="${className}" src="${escapeHtml(src)}" conalt="${attr}" alt="${attr}" con_alt="${attr}" title="${attr}">`;
}

export function estimateDcHtmlCharCount(compactHtml, validConCount, imageMarkerHtmlLength, imageCount) {
  return String(compactHtml || '').length
    + Math.max(0, Number(validConCount) || 0) * DC_CON_DETAIL_ATTRIBUTE_LENGTH
    - Math.max(0, Number(imageMarkerHtmlLength) || 0)
    + Math.max(0, Number(imageCount) || 0) * DC_IMAGE_UPLOAD_HTML_LENGTH;
}
