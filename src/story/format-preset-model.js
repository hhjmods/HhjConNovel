export const FORMAT_PRESET_LIMIT = 50;
export const FORMAT_PRESET_NAME_MAX = 20;

const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const TOGGLES = ['bold', 'italic', 'underline', 'strikeThrough'];
const ALIGNMENTS = ['justifyLeft', 'justifyCenter', 'justifyRight'];

export function normalizeFormatPreset(value, allowedFonts = [], allowedSizes = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const id = String(value.id || '').trim();
  const name = String(value.name || '').trim().slice(0, FORMAT_PRESET_NAME_MAX);
  if (!/^[a-z0-9-]{1,64}$/i.test(id) || !name) return null;
  const preset = { id, name };
  if (allowedFonts.includes(value.font)) preset.font = value.font;
  if (allowedSizes.includes(value.size)) preset.size = value.size;
  if (COLOR_PATTERN.test(value.color || '')) preset.color = value.color.toLowerCase();
  if (COLOR_PATTERN.test(value.background || '')) preset.background = value.background.toLowerCase();
  if (ALIGNMENTS.includes(value.align)) preset.align = value.align;
  TOGGLES.forEach(key => { if (value[key] === true) preset[key] = true; });
  return Object.keys(preset).length > 2 ? preset : null;
}

export function normalizeFormatPresets(value, allowedFonts = [], allowedSizes = []) {
  if (!Array.isArray(value)) return [];
  const ids = new Set();
  return value.slice(0, FORMAT_PRESET_LIMIT).map(item => normalizeFormatPreset(item, allowedFonts, allowedSizes)).filter(item => {
    if (!item || ids.has(item.id)) return false;
    ids.add(item.id);
    return true;
  });
}
