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
  './src/app.js',
  './src/drag-start-fix.js',
  './src/story-insertion.js',
  './src/story-slot-mode.js',
  './src/story-drag-autoscroll.js',
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

for (const term of [
  'story-create-drag.js',
  'application/x-hhjstory-new-block',
  'story-drag-guard.js',
  'story-con-run-end-drop.js',
  'story-tail-blank-drop.js',
  'story-drag-stability.js'
]) {
  if (index.includes(term)) fail(`index.html contains retired DnD term: ${term}`);
}

const files = {
  app: read('src/app.js'),
  dragStart: read('src/drag-start-fix.js'),
  insertion: read('src/story-insertion.js'),
  slot: read('src/story-slot-mode.js'),
  outputTools: read('src/story-output-tools.js'),
  utils: read('src/story-dnd-utils.js')
};

for (const token of [
  'application/x-hhjcon-ids',
  'application/x-hhjstory-ids',
  'application/x-hhjstory-block'
]) {
  if (!files.utils.includes(token)) fail(`src/story-dnd-utils.js no longer contains required DnD contract ${token}`);
}

const requiredHelpers = [
  ['src/app.js', files.app, 'CON_IDS_MIME'],
  ['src/app.js', files.app, 'STORY_IDS_MIME'],
  ['src/app.js', files.app, 'readTransferIds'],
  ['src/app.js', files.app, 'writeConTransfer'],
  ['src/app.js', files.app, 'writeStoryTransfer'],
  ['src/drag-start-fix.js', files.dragStart, 'writeConTransfer'],
  ['src/story-insertion.js', files.insertion, 'STORY_BLOCK_MIME'],
  ['src/story-insertion.js', files.insertion, 'STORY_IDS_MIME'],
  ['src/story-insertion.js', files.insertion, 'transferHasType'],
  ['src/story-insertion.js', files.insertion, 'writeStoryTransfer'],
  ['src/story-insertion.js', files.insertion, 'applyStoryDropTransfer'],
  ['src/story-insertion.js', files.insertion, 'moveStoryItemsBefore'],
  ['src/story-slot-mode.js', files.slot, 'applyStoryDropTransfer'],
  ['src/story-slot-mode.js', files.slot, 'CON_IDS_MIME'],
  ['src/story-slot-mode.js', files.slot, 'STORY_IDS_MIME'],
  ['src/story-slot-mode.js', files.slot, 'storyAreaDropEffect'],
  ['src/story-slot-mode.js', files.slot, 'transferHasType'],
  ['src/story-slot-mode.js', files.slot, 'writeStoryTransfer'],
  ['src/story-output-tools.js', files.outputTools, 'writeStoryTransfer'],
  ['src/story-output-tools.js', files.outputTools, 'moveStoryItemsBefore']
];

for (const [path, source, helper] of requiredHelpers) {
  if (!source.includes(helper)) fail(`${path} stopped using shared DnD helper ${helper}`);
}

if (!files.app.includes('export async function applyStoryDropTransfer')) fail('src/app.js no longer exposes the direct story drop mutation API');
if (!files.app.includes('export async function moveStoryItemsBefore')) fail('src/app.js no longer exposes the direct story id move command');

for (const [name, source] of Object.entries(files)) {
  if (source.includes('application/x-hhjstory-new-block')) fail(`${name} reintroduced retired application/x-hhjstory-new-block`);
}

for (const [path, source] of [
  ['src/app.js', files.app],
  ['src/drag-start-fix.js', files.dragStart],
  ['src/story-insertion.js', files.insertion],
  ['src/story-slot-mode.js', files.slot],
  ['src/story-output-tools.js', files.outputTools]
]) {
  if (source.includes('application/x-hhj')) fail(`${path} bypasses centralized DnD MIME helpers`);
}

const sharedUtilsImport = './story-dnd-utils.js?v=20260906-2';
for (const [path, source] of [
  ['src/app.js', files.app],
  ['src/drag-start-fix.js', files.dragStart],
  ['src/story-insertion.js', files.insertion],
  ['src/story-slot-mode.js', files.slot],
  ['src/story-output-tools.js', files.outputTools]
]) {
  if (!source.includes(sharedUtilsImport)) fail(`${path} does not use canonical DnD utility module version`);
}

const directAppImport = './app.js?v=20260906-17';
for (const [path, source] of [
  ['src/story-insertion.js', files.insertion],
  ['src/story-slot-mode.js', files.slot],
  ['src/story-output-tools.js', files.outputTools]
]) {
  if (!source.includes(directAppImport)) fail(`${path} does not import the canonical direct app mutation API module version`);
}
if (!index.includes('./src/app.js?v=20260906-17')) fail('index.html does not load the same app.js module version used by direct DnD mutation clients');

for (const [path, source] of [
  ['src/story-insertion.js', files.insertion],
  ['src/story-slot-mode.js', files.slot],
  ['src/story-output-tools.js', files.outputTools],
  ['src/story-dnd-utils.js', files.utils]
]) {
  if (source.includes("new Event('drop'") || source.includes('new Event("drop"')) fail(`${path} creates a retired synthetic drop`);
  if (source.includes('forwardDrop(')) fail(`${path} reintroduced retired synthetic drop forwarding`);
}

for (const [path, source] of [
  ['src/story-insertion.js', files.insertion],
  ['src/story-output-tools.js', files.outputTools]
]) {
  if (source.includes('new DataTransfer(')) fail(`${path} creates a fake DataTransfer for a non-DnD story mutation`);
}

if (!files.slot.includes("document.addEventListener('drop'")) fail('story-slot-mode.js no longer owns document-level story drop execution');
if (!files.slot.includes('pointInsideStoryList')) fail('story-slot-mode.js lost coordinate-based story area routing');
if (!files.slot.includes('storyConDragIds')) fail('story-slot-mode.js lost story con drag session ownership');
if (!files.insertion.includes('story-insert-slot')) fail('story-insertion.js lost current real drop hit slots before their replacement phase');

if (!process.exitCode) console.log('DnD structure contracts OK');
