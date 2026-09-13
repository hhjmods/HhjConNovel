const FONT_SIZE_MAP = { '1': '10px', '2': '12px', '3': '14px', '4': '18px', '5': '24px', '6': '32px', '7': '48px' };
const ALLOWED_RICH_TAGS = new Set(['SPAN', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'DIV', 'P']);
const BLOCKED_RICH_TAGS = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META']);
const ALLOWED_STYLE_PROPS = [
  'color', 'backgroundColor', 'fontFamily', 'fontSize', 'fontWeight',
  'fontStyle', 'textDecoration', 'textDecorationLine', 'textAlign'
];

export function copySafeStyle(source, target) {
  const style = source?.style;
  if (!style) return;
  ALLOWED_STYLE_PROPS.forEach(prop => {
    const value = style[prop];
    if (!value || /(?:javascript\s*:|expression\s*\(|url\s*\()/i.test(value)) return;
    target.style[prop] = value;
  });
}

function flattenSingleChildSpan(span) {
  while (span.childNodes.length === 1 && span.firstElementChild?.tagName === 'SPAN') {
    const child = span.firstElementChild;
    copySafeStyle(child, span);
    span.replaceChildren(...child.childNodes);
  }
}

export function sanitizeRichHtml(html) {
  const template = document.createElement('template');
  template.innerHTML = String(html || '');
  const output = document.createElement('div');

  function appendClean(node, parent) {
    if (node.nodeType === Node.TEXT_NODE) {
      parent.append(document.createTextNode(node.data));
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = node.tagName;
    if (BLOCKED_RICH_TAGS.has(tag)) return;
    if (tag === 'BR') {
      parent.append(document.createElement('br'));
      return;
    }
    if (tag === 'FONT') {
      const span = document.createElement('span');
      const face = node.getAttribute('face');
      const color = node.getAttribute('color');
      const size = node.getAttribute('size');
      if (face) span.style.fontFamily = face;
      if (color) span.style.color = color;
      if (FONT_SIZE_MAP[size]) span.style.fontSize = FONT_SIZE_MAP[size];
      copySafeStyle(node, span);
      [...node.childNodes].forEach(child => appendClean(child, span));
      flattenSingleChildSpan(span);
      parent.append(span);
      return;
    }
    if (!ALLOWED_RICH_TAGS.has(tag)) {
      [...node.childNodes].forEach(child => appendClean(child, parent));
      return;
    }
    const clean = document.createElement(tag.toLowerCase());
    copySafeStyle(node, clean);
    [...node.childNodes].forEach(child => appendClean(child, clean));
    if (tag === 'SPAN') flattenSingleChildSpan(clean);
    parent.append(clean);
  }

  [...template.content.childNodes].forEach(node => appendClean(node, output));
  return output.innerHTML;
}
