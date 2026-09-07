import fs from 'node:fs';

const workspace = fs.readFileSync('src/library/library-workspace.js', 'utf8');
const closeAll = fs.readFileSync('src/library/library-tab-close-all.js', 'utf8');
const collectionBackup = fs.readFileSync('src/collections/collection-backup.js', 'utf8');
const actionDialogs = fs.readFileSync('src/ui/action-dialogs.js', 'utf8');
const app = fs.readFileSync('src/app.js', 'utf8');
const eventName = 'hhjcon:library-close-all';
const appImport = "../app.js?v=20260908-3";
const modelImport = "../model.js?v=20260907-3";
const selectionImport = "../core/selection.js?v=20260907-1";

function fail(message) {
  console.error(`Library structure validation failed: ${message}`);
  process.exitCode = 1;
}

if (!workspace.includes(eventName) || !closeAll.includes(eventName)) {
  fail('workspace and close-all control must share the atomic close event');
}
if (!workspace.includes(appImport) || !workspace.includes('commitCollectionDraft(editCollectionId, draftItems)')) {
  fail('collection draft saves must use the canonical app state command');
}
if (!workspace.includes(selectionImport) || !workspace.includes('planOrderedSelection(draftItems, draftSelectedIds, draftAnchorId, id')) {
  fail('collection draft selection must use the shared ordered selection plan');
}
if (!workspace.includes(modelImport) || !workspace.includes('reorderOrderedIds(draftItems, ids, beforeId)')) {
  fail('collection draft reorder must use the shared ordered id calculation');
}
if (workspace.includes('location.reload()')) {
  fail('collection draft saves must not reload the whole page');
}
if (!workspace.includes('function deleteDraftSelection()') || !workspace.includes("deleteButton.addEventListener('click', deleteDraftSelection)")) {
  fail('collection item deletion must remain inside the explicit edit draft flow');
}
if (app.includes('removeSelectedFromCollection') || app.includes("event.key === 'Delete' && state.activeTab === 'collections'")) {
  fail('normal collection view must not expose direct Delete-key persistence');
}
if (app.includes('exportCollectionBtn') || app.includes('importCollectionInput')) {
  fail('app.js must not register legacy collection file handlers');
}
if (!collectionBackup.includes("exportButton.addEventListener('click', handleExport)")
  || !collectionBackup.includes("importInput.addEventListener('change', handleImport)")) {
  fail('collection backup module must own collection file handlers');
}
if (collectionBackup.includes('stopImmediatePropagation()') || collectionBackup.includes('capture: true')) {
  fail('collection file handlers must not rely on suppressing legacy listeners');
}
if (!actionDialogs.includes("from '../app.js?v=20260908-3'")
  || !actionDialogs.includes('createNamedCollection,')
  || !actionDialogs.includes('deleteCollectionById,')
  || !actionDialogs.includes('clearCurrentStory,')
  || !actionDialogs.includes('hasCurrentStoryItems')) {
  fail('action dialogs must import canonical app state commands');
}
if (!actionDialogs.includes('await createNamedCollection(name.trim())')
  || !actionDialogs.includes('await deleteCollectionById(collectionId)')) {
  fail('collection dialogs must call app state commands directly');
}
if (app.includes("el.newCollectionBtn.addEventListener('click'")
  || app.includes("del.addEventListener('click'")) {
  fail('app.js must not retain replay-only collection click handlers');
}
if (!app.includes('row.dataset.collectionId = collection.id')) {
  fail('collection rows must expose their stable id to the dialog action');
}
if (!actionDialogs.includes('if (!hasCurrentStoryItems()) return clearCurrentStory()')
  || !actionDialogs.includes('if (ok) await clearCurrentStory()')
  || app.includes("el.clearStoryBtn.addEventListener('click'")) {
  fail('clear-story dialog must call the app state command without button replay');
}
if (!workspace.includes('viewTabs.addEventListener(CLOSE_ALL_EVENT, closeAllViews)')) {
  fail('workspace must own the close-all state mutation');
}
if (!workspace.includes('openViews = [];') || !workspace.includes("activeViewKey = '';")) {
  fail('close-all must clear open and active view state together');
}
if (!workspace.includes('if (!openViews.length && packages[0] && restorePending && shouldOpenDefaultView)')) {
  fail('the default tab may only open during a first-run restoration');
}
if (!workspace.includes('let shouldOpenDefaultView = localStorage.getItem(VIEWS_KEY) === null;')) {
  fail('first-run state must be distinguished from an explicitly saved empty tab list');
}
if ((workspace.match(/shouldOpenDefaultView = false;/g) || []).length < 3) {
  fail('opening, closing all, and default restoration must consume first-run state');
}
if (/\.click\s*\(/.test(closeAll)) {
  fail('close-all control must not simulate individual close button clicks');
}

if (!process.exitCode) console.log('Library tab state contracts OK');
