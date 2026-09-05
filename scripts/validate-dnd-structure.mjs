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

const forbiddenIndexTerms = [
  'story-create-drag.js',
  'application/x-hhjstory-new-block'
];
for (const term of forbiddenIndexTerms) {
  if (index.includes(term)) fail(`index.html contains retired experimental DnD term: ${term}`);
}

const files = {
  app: read('src/app.js'),
  guard: read('src/story-drag-guard.js'),
  dragStart: read('src/drag-start-fix.js'),
  insertion: read('src/story-insertion.js'),
  slot: read('src/story-slot-mode.js'),
  stability: read('src/story-drag-stability.js'),
  runEnd: read('src/story-con-run-end-drop.js'),
  tail: read('src/story-tail-blank-drop.js'),
  outputTools: read('src/story-output-tools.js'),
  utils: read('src/story-dnd-utils.js')
};

const requiredContracts = [
  ['src/story-dnd-utils.js', files.utils, 'application/x-hhjcon-ids'],
  ['src/story-dnd-utils.js', files.utils, 'application/x-hhjstory-ids'],
  ['src/story-dnd-utils.js', files.utils, 'application/x-hhjstory-block'],
  ['src/app.js', files.app, 'application/x-hhjcon-ids'],
  ['src/app.js', files.app, 'application/x-hhjstory-ids']
];

for (const [path, source, token] of requiredContracts) {
  if (!source.includes(token)) fail(`${path} no longer contains required DnD contract ${token}`);
}

const requiredHelpers = [
  ['src/story-drag-guard.js', files.guard, 'writeStoryTransfer'],
  ['src/drag-start-fix.js', files.dragStart, 'writeConTransfer'],
  ['src/story-insertion.js', files.insertion, 'STORY_BLOCK_MIME'],
  ['src/story-insertion.js', files.insertion, 'STORY_IDS_MIME'],
  ['src/story-insertion.js', files.insertion, 'transferHasType'],
  ['src/story-insertion.js', files.insertion, 'writeStoryTransfer'],
  ['src/story-insertion.js', files.insertion, 'applyStoryDropTransfer'],
  ['src/story-slot-mode.js', files.slot, 'applyStoryDropTransfer'],
  ['src/story-slot-mode.js', files.slot, 'CON_IDS_MIME'],
  ['src/story-slot-mode.js', files.slot, 'STORY_IDS_MIME'],
  ['src/story-slot-mode.js', files.slot, 'transferHasType'],
  ['src/story-drag-stability.js', files.stability, 'readTransferIds'],
  ['src/story-drag-stability.js', files.stability, 'writeStoryTransfer'],
  ['src/story-con-run-end-drop.js', files.runEnd, 'storyAreaDropEffect'],
  ['src/story-con-run-end-drop.js', files.runEnd, 'applyStoryDropTransfer'],
  ['src/story-tail-blank-drop.js', files.tail, 'hasStoryAreaPayload'],
  ['src/story-tail-blank-drop.js', files.tail, 'storyAreaDropEffect'],
  ['src/story-tail-blank-drop.js', files.tail, 'applyStoryDropTransfer'],
  ['src/story-output-tools.js', files.outputTools, 'writeStoryTransfer'],
  ['src/story-output-tools.js', files.outputTools, 'applyStoryDropTransfer']
];

for (const [path, source, helper] of requiredHelpers) {
  if (!source.includes(helper)) fail(`${path} stopped using shared DnD helper ${helper}`);
}

if (!files.app.includes('export async function applyStoryDropTransfer')) {
  fail('src/app.js no longer exposes the direct story drop mutation API');
}

for (const [name, source] of Object.entries(files)) {
  if (source.includes('application/x-hhjstory-new-block')) {
    fail(`${name} reintroduced retired application/x-hhjstory-new-block`);
  }
}

for (const [path, source] of [
  ['src/story-drag-guard.js', files.guard],
  ['src/drag-start-fix.js', files.dragStart],
  ['src/story-insertion.js', files.insertion],
  ['src/story-slot-mode.js', files.slot],
  ['src/story-drag-stability.js', files.stability],
  ['src/story-con-run-end-drop.js', files.runEnd],
  ['src/story-tail-blank-drop.js', files.tail],
  ['src/story-output-tools.js', files.outputTools]
]) {
  if (source.includes('application/x-hhj')) fail(`${path} bypasses centralized DnD MIME helpers`);
}

const sharedUtilsImport = './story-dnd-utils.js?v=20260906-2';
for (const [path, source] of [
  ['src/story-drag-guard.js', files.guard],
  ['src/drag-start-fix.js', files.dragStart],
  ['src/story-insertion.js', files.insertion],
  ['src/story-slot-mode.js', files.slot],
  ['src/story-drag-stability.js', files.stability],
  ['src/story-con-run-end-drop.js', files.runEnd],
  ['src/story-tail-blank-drop.js', files.tail],
  ['src/story-output-tools.js', files.outputTools]
]) {
  if (!source.includes(sharedUtilsImport)) fail(`${path} does not use canonical DnD utility module version`);
}

const directAppImport = './app.js?v=20260906-16';
for (const [path, source] of [
  ['src/story-insertion.js', files.insertion],
  ['src/story-slot-mode.js', files.slot],
  ['src/story-con-run-end-drop.js', files.runEnd],
  ['src/story-tail-blank-drop.js', files.tail],
  ['src/story-output-tools.js', files.outputTools]
]) {
  if (!source.includes(directAppImport)) {
    fail(`${path} does not import the canonical direct app mutation API module version`);
  }
}
if (!index.includes('./src/app.js?v=20260906-16')) {
  fail('index.html does not load the same app.js module version used by direct DnD mutation clients');
}

for (const [path, source] of [
  ['src/story-insertion.js', files.insertion],
  ['src/story-slot-mode.js', files.slot],
  ['src/story-con-run-end-drop.js', files.runEnd],
  ['src/story-tail-blank-drop.js', files.tail],
  ['src/story-output-tools.js', files.outputTools],
  ['src/story-dnd-utils.js', files.utils]
]) {
  if (source.includes("new Event('drop'") || source.includes('new Event("drop"')) {
    fail(`${path} creates a retired synthetic drop`);
  }
  if (source.includes('forwardDrop(')) {
    fail(`${path} reintroduced retired synthetic drop forwarding`);
  }
}

if (!files.insertion.includes('story-insert-slot')) {
  fail('story-insertion.js lost current real drop hit slots before their replacement exists');
}
if (!files.runEnd.includes('hitZone')) {
  fail('story-con-run-end-drop.js lost current inline run-end hit zone');
}
if (!files.tail.includes('isLowerBlankPoint')) {
  fail('story-tail-blank-drop.js lost lower blank-area boundary protection');
}

if (!process.exitCode) console.log('DnD structure contracts OK');
