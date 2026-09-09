const pad2 = value => String(value).padStart(2, '0');

export function sanitizeDownloadName(name, fallback) {
  return String(name || fallback).replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80);
}

export function makeDatedDefaultName(baseName, date = new Date()) {
  return `${baseName} ${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}${pad2(date.getMinutes())}`;
}

export function makeTimestampedBackupName(baseName, suffix, date = new Date()) {
  const stamp = `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}-${pad2(date.getHours())}${pad2(date.getMinutes())}${pad2(date.getSeconds())}`;
  return `${baseName}_${stamp}${suffix}`;
}

export function downloadJson(name, value) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
