import fs from 'node:fs';

const workspace = fs.readFileSync('src/library/library-workspace.js', 'utf8');
const closeAll = fs.readFileSync('src/library/library-tab-close-all.js', 'utf8');
const collectionBackup = fs.readFileSync('src/collections/collection-backup.js', 'utf8');
const editorBackup = fs.readFileSync('src/backup/editor-backup.js', 'utf8');
const editorBackupStyles = fs.readFileSync('assets/styles/editor-backup.css', 'utf8');
const jsonDownload = fs.readFileSync('src/core/json-download.js', 'utf8');
const layoutResizer = fs.readFileSync('src/ui/layout-resizer.js', 'utf8');
const themeInit = fs.readFileSync('src/ui/theme-init.js', 'utf8');
const appReady = fs.readFileSync('src/ui/app-ready.js', 'utf8');
const baseStyles = fs.readFileSync('assets/styles/styles.css', 'utf8');
const workspaceStyles = fs.readFileSync('assets/styles/workspace-enhancements.css', 'utf8');
const themeStyles = fs.readFileSync('assets/styles/theme.css', 'utf8');
const textFormattingStyles = fs.readFileSync('assets/styles/text-formatting.css', 'utf8');
const controlRowPagerStyles = fs.readFileSync('assets/styles/control-row-pager.css', 'utf8');
const controlRowPager = fs.readFileSync('src/ui/control-row-pager.js', 'utf8');
const textFormatControls = fs.readFileSync('src/story/text-format-control-fix.js', 'utf8');
const colorUtils = fs.readFileSync('src/story/color-utils.js', 'utf8');
const storyHeaderLayout = fs.readFileSync('src/story/story-header-layout.js', 'utf8');
const storyHeaderLayoutStyles = fs.readFileSync('assets/styles/story-header-layout.css', 'utf8');
const storyOutputTools = fs.readFileSync('src/story-output-tools.js', 'utf8');
const storyHtmlCopy = fs.readFileSync('src/story/story-html-copy.js', 'utf8');
const storyOutputStyles = fs.readFileSync('assets/styles/story-output-tools.css', 'utf8');
const storySaveStyles = fs.readFileSync('assets/styles/story-save-manager.css', 'utf8');
const actionDialogs = fs.readFileSync('src/ui/action-dialogs.js', 'utf8');
const actionDialogStyles = fs.readFileSync('assets/styles/action-dialogs.css', 'utf8');
const storySaveManager = fs.readFileSync('src/story/story-save-manager.js', 'utf8');
const app = fs.readFileSync('src/app.js', 'utf8');
const model = fs.readFileSync('src/model.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const eventName = 'hhjcon:library-close-all';
const appImport = "../app.js?v=20260908-4";
const modelImport = "../model.js?v=20260908-1";
const selectionImport = "../core/selection.js?v=20260907-1";
const jsonDownloadImport = "../core/json-download.js?v=20260908-1";

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
if (!actionDialogs.includes("from '../app.js?v=20260908-4'")
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
if (!storySaveManager.includes("from '../ui/action-dialogs.js?v=20260909-1'")
  || !storySaveManager.includes('showConfirm, showPrompt')) {
  fail('story save manager must import the canonical async dialog API');
}
if (/\b(?:prompt|confirm)\s*\(/.test(storySaveManager)) {
  fail('story save manager must not call native prompt or confirm');
}
if (actionDialogs.includes('storySaveExists') || actionDialogs.includes('currentStoryHasItems')
  || actionDialogs.includes("button.closest('.story-save-actions')")) {
  fail('action dialog router must not intercept story save manager actions');
}
if (/window\.hhjUi(?:Alert|Confirm|Prompt)/.test(actionDialogs)) {
  fail('dialog APIs must remain module exports rather than unused global aliases');
}
if (actionDialogs.includes('armOneShot') || actionDialogs.includes('replay(')) {
  fail('public action dialogs must not inject native prompt or confirm results');
}
if (![collectionBackup, editorBackup, storySaveManager].every(source => source.includes(jsonDownloadImport))) {
  fail('JSON export modules must use the shared download helper');
}
if (![collectionBackup, editorBackup, storySaveManager].every(source => !source.includes('function downloadJson('))
  || !jsonDownload.includes('export function downloadJson(')) {
  fail('JSON download implementation must have one owner');
}
if (!index.includes('./src/ui/action-dialogs.js?v=20260909-1')
  || !index.includes('./src/story/story-save-manager.js?v=20260909-1')
  || !index.includes('./src/collections/collection-backup.js?v=20260908-3')
  || !index.includes('./src/backup/editor-backup.js?v=20260908-3')) {
  fail('index.html dialog and story-save cache versions are not canonical');
}
if (!workspaceStyles.includes('overflow: hidden')
  || !workspaceStyles.includes('.library-view-tab-main:first-child')
  || !workspaceStyles.includes('.library-view-tab-close:last-child')) {
  fail('library tabs must clip their button backgrounds to the rounded outer corners');
}
if (!layoutResizer.includes('const MIN_RATIO = 0.3;')
  || !layoutResizer.includes('const MAX_RATIO = 0.7;')
  || !layoutResizer.includes('const libraryWeight = Math.round(ratio * 1000);')
  || !layoutResizer.includes("`${1000 - libraryWeight}fr`")
  || !index.includes('aria-valuemin="30" aria-valuemax="70"')) {
  fail('workspace resize limits must preserve usable widths for both panels');
}
if (!themeStyles.includes(':root[data-theme="light"] .library-view-tab .library-view-tab-main,')
  || !themeStyles.includes(':root[data-theme="light"] .library-view-tab .library-view-tab-close { background: transparent; }')) {
  fail('light theme tab buttons must not cover the active tab underline');
}
if (!themeInit.includes("classList.add('hhj-app-booting')")
  || !baseStyles.includes('html.hhj-app-booting body { visibility: hidden; }')
  || !appReady.includes("classList.remove('hhj-app-booting')")
  || !index.includes('./src/ui/app-ready.js?v=20260908-1')
  || index.indexOf('./src/ui/app-ready.js?v=20260908-1') < index.indexOf('./src/backup/editor-backup.js')) {
  fail('the original HTML shell must stay hidden until enhancement modules finish');
}
if (!index.includes('./src/ui/theme-init.js?v=20260908-2')
  || !index.includes('./src/ui/layout-resizer.js?v=20260908-3')
  || !index.includes('./assets/styles/theme.css?v=20260908-1')
  || !index.includes('./assets/styles/styles.css?v=20260908-2')
  || !index.includes('./assets/styles/workspace-enhancements.css?v=20260908-2')) {
  fail('workspace UI cache versions are not canonical');
}
if (!model.includes('export const COLLECTION_NAME_MAX_LENGTH = 40;')
  || !model.includes('trimmed.length > COLLECTION_NAME_MAX_LENGTH')
  || !model.includes('rawName.slice(0, COLLECTION_NAME_MAX_LENGTH)')
  || !actionDialogs.includes("from '../model.js?v=20260908-1'")
  || !actionDialogs.includes('maxLength: COLLECTION_NAME_MAX_LENGTH')) {
  fail('collection names must use the shared 40-character limit for creation and import');
}
if (!index.includes('class="library-heading"')
  || !index.includes('class="library-title-scroll"')
  || !controlRowPagerStyles.includes('#selectionStatus { flex: 0 0 auto; white-space: nowrap; }')) {
  fail('library selection count must remain separate from the horizontally scrolling title');
}
if (!index.includes('./assets/styles/control-row-pager.css?v=20260908-2')
  || !index.includes('./src/ui/control-row-pager.js?v=20260908-2')
  || !controlRowPager.includes("document.querySelectorAll('.story-header-edit-actions, .text-format-toolbar')")
  || !controlRowPager.includes("offset - lines.at(-1) > 4")
  || !controlRowPager.includes('viewport.scrollTo({ top: lines[lineIndex] || 0')) {
  fail('narrow editor control rows must keep the one-line pager contract');
}
if (!textFormatControls.includes("from './color-utils.js?v=20260908-1'")
  || /function (?:clamp|normalizeHex|hexToHsv|hsvToHex)\(/.test(textFormatControls)
  || !['clamp', 'normalizeHex', 'hexToHsv', 'hsvToHex'].every(name => colorUtils.includes(`export function ${name}(`))
  || !index.includes('./src/story/text-format-control-fix.js?v=20260908-2')) {
  fail('text format controls must use the shared tested color utility module');
}
if (textFormatControls.includes("document.createElement('style')")
  || textFormatControls.includes('format-color-popup-style')
  || !textFormattingStyles.includes('.format-color-popup {')
  || !textFormattingStyles.includes('.format-color-sv {')
  || !textFormattingStyles.includes('.format-color-hue {')
  || !index.includes('./assets/styles/text-formatting.css?v=20260908-1')) {
  fail('the color popup must keep its presentation in the text formatting stylesheet');
}
if (storyHeaderLayout.includes("document.createElement('style')")
  || !storyHeaderLayoutStyles.includes(':root { --workspace-row-height: 42px; }')
  || !storyHeaderLayoutStyles.includes('.editor-header.story-header-split {')
  || !storyHeaderLayoutStyles.includes('@media (max-width: 900px)')
  || !index.includes('./assets/styles/story-header-layout.css?v=20260908-1')
  || !index.includes('./src/story/story-header-layout.js?v=20260908-1')) {
  fail('story header presentation must stay in its dedicated stylesheet');
}
if (storyOutputTools.includes("document.createElement('style')")
  || storyHtmlCopy.includes("document.createElement('style')")
  || !storyOutputStyles.includes('.story-image-placeholder {')
  || !storyOutputStyles.includes('.story-html-preview {')
  || !storyOutputStyles.includes('.story-html-copy {')
  || !storyOutputStyles.includes('.text-format-toolbar.html-preview-active .hhj-control-row-track > :not(.story-html-toggle):not(.story-html-copy)')
  || storyOutputStyles.includes('.text-format-toolbar.html-preview-active > :not(.story-html-toggle)')
  || !index.includes('./assets/styles/story-output-tools.css?v=20260908-2')
  || !index.includes('./src/story-output-tools.js?v=20260908-5')
  || !index.includes('./src/story/story-html-copy.js?v=20260908-1')) {
  fail('story output presentation must stay in its dedicated stylesheet');
}
if (storySaveManager.includes("document.createElement('style')")
  || !storySaveStyles.includes('.story-save-dialog {')
  || !storySaveStyles.includes('.story-save-row {')
  || !storySaveStyles.includes('@media (max-width: 650px)')
  || !storySaveManager.includes("label.textContent = '원고 백업 불러오기'")
  || !storySaveManager.includes('tools.append(save)')
  || !storySaveManager.includes('selectionTools.append(selectAll, clearAll, exportSelected, label)')
  || !index.includes('./assets/styles/story-save-manager.css?v=20260908-1')
  || !index.includes('./src/story/story-save-manager.js?v=20260909-1')) {
  fail('story save manager presentation must stay in its dedicated stylesheet');
}
if (editorBackup.includes("document.createElement('style')")
  || !editorBackupStyles.includes('.editor-backup-dialog {')
  || !editorBackupStyles.includes('.editor-backup-warning-dialog .editor-backup-head strong {')
  || !index.includes('./assets/styles/editor-backup.css?v=20260908-1')
  || !index.includes('./src/backup/editor-backup.js?v=20260908-3')) {
  fail('editor backup presentation must stay in its dedicated stylesheet');
}
if (actionDialogs.includes("document.createElement('style')")
  || actionDialogs.includes('installStyles')
  || !actionDialogStyles.includes('.hhj-ui-dialog {')
  || !actionDialogStyles.includes('.hhj-ui-dialog .danger-action {')
  || !actionDialogStyles.includes('.collection-backup-dialog {')
  || !index.includes('./assets/styles/action-dialogs.css?v=20260909-1')
  || !index.includes('./src/ui/action-dialogs.js?v=20260909-1')
  || !index.includes('./src/story/story-save-manager.js?v=20260909-1')) {
  fail('shared action dialog presentation must stay in its dedicated stylesheet');
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
