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
  './src/drag-start-fix.js',
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
  dragStart: read('src/drag-start-fix.js'),
  insertion: read('src/story-insertion.js'),
  runEnd: read('src/story-con-run-end-drop.js'),
  slot: read('src/story-slot-mode.js'),
  stability: read('src/story-drag-stability.js'),
  tail: read('src/story-tail-blank-drop.js'),
  outputTools: read('src/story-output-tools.js'),
  utils: read('src/story-dnd-utils.js')
};

for (const token of ['application/x-hhjcon-ids', 'application/x-hhjstory-ids', 'application/x-hhjstory-block']) {
  if (!files.utils.includes(token)) fail(`src/story-dnd-utils.js lost DnD contract ${token}`);
}

const sharedUtilsImport = './story-dnd-utils.js?v=20260906-2';
for (const [path, source] of [
  ['src/story-drag-guard.js', files.guard],
  ['src/drag-start-fix.js', files.dragStart],
  ['src/story-insertion.js', files.insertion],
  ['src/story-con-run-end-drop.js', files.runEnd],
  ['src/story-slot-mode.js', files.slot],
  ['src/story-drag-stability.js', files.stability],
  ['src/story-tail-blank-drop.js', files.tail],
  ['src/story-output-tools.js', files.outputTools]
]) {
  if (!source.includes(sharedUtilsImport)) fail(`${path} does not use canonical DnD utility module version`);
  if (source.includes('application/x-hhj')) fail(`${path} bypasses centralized DnD MIME helpers`);
}

const directAppImport = './app.js?v=20260906-17';
for (const [path, source] of [
  ['src/story-insertion.js', files.insertion],
  ['src/story-con-run-end-drop.js', files.runEnd],
  ['src/story-slot-mode.js', files.slot],
  ['src/story-tail-blank-drop.js', files.tail],
  ['src/story-output-tools.js', files.outputTools]
]) {
  if (!source.includes(directAppImport)) fail(`${path} does not import canonical app module version`);
}
if (!index.includes('./src/app.js?v=20260906-17')) fail('index.html app module version differs from DnD clients');

if (!index.includes('./src/story-dnd-health.js?v=20260906-1')) fail('index.html does not load the passive DnD health module version');
if (!index.includes('./src/story-drag-guard.js?v=20260906-15')) fail('index.html does not load the low-churn story drag guard version');
if (!index.includes('./src/story-drag-stability.js?v=20260906-15')) fail('index.html does not load the single-owner stability module version');
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
if (!files.app.includes('export async function moveStoryItemsBefore')) fail('app.js lost direct story-id move command');
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
if (!files.dragStart.includes('writeConTransfer')) fail('drag-start-fix.js lost library con payload capture');
if (!files.insertion.includes('writeStoryTransfer')) fail('story-insertion.js lost text/break drag payload ownership');
if (!files.outputTools.includes('writeStoryTransfer')) fail('story-output-tools.js lost image drag payload ownership');
if (files.stability.includes('writeStoryTransfer')) fail('story-drag-stability.js duplicated block drag payload writes');
if (!files.slot.includes('transferHasType')) fail('story-slot-mode.js no longer matches restored known-good routing checkpoint');
if (!files.runEnd.includes('hitZone')) fail('story-con-run-end-drop.js lost run-end hit zone');
if (!files.tail.includes('isLowerBlankPoint')) fail('story-tail-blank-drop.js lost lower blank boundary protection');
if (!files.stability.includes('beforeIdForTarget')) fail('story-drag-stability.js lost self-drop protection');
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
}

if (!process.exitCode) console.log('DnD structure contracts OK');
