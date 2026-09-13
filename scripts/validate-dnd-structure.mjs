import fs from 'node:fs';

function fail(message) {
  console.error(`DnD structure check failed: ${message}`);
  process.exitCode = 1;
}

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

const index = read('index.html');
const expectedOrder = [
  './src/story-dnd-health.js',
  './src/story-drag-guard.js',
  './src/app.js',
  './src/library/library-con-drag-source.js',
  './src/story-insertion.js',
  './src/story-con-run-end-drop.js',
  './src/story-slot-mode.js',
  './src/story-drag-autoscroll.js',
  './src/story-drag-stability.js',
  './src/story-tail-blank-drop.js',
  './src/story-output-tools.js'
];

let lastIndex = -1;
for (const path of expectedOrder) {
  const indexOfPath = index.indexOf(path);
  if (indexOfPath < 0) {
    fail(`index.html is missing ${path}`);
    continue;
  }
  if (indexOfPath <= lastIndex) fail(`${path} moved before a required predecessor`);
  lastIndex = indexOfPath;
}

for (const term of ['story-create-drag.js', 'application/x-hhjstory-new-block']) {
  if (index.includes(term)) fail(`index.html contains retired experimental DnD term: ${term}`);
}

const files = {
  app: read('src/app.js'),
  health: read('src/story-dnd-health.js'),
  guard: read('src/story-drag-guard.js'),
  dragStart: read('src/library/library-con-drag-source.js'),
  insertion: read('src/story-insertion.js'),
  runEnd: read('src/story-con-run-end-drop.js'),
  slot: read('src/story-slot-mode.js'),
  autoscroll: read('src/story-drag-autoscroll.js'),
  stability: read('src/story-drag-stability.js'),
  tail: read('src/story-tail-blank-drop.js'),
  outputTools: read('src/story-output-tools.js'),
  breakCount: read('src/story/break-count.js'),
  conSize: read('src/story/con-size-mode.js'),
  textFormatting: read('src/story/text-formatting.js'),
  storyEditorResize: read('src/story/story-editor-resize.js'),
  boxSelection: read('src/core/box-selection.js'),
  storyOrder: read('src/story/story-order.js'),
  storyRender: read('src/story/story-render.js'),
  geometry: read('src/story/story-dnd-geometry.js'),
  utils: read('src/story-dnd-utils.js')
};

for (const token of ['application/x-hhjcon-ids', 'application/x-hhjstory-ids', 'application/x-hhjstory-block']) {
  if (!files.utils.includes(token)) fail(`src/story-dnd-utils.js lost DnD contract ${token}`);
}

const sharedUtilsImport = './story-dnd-utils.js?v=20260906-2';
for (const [path, source] of [
  ['src/story-drag-guard.js', files.guard],
  ['src/story-insertion.js', files.insertion],
  ['src/story-con-run-end-drop.js', files.runEnd],
  ['src/story-slot-mode.js', files.slot],
  ['src/story-tail-blank-drop.js', files.tail],
  ['src/story-output-tools.js', files.outputTools]
]) {
  if (!source.includes(sharedUtilsImport)) fail(`${path} does not use canonical DnD utility module version`);
  if (source.includes('application/x-hhj')) fail(`${path} bypasses centralized DnD MIME helpers`);
}
if (!files.dragStart.includes('../story-dnd-utils.js?v=20260906-2')) {
  fail('src/library/library-con-drag-source.js does not use canonical DnD utility module version');
}
if (files.dragStart.includes('application/x-hhj')) {
  fail('src/library/library-con-drag-source.js bypasses centralized DnD MIME helpers');
}

const directAppImport = './app.js?v=20260913-9';
const directAppClients = [
  ['src/story-insertion.js', files.insertion, '20260913-9'],
  ['src/story-con-run-end-drop.js', files.runEnd, '20260913-9'],
  ['src/story-slot-mode.js', files.slot, '20260913-10'],
  ['src/story-tail-blank-drop.js', files.tail, '20260913-9'],
  ['src/story-output-tools.js', files.outputTools, '20260914-3']
];
for (const [path, source, cacheVersion] of directAppClients) {
  if (!source.includes(directAppImport)) fail(`${path} does not import canonical app module version`);
  if (!index.includes(`./${path}?v=${cacheVersion}`)) fail(`index.html does not load the current ${path} cache version`);
}
if (!index.includes('./src/app.js?v=20260913-9')) fail('index.html app module version differs from DnD clients');
if (!index.includes('./src/story-drag-autoscroll.js?v=20260913-1')) fail('index.html does not load the tested autoscroll module version');
if (!files.slot.includes("from './story/story-dnd-geometry.js?v=20260913-1'")
  || !files.autoscroll.includes("from './story/story-dnd-geometry.js?v=20260913-1'")
  || !files.geometry.includes('export function nearestRectIndex(')
  || !files.geometry.includes('export function edgeScrollDelta(')
  || files.slot.includes('let bestDistance = Infinity')
  || files.autoscroll.includes('function edgeScrollDelta(')) {
  fail('slot guide and edge autoscroll must share the tested geometry calculations');
}

const storyRenderEvent = 'hhjcon:story-rendered';
if (!files.app.includes(`new Event('${storyRenderEvent}')`)) fail('app.js no longer emits the story render completion event');
for (const [path, source] of [
  ['src/story-insertion.js', files.insertion],
  ['src/story/break-count.js', files.breakCount],
  ['src/story/con-size-mode.js', files.conSize],
  ['src/story-output-tools.js', files.outputTools],
  ['src/story-tail-blank-drop.js', files.tail],
  ['src/story/text-formatting.js', files.textFormatting]
]) {
  if (!source.includes(`document.addEventListener('${storyRenderEvent}'`)) fail(`${path} no longer uses the explicit story render event`);
  if (source.includes('new MutationObserver')) fail(`${path} reintroduced story render observation`);
}
if (!index.includes('./src/story/break-count.js?v=20260910-1')
  || !index.includes('./src/story/con-size-mode.js?v=20260910-1')
  || !index.includes('./src/story/text-formatting.js?v=20260914-1')) {
  fail('index.html story decorator cache versions are not canonical');
}
if (!files.textFormatting.includes("storyList.dispatchEvent(new Event(RICH_EDITORS_RENDERED_EVENT))")
  || !files.storyEditorResize.includes('storyList.addEventListener(RICH_EDITORS_RENDERED_EVENT, refreshEditors)')
  || !files.storyEditorResize.includes("document.addEventListener('hhjcon:story-rendered', refreshEditors)")
  || files.storyEditorResize.includes('new MutationObserver')
  || !index.includes('./src/story/story-editor-resize.js?v=20260912-1')) {
  fail('rich editor resize setup must use explicit render events instead of DOM mutation observation');
}

if (!index.includes('./src/story-dnd-health.js?v=20260907-1')) fail('index.html does not load the passive DnD health module version');
if (!index.includes('./src/story-drag-guard.js?v=20260906-15')) fail('index.html does not load the low-churn story drag guard version');
if (!index.includes('./src/story-drag-stability.js?v=20260911-1')) fail('index.html does not load the drag cleanup module version');
if (!files.health.includes('window.__HHJDND')) fail('story-dnd-health.js no longer exposes the diagnostic API');
if (!files.health.includes("document.addEventListener('dragstart'")) fail('story-dnd-health.js no longer observes drag lifecycle start');
if (!files.health.includes('duplicates:')) fail('story-dnd-health.js no longer reports duplicate module URLs');
for (const forbidden of [
  'preventDefault(',
  'stopPropagation(',
  'stopImmediatePropagation(',
  '.setData(',
  'applyStoryDropTransfer',
  'moveStoryItemsBefore',
  'writeStoryTransfer',
  'writeConTransfer'
]) {
  if (files.health.includes(forbidden)) fail(`story-dnd-health.js must remain passive but contains ${forbidden}`);
}

if (!files.app.includes('export async function applyStoryDropTransfer')) fail('app.js lost direct drop mutation bridge');
if (!files.app.includes("./story/story-render.js?v=20260913-2")
  || !files.app.includes('renderStoryList(el.storyList')
  || files.app.includes("document.createElement('textarea')")
  || !files.storyRender.includes("../story-dnd-utils.js?v=20260906-2")
  || !files.storyRender.includes("../collections/collection-missing-ui.js?v=20260912-1")
  || !files.storyRender.includes('export function renderStoryList(')
  || !files.storyRender.includes("tail.className = 'story-tail-drop'")) {
  fail('story DOM construction must remain delegated to the story renderer');
}
if (!files.storyRender.includes('onTextInput(item.id, textarea.value)')
  || !files.app.includes('onTextInput: updateStoryText')
  || !files.app.includes('async function updateStoryText(itemId, text)')) {
  fail('story text edits must pass item ids to the app state mutation command');
}
if (!files.storyRender.includes('await onDrop(event.dataTransfer, itemId);')
  || !files.storyRender.includes('await onDrop(event.dataTransfer);')) {
  fail('story renderer lost row or tail drop routing to the app mutation bridge');
}
if (!files.app.includes('export async function moveStoryItemsBefore')) fail('app.js lost direct story-id move command');
if (!files.app.includes("./story/story-order.js?v=20260911-1")) fail('app.js does not import canonical story order module version');
if (!files.app.includes('planStoryItemReorder')) fail('app.js bypasses the pure story order planner');
if (!files.storyOrder.includes('export function planStoryItemReorder')) fail('story-order.js lost the pure reorder planner');
if (!files.storyOrder.includes('if (beforeId && moving.has(beforeId)) return null;')) fail('story-order.js lost state-level self-drop protection');
if (!files.app.includes("./core/box-selection.js?v=20260913-2")
  || !files.app.includes('installBoxSelection(el.storyList')
  || !files.app.includes('installBoxSelection(el.conGrid')) {
  fail('app.js does not install the shared story and library box-selection module');
}
if (!files.boxSelection.includes('if (!toggle) setSelection([]);')
  || !files.boxSelection.includes("selectionBox.style.width = '0';")
  || !files.boxSelection.includes("selectionBox.style.height = '0';")
  || !files.boxSelection.includes("container.addEventListener('scroll'")
  || !files.boxSelection.includes('container.scrollTop - drag.scrollTop')
  || !files.boxSelection.includes('clipBoxSelectionRect(rect')
  || !files.boxSelection.includes('if (toggle && selected.has(id)) selected.delete(id);')) {
  fail('blank story pointerdown must clear selection and reset the selection rectangle');
}
if (!files.app.includes('planStorySelectionStep')) fail('app.js bypasses the pure button-step planner');
if (!files.storyOrder.includes('export function planStorySelectionStep')) fail('story-order.js lost the button-step planner');
if (!files.app.includes('insertStoryItemsBefore')) fail('app.js bypasses the pure story insertion planner');
if (!files.storyOrder.includes('export function insertStoryItemsBefore')) fail('story-order.js lost the pure insertion planner');
if (!files.app.includes('export async function appendStoryTextBlock')) fail('app.js lost the direct text block creation command');
for (const [path, source] of [
  ['src/story-insertion.js', files.insertion],
  ['src/story-output-tools.js', files.outputTools]
]) {
  if (!source.includes('appendStoryTextBlock')) fail(`${path} bypasses the direct text block creation command`);
  if (source.includes('waitForNewText') || source.includes('addTextButton.click()')) fail(`${path} restored DOM polling or button-proxy text creation`);
}
if (files.app.includes('setStorySelection(ids, anchorId = null, rerender') || files.app.includes('if (rerender) renderStory()')) {
  fail('story selection restored full renderStory replacement');
}
if (!files.guard.includes('writeStoryTransfer')) fail('story-drag-guard.js lost story con payload capture');
if (!files.guard.includes("storyList?.addEventListener('dragover'")) fail('story-drag-guard.js lost native story drop acceptance');
if (
  files.guard.includes('markedTarget') ||
  files.guard.includes("classList.add('story-drag-target')") ||
  files.guard.includes("classList.add('drop-target')") ||
  files.guard.includes("classList.remove('story-drag-target'")
) {
  fail('story-drag-guard.js reintroduced legacy per-dragover target class churn');
}
if (!files.dragStart.includes('writeConTransfer')) fail('library-con-drag-source.js lost library con payload capture');
if (files.app.includes('writeStoryTransfer') || files.app.includes('writeConTransfer')) {
  fail('app.js duplicated con drag payload ownership');
}
if (!files.insertion.includes('writeStoryTransfer')) fail('story-insertion.js lost text/break drag payload ownership');
if (!files.outputTools.includes('writeStoryTransfer')) fail('story-output-tools.js lost image drag payload ownership');
if (files.stability.includes('writeStoryTransfer')) fail('story-drag-stability.js duplicated block drag payload writes');
if (!files.stability.includes("document.addEventListener('dragend', clearDragDecorations, true)")) fail('story-drag-stability.js lost final drag decoration cleanup');
if (files.stability.includes("addEventListener('drop'")) fail('story-drag-stability.js restored redundant DOM self-drop interception');
if (!files.slot.includes('transferHasType')) fail('story-slot-mode.js no longer matches restored known-good routing checkpoint');
if (!files.runEnd.includes('hitZone')) fail('story-con-run-end-drop.js lost run-end hit zone');
if (!files.tail.includes('isLowerBlankPoint')) fail('story-tail-blank-drop.js lost lower blank boundary protection');
if (!files.insertion.includes('story-insert-slot')) fail('story-insertion.js lost current insertion hit slots');

for (const [path, source] of Object.entries(files)) {
  if (source.includes("new Event('drop'") || source.includes('new Event("drop"')) fail(`${path} creates retired synthetic drop`);
  if (source.includes('forwardDrop(')) fail(`${path} reintroduced synthetic drop forwarding`);
  if (source.includes('application/x-hhjstory-new-block')) fail(`${path} reintroduced retired toolbar DnD MIME`);
}

for (const [path, source] of [
  ['src/story-insertion.js', files.insertion],
  ['src/story-output-tools.js', files.outputTools]
]) {
  if (source.includes('new DataTransfer(')) fail(`${path} creates fake DataTransfer for non-DnD mutation`);
  if (source.includes('selectedNextId')) fail(`${path} makes click insertion depend on selected story cons`);
}

if (!process.exitCode) console.log('DnD structure contracts OK');
