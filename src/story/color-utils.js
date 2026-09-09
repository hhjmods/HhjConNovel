export function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeHex(value) {
  const text = String(value || '').trim();
  if (/^#[0-9a-f]{6}$/i.test(text)) return text.toLowerCase();
  const short = text.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  return short ? `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toLowerCase() : '';
}

export function hexToHsv(hex) {
  const valueHex = normalizeHex(hex) || '#000000';
  const r = parseInt(valueHex.slice(1, 3), 16) / 255;
  const g = parseInt(valueHex.slice(3, 5), 16) / 255;
  const b = parseInt(valueHex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta) {
    if (max === r) h = 60 * (((g - b) / delta) % 6);
    else if (max === g) h = 60 * ((b - r) / delta + 2);
    else h = 60 * ((r - g) / delta + 4);
  }
  if (h < 0) h += 360;
  return { h, s: max ? delta / max : 0, v: max };
}

export function hsvToHex(h, s, v) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return `#${[r, g, b].map(channel => Math.round((channel + m) * 255).toString(16).padStart(2, '0')).join('')}`;
}
