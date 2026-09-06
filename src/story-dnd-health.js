const MAX_LOGS = 800;
const DRAGOVER_SAMPLE_MS = 300;
const startedAt = performance.now();
const logs = [];

let sequence = 0;
let dragSequence = 0;
let activeSession = null;
let lastDragoverAt = 0;
let lastDragoverKey = '';

function uptimeMs() {
  return Math.round(performance.now() - startedAt);
}

function targetInfo(target) {
  if (!(target instanceof Element)) return null;
  return {
    tag: target.tagName.toLowerCase(),
    id: target.id || null,
    classes: [...target.classList].filter(name =>
      name.startsWith('story-') ||
      name === 'con-card' ||
      name === 'dragging' ||
      name === 'selected' ||
      name === 'drop-target'
    )
  };
}

function transferInfo(dataTransfer) {
  if (!dataTransfer) return null;
  let types = [];
  try {
    types = [...dataTransfer.types];
  } catch {
    types = [];
  }
  return {
    effectAllowed: dataTransfer.effectAllowed || '',
    dropEffect: dataTransfer.dropEffect || '',
    types
  };
}

function push(type, data = {}) {
  logs.push({
    seq: ++sequence,
    uptimeMs: uptimeMs(),
    type,
    ...data
  });
  if (logs.length > MAX_LOGS) logs.splice(0, logs.length - MAX_LOGS);
}

function storyDomSnapshot() {
  const storyList = document.getElementById('storyList');
  return {
    storyItems: storyList?.querySelectorAll(':scope > .story-item').length || 0,
    insertSlots: storyList?.querySelectorAll(':scope > .story-insert-slot').length || 0,
    tailDrops: storyList?.querySelectorAll(':scope > .story-tail-drop').length || 0,
    draggingNodes: document.querySelectorAll('.dragging').length,
    fixedGuides: document.querySelectorAll('.story-drop-guide').length,
    listClasses: storyList ? [...storyList.classList] : []
  };
}

function moduleResources() {
  const relevant = performance.getEntriesByType('resource')
    .map(entry => entry.name)
    .filter(name => /\/src\/(?:app|story-[^/]+|drag-start-fix)\.js(?:\?|$)/.test(name));

  const byPath = new Map();
  for (const name of relevant) {
    let key = name;
    try {
      const url = new URL(name, location.href);
      key = url.pathname;
    } catch {
      // Keep the original string if URL parsing fails.
    }
    const list = byPath.get(key) || [];
    if (!list.includes(name)) list.push(name);
    byPath.set(key, list);
  }

  return {
    loaded: relevant,
    duplicates: [...byPath.entries()]
      .filter(([, names]) => names.length > 1)
      .map(([path, names]) => ({ path, names }))
  };
}

function snapshot() {
  const resources = moduleResources();
  const memory = performance.memory ? {
    usedJSHeapSize: performance.memory.usedJSHeapSize,
    totalJSHeapSize: performance.memory.totalJSHeapSize,
    jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
  } : null;

  return {
    uptimeMs: uptimeMs(),
    visibility: document.visibilityState,
    focused: document.hasFocus(),
    activeSession: activeSession ? {
      id: activeSession.id,
      startedAtMs: activeSession.startedAtMs,
      durationMs: Math.max(0, uptimeMs() - activeSession.startedAtMs),
      source: activeSession.source,
      sourceConnected: activeSession.sourceNode?.isConnected ?? null
    } : null,
    dom: storyDomSnapshot(),
    modules: resources,
    memory
  };
}

function baseEventData(event) {
  return {
    sessionId: activeSession?.id || null,
    target: targetInfo(event.target),
    defaultPrevented: event.defaultPrevented,
    cancelBubble: event.cancelBubble,
    clientX: Number.isFinite(event.clientX) ? event.clientX : null,
    clientY: Number.isFinite(event.clientY) ? event.clientY : null,
    transfer: transferInfo(event.dataTransfer),
    sourceConnected: activeSession?.sourceNode?.isConnected ?? null
  };
}

function recordFinal(type, event) {
  queueMicrotask(() => {
    push(`${type}:final`, baseEventData(event));
  });
}

document.addEventListener('dragstart', event => {
  activeSession = {
    id: ++dragSequence,
    startedAtMs: uptimeMs(),
    source: targetInfo(event.target),
    sourceNode: event.target instanceof Element ? event.target : null
  };
  push('dragstart', baseEventData(event));
  recordFinal('dragstart', event);
}, true);

document.addEventListener('dragover', event => {
  if (!activeSession) return;
  const now = uptimeMs();
  const target = targetInfo(event.target);
  const transfer = transferInfo(event.dataTransfer);
  const key = JSON.stringify([target, transfer?.dropEffect, transfer?.effectAllowed, transfer?.types]);
  if (now - lastDragoverAt < DRAGOVER_SAMPLE_MS && key === lastDragoverKey) return;
  lastDragoverAt = now;
  lastDragoverKey = key;
  push('dragover', baseEventData(event));
  recordFinal('dragover', event);
}, true);

document.addEventListener('drop', event => {
  push('drop', baseEventData(event));
  recordFinal('drop', event);
}, true);

document.addEventListener('dragend', event => {
  push('dragend', {
    ...baseEventData(event),
    durationMs: activeSession ? Math.max(0, uptimeMs() - activeSession.startedAtMs) : null
  });
  activeSession = null;
  lastDragoverAt = 0;
  lastDragoverKey = '';
}, true);

document.addEventListener('visibilitychange', () => {
  push('visibilitychange', { visibility: document.visibilityState, focused: document.hasFocus() });
});

window.addEventListener('focus', () => push('window:focus', { visibility: document.visibilityState }));
window.addEventListener('blur', () => push('window:blur', { visibility: document.visibilityState }));
window.addEventListener('pageshow', event => push('pageshow', { persisted: event.persisted }));
window.addEventListener('pagehide', event => push('pagehide', { persisted: event.persisted }));
window.addEventListener('error', event => {
  push('window:error', {
    message: String(event.error?.message || event.message || 'unknown error'),
    source: event.filename || null,
    line: event.lineno || null,
    column: event.colno || null
  });
});
window.addEventListener('unhandledrejection', event => {
  push('unhandledrejection', {
    message: String(event.reason?.message || event.reason || 'unknown rejection')
  });
});

function dump({ last = 250 } = {}) {
  const count = Math.max(1, Math.min(MAX_LOGS, Number(last) || 250));
  const result = {
    snapshot: snapshot(),
    logs: logs.slice(-count)
  };
  console.log(JSON.stringify(result, null, 2));
  return result;
}

function stats() {
  const counts = {};
  for (const entry of logs) counts[entry.type] = (counts[entry.type] || 0) + 1;
  const result = { snapshot: snapshot(), counts, logCount: logs.length };
  console.log(result);
  return result;
}

function clear() {
  logs.length = 0;
  push('health:cleared');
}

function mark(label = '') {
  push('mark', { label: String(label).slice(0, 120) });
}

function save() {
  const payload = JSON.stringify(dump({ last: MAX_LOGS }), null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `hhjcon-dnd-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

window.__HHJDND = Object.freeze({ dump, stats, clear, mark, save, snapshot });
push('health:init', { visibility: document.visibilityState, focused: document.hasFocus() });
