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
  insertion: read('src/story-insertion.js'),
  slot: read('src/story-slot-mode.js'),
  stability: read('src/story-drag-stability.js'),
  runEnd: read('src/story-con-run-end-drop.js'),
  tail: read('src/story-tail-blank-drop.js')
};

const requiredContracts = [
  ['src/app.js', files.app, 'application/x-hhjcon-ids'],
  ['src/app.js', files.app, 'application/x-hhjstory-ids'],
  ['src/story-drag-guard.js', files.guard, 'application/x-hhjstory-ids'],
  ['src/story-insertion.js', files.insertion, 'application/x-hhjstory-block'],
  ['src/story-slot-mode.js', files.slot, 'application/x-hhjstory-ids'],
  ['src/story-slot-mode.js', files.slot, 'application/x-hhjcon-ids'],
  ['src/story-drag-stability.js', files.stability, 'application/x-hhjstory-ids']
];

for (const [path, source, token] of requiredContracts) {
  if (!source.includes(token)) fail(`${path} no longer contains required DnD contract ${token}`);
}

for (const [name, source] of Object.entries(files)) {
  if (source.includes('application/x-hhjstory-new-block')) {
    fail(`${name} reintroduced retired application/x-hhjstory-new-block`);
  }
}

if (!files.slot.includes('forwardDrop(')) {
  fail('story-slot-mode.js lost the current compatibility forwardDrop path before direct mutation API exists');
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
