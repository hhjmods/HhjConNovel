import { deleteOne, getAll, getOne, putOne } from './db.js';

const FORMAT = 'hhjcon-story-save';
const VERSION = 1;
const BUNDLE_FORMAT = 'hhjcon-story-saves';
const BUNDLE_VERSION = 1;
const PREFIX = 'story-save:';
const DOCS = {
  rich: 'rich-text-v1',
  display: 'con-display-v1',
  breaks: 'break-count-v1',
  memo: 'image-marker-memo-v1'
};
const HEIGHT_KEY = 'hhjcon-rich-text-heights-v1';
const TOAST_KEY = 'hhjcon-story-save-toast';
const storyList = document.getElementById('storyList');
const editorActions = document.querySelector('.editor-header > div:last-child');
const clearButton = document.getElementById('clearStoryBtn');
const toast = document.getElementById('toast');

const clone = value => structuredClone(value);
const asObject = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const safeName = name => String(name || '콘문학').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80);

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2400);
}

function downloadJson(name, value) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function defaultName() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `콘문학 ${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}${p(d.getMinutes())}`;
}

function backupFileName() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `콘문학_백업_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.hhjconstories.json`;
}

function filtered(items, ids) {
  const out = {};
  Object.entries(asObject(items)).forEach(([id, value]) => { if (ids.has(id)) out[id] = clone(value); });
  return out;
}

function readHeights(ids) {
  try {
    return filtered(JSON.parse(localStorage.getItem(HEIGHT_KEY) || '{}'), ids);
  } catch {
    return {};
  }
}

async function getSaves() {
  return (await getAll('documents'))
    .filter(v => v?.format === FORMAT && Number(v.version) === VERSION && String(v.id || '').startsWith(PREFIX))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

async function captureSave(name, oldSave = null) {
  await new Promise(resolve => setTimeout(resolve, 220));
  const [story, rich, display, breaks, memo, cons, packages] = await Promise.all([
    getOne('documents', 'current'), getOne('documents', DOCS.rich), getOne('documents', DOCS.display),
    getOne('documents', DOCS.breaks), getOne('documents', DOCS.memo), getAll('cons'), getAll('packages')
  ]);
  const items = clone(Array.isArray(story?.items) ? story.items : []);
  if (!items.length) throw new Error('저장할 원고가 없습니다.');
  const ids = new Set(items.map(item => item.id));
  const conMap = new Map(cons.map(con => [con.id, con]));
  const packageMap = new Map(packages.map(pkg => [pkg.id, pkg]));
  const conRefs = {};
  items.forEach(item => {
    if (item.type !== 'con') return;
    const con = conMap.get(item.conId);
    if (!con) return;
    const pkg = packageMap.get(con.packageId);
    conRefs[item.conId] = {
      sourceNo: String(con.sourceNo || ''),
      packageId: String(con.packageId || ''),
      sourcePackageId: String(pkg?.sourcePackageId || con.packageId || ''),
      name: String(con.name || ''),
      packageName: String(pkg?.name || '')
    };
  });
  const now = Date.now();
  return {
    id: oldSave?.id || `${PREFIX}${crypto.randomUUID()}`,
    format: FORMAT,
    version: VERSION,
    name,
    createdAt: oldSave?.createdAt || now,
    updatedAt: now,
    story: { items, updatedAt: Number(story?.updatedAt) || now },
    metadata: {
      rich: filtered(rich?.items, ids),
      display: filtered(display?.items, ids),
      breaks: filtered(breaks?.items, ids),
      memo: filtered(memo?.items, ids),
      heights: readHeights(ids)
    },
    conRefs
  };
}

function exportSave(save) {
  return {
    format: FORMAT,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    name: save.name,
    story: clone(save.story),
    metadata: clone(save.metadata || {}),
    conRefs: clone(save.conRefs || {})
  };
}

function exportBundle(saves) {
  return {
    format: BUNDLE_FORMAT,
    version: BUNDLE_VERSION,
    exportedAt: new Date().toISOString(),
    saves: saves.map(exportSave)
  };
}

function parseSave(data) {
  if (!data || data.format !== FORMAT || Number(data.version) !== VERSION || !Array.isArray(data.story?.items) || !data.story.items.length) {
    throw new Error('지원하지 않는 콘문학 원고 파일입니다.');
  }
  const seen = new Set();
  const items = data.story.items.map(item => {
    const id = String(item?.id || '');
    if (!id || seen.has(id) || !['con', 'text'].includes(item?.type)) throw new Error('올바르지 않은 원고 블록이 있습니다.');
    seen.add(id);
    if (item.type === 'con') {
      const conId = String(item.conId || '');
      if (!conId) throw new Error('디시콘 블록 정보가 없습니다.');
      return { id, type: 'con', conId };
    }
    return { id, type: 'text', text: String(item.text ?? '') };
  });
  const ids = new Set(items.map(item => item.id));
  const meta = asObject(data.metadata);
  return {
    name: String(data.name || '가져온 콘문학').trim() || '가져온 콘문학',
    story: { items, updatedAt: Date.now() },
    metadata: {
      rich: filtered(meta.rich, ids), display: filtered(meta.display, ids), breaks: filtered(meta.breaks, ids),
      memo: filtered(meta.memo, ids), heights: filtered(meta.heights, ids)
    },
    conRefs: clone(asObject(data.conRefs))
  };
}

function parseImportData(data) {
  if (data?.format === BUNDLE_FORMAT) {
    if (Number(data.version) !== BUNDLE_VERSION || !Array.isArray(data.saves) || !data.saves.length) {
      throw new Error('지원하지 않는 콘문학 백업 파일입니다.');
    }
    return data.saves.map(parseSave);
  }
  return [parseSave(data)];
}

async function storeImportedSave(parsed, names) {
  let name = parsed.name;
  let n = 2;
  while (names.has(name)) name = `${parsed.name} (${n++})`;
  names.add(name);
  const now = Date.now();
  await putOne('documents', {
    id: `${PREFIX}${crypto.randomUUID()}`,
    format: FORMAT,
    version: VERSION,
    name,
    createdAt: now,
    updatedAt: now,
    story: parsed.story,
    metadata: parsed.metadata,
    conRefs: parsed.conRefs
  });
}

function doc(id, items) {
  return { id, version: 1, items: clone(asObject(items)), updatedAt: Date.now() };
}

async function loadSave(save) {
  const current = await getOne('documents', 'current');
  if (current?.items?.length && !confirm('현재 작성 중인 원고가 선택한 저장 원고로 교체됩니다.\n남겨둘 현재 버전이 있다면 먼저 원고 저장을 해주세요.\n\n계속 불러올까요?')) return;
  await new Promise(resolve => setTimeout(resolve, 220));
  const cons = await getAll('cons');
  const byId = new Map(cons.map(con => [con.id, con]));
  const byNo = new Map(cons.filter(con => con.sourceNo).map(con => [String(con.sourceNo), con]));
  const story = clone(save.story);
  story.items.forEach(item => {
    if (item.type !== 'con' || byId.has(item.conId)) return;
    const ref = save.conRefs?.[item.conId];
    const match = ref?.sourceNo ? byNo.get(String(ref.sourceNo)) : null;
    if (match) item.conId = match.id;
  });
  story.id = 'current';
  story.updatedAt = Date.now();
  const m = asObject(save.metadata);
  await Promise.all([
    putOne('documents', story), putOne('documents', doc(DOCS.rich, m.rich)), putOne('documents', doc(DOCS.display, m.display)),
    putOne('documents', doc(DOCS.breaks, m.breaks)), putOne('documents', doc(DOCS.memo, m.memo))
  ]);
  localStorage.setItem(HEIGHT_KEY, JSON.stringify(asObject(m.heights)));
  sessionStorage.setItem(TOAST_KEY, `“${save.name}” 원고를 불러왔습니다.`);
  location.reload();
}

async function saveCurrent() {
  const saves = await getSaves();
  const input = prompt('저장할 콘문학 이름을 입력하세요.', defaultName());
  if (input == null) return false;
  const name = input.trim();
  if (!name) return alert('콘문학 이름을 입력하세요.'), false;
  const oldSave = saves.find(save => save.name === name) || null;
  if (oldSave && !confirm(`“${name}” 저장 원고가 이미 있습니다.\n현재 내용으로 덮어쓸까요?`)) return false;
  try {
    await putOne('documents', await captureSave(name, oldSave));
    showToast(oldSave ? `“${name}” 원고를 덮어썼습니다.` : `“${name}” 원고를 저장했습니다.`);
    return true;
  } catch (error) {
    alert(error.message || '원고를 저장할 수 없습니다.');
    return false;
  }
}

function stats(save) {
  const items = save.story?.items || [];
  const cons = items.filter(v => v.type === 'con').length;
  const texts = items.filter(v => v.type === 'text').length;
  return `${items.length}블록 · 콘 ${cons} · 텍스트 ${texts} · ${new Date(save.updatedAt).toLocaleString('ko-KR')}`;
}

function makeDialog() {
  const dialog = document.createElement('dialog');
  dialog.className = 'story-save-dialog';
  const head = document.createElement('div');
  head.className = 'story-save-head';
  head.innerHTML = '<strong>저장된 콘문학</strong>';
  const close = document.createElement('button');
  close.type = 'button'; close.className = 'icon-button'; close.textContent = '×'; close.title = '닫기';
  head.append(close);

  const tools = document.createElement('div');
  tools.className = 'story-save-tools';
  const save = document.createElement('button'); save.type = 'button'; save.className = 'primary'; save.textContent = '현재 원고 저장';
  tools.append(save);

  const selectionTools = document.createElement('div');
  selectionTools.className = 'story-save-selection-tools';
  const selectAll = document.createElement('button'); selectAll.type = 'button'; selectAll.textContent = '전체 선택';
  const clearAll = document.createElement('button'); clearAll.type = 'button'; clearAll.textContent = '선택 해제';
  const exportSelected = document.createElement('button'); exportSelected.type = 'button'; exportSelected.className = 'primary'; exportSelected.textContent = '선택 원고 내보내기';
  const label = document.createElement('label'); label.className = 'file-button'; label.textContent = '원고 불러오기';
  const input = document.createElement('input'); input.type = 'file'; input.multiple = true; input.accept = 'application/json,.json,.hhjconstory,.hhjconstories';
  label.append(input);
  selectionTools.append(selectAll, clearAll, exportSelected, label);

  const list = document.createElement('div'); list.className = 'story-save-list';
  const warning = document.createElement('div');
  warning.className = 'story-save-warning';
  warning.textContent = '(저장한 원고는 브라우저데이터를 삭제시 지워집니다. 원고 내보내기로 백업을 해주십시오.)';
  dialog.append(head, tools, selectionTools, list, warning); document.body.append(dialog);
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  return { dialog, list, save, input, selectAll, clearAll, exportSelected };
}

async function renderList(list) {
  const saves = await getSaves();
  list.replaceChildren();
  if (!saves.length) {
    const empty = document.createElement('div'); empty.className = 'story-save-empty'; empty.textContent = '저장된 콘문학이 없습니다.'; list.append(empty); return;
  }
  saves.forEach(save => {
    const row = document.createElement('div'); row.className = 'story-save-row';
    const check = document.createElement('input'); check.type = 'checkbox'; check.className = 'story-save-check'; check.value = save.id; check.setAttribute('aria-label', `${save.name} 선택`);
    const info = document.createElement('div'); info.className = 'story-save-info';
    const name = document.createElement('strong'); name.textContent = save.name;
    const meta = document.createElement('small'); meta.textContent = stats(save); info.append(name, meta);
    const actions = document.createElement('div'); actions.className = 'story-save-actions';
    const load = document.createElement('button'); load.type = 'button'; load.className = 'primary'; load.textContent = '불러오기';
    const exp = document.createElement('button'); exp.type = 'button'; exp.textContent = '내보내기';
    const del = document.createElement('button'); del.type = 'button'; del.className = 'danger'; del.textContent = '삭제';
    actions.append(load, exp, del); row.append(check, info, actions); list.append(row);
    load.addEventListener('click', () => loadSave(save).catch(error => alert(`원고를 불러올 수 없습니다.\n${error.message || error}`)));
    exp.addEventListener('click', () => downloadJson(`${safeName(save.name)}.hhjconstory.json`, exportSave(save)));
    del.addEventListener('click', async () => {
      if (!confirm(`“${save.name}” 저장 원고를 삭제할까요?`)) return;
      await deleteOne('documents', save.id); showToast(`“${save.name}” 저장 원고를 삭제했습니다.`); await renderList(list);
    });
  });
}

async function exportSelectedSaves(list) {
  const selectedIds = new Set([...list.querySelectorAll('.story-save-check:checked')].map(input => input.value));
  if (!selectedIds.size) return alert('내보낼 콘문학을 하나 이상 선택하세요.');
  const selected = (await getSaves()).filter(save => selectedIds.has(save.id));
  if (!selected.length) return;
  if (selected.length === 1) {
    downloadJson(`${safeName(selected[0].name)}.hhjconstory.json`, exportSave(selected[0]));
  } else {
    downloadJson(backupFileName(), exportBundle(selected));
  }
  showToast(`${selected.length}개 콘문학 원고를 내보냈습니다.`);
}

async function openManager() {
  const ui = makeDialog();
  ui.save.addEventListener('click', async () => { if (await saveCurrent()) await renderList(ui.list); });
  ui.selectAll.addEventListener('click', () => ui.list.querySelectorAll('.story-save-check').forEach(input => { input.checked = true; }));
  ui.clearAll.addEventListener('click', () => ui.list.querySelectorAll('.story-save-check').forEach(input => { input.checked = false; }));
  ui.exportSelected.addEventListener('click', () => exportSelectedSaves(ui.list).catch(error => alert(`원고를 내보낼 수 없습니다.\n${error.message || error}`)));
  ui.input.addEventListener('change', async () => {
    const files = [...(ui.input.files || [])]; ui.input.value = ''; if (!files.length) return;
    const names = new Set((await getSaves()).map(v => v.name)); let ok = 0; const failures = [];
    for (const file of files) {
      try {
        const parsedSaves = parseImportData(JSON.parse(await file.text()));
        for (const parsed of parsedSaves) {
          await storeImportedSave(parsed, names);
          ok += 1;
        }
      } catch (error) { failures.push(`${file.name}: ${error.message}`); }
    }
    if (failures.length) alert(`${ok ? `${ok}개 원고를 불러왔습니다.\n\n` : ''}불러오지 못한 파일이 있습니다.\n${failures.map(v => `- ${v}`).join('\n')}`);
    if (ok) { showToast(`${ok}개 콘문학 원고를 불러왔습니다.`); await renderList(ui.list); }
  });
  await renderList(ui.list); ui.dialog.showModal();
}

if (storyList && editorActions) {
  const style = document.createElement('style');
  style.textContent = '.editor-header>div:last-child{flex-wrap:wrap;justify-content:flex-end}.story-save-dialog{width:min(820px,calc(100vw - 28px));max-height:82vh;padding:0;border:1px solid var(--line);border-radius:12px;background:var(--panel);color:var(--text);box-shadow:0 22px 70px #0009}.story-save-dialog::backdrop{background:#0009}.story-save-head,.story-save-tools,.story-save-selection-tools{display:flex;align-items:center;gap:8px;padding:12px;border-bottom:1px solid var(--line)}.story-save-head{justify-content:space-between}.story-save-tools,.story-save-selection-tools{flex-wrap:wrap}.story-save-selection-tools input{display:none}.story-save-selection-tools{padding-top:8px;padding-bottom:8px}.story-save-list{max-height:58vh;padding:10px;overflow:auto;display:flex;flex-direction:column;gap:8px}.story-save-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:12px;padding:10px;border:1px solid var(--line);border-radius:9px;background:var(--panel-2)}.story-save-check{width:18px;height:18px;margin:0}.story-save-info{min-width:0;display:flex;flex-direction:column;gap:4px}.story-save-info strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.story-save-info small{color:var(--muted)}.story-save-actions{display:flex;flex-wrap:wrap;gap:6px}.story-save-empty{padding:28px;text-align:center;color:var(--muted)}.story-save-warning{padding:10px 12px;border-top:1px solid var(--line);color:var(--muted);font-size:12px;line-height:1.5}@media(max-width:650px){.story-save-row{grid-template-columns:auto minmax(0,1fr)}.story-save-actions{grid-column:1/-1}}';
  document.head.append(style);
  const save = document.createElement('button'); save.type = 'button'; save.className = 'small'; save.textContent = '원고 저장';
  const manage = document.createElement('button'); manage.type = 'button'; manage.className = 'small'; manage.textContent = '원고 목록';
  editorActions.insertBefore(save, clearButton || null); editorActions.insertBefore(manage, clearButton || null);
  save.addEventListener('click', saveCurrent);
  manage.addEventListener('click', () => openManager().catch(error => alert(`원고 목록을 열 수 없습니다.\n${error.message || error}`)));
  const message = sessionStorage.getItem(TOAST_KEY); if (message) { sessionStorage.removeItem(TOAST_KEY); setTimeout(() => showToast(message), 100); }
}
