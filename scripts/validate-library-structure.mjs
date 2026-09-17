import fs from 'node:fs';

const workspace = fs.readFileSync('src/library/library-workspace.js', 'utf8');
const libraryTabs = fs.readFileSync('src/library/library-tabs.js', 'utf8');
const libraryRender = fs.readFileSync('src/library/library-render.js', 'utf8');
const libraryTabRender = fs.readFileSync('src/library/library-tab-render.js', 'utf8');
const libraryEditControls = fs.readFileSync('src/library/library-edit-controls.js', 'utf8');
const libraryEditDraft = fs.readFileSync('src/library/library-edit-draft.js', 'utf8');
const closeAll = fs.readFileSync('src/library/library-tab-close-all.js', 'utf8');
const collectionMissingUi = fs.readFileSync('src/collections/collection-missing-ui.js', 'utf8');
const dcconPurchaseUrl = fs.readFileSync('src/collections/dccon-purchase-url.js', 'utf8');
const collectionBackup = fs.readFileSync('src/collections/collection-backup.js', 'utf8');
const editorBackup = fs.readFileSync('src/backup/editor-backup.js', 'utf8');
const editorBackupStyles = fs.readFileSync('assets/styles/editor-backup.css', 'utf8');
const backupFormat = fs.readFileSync('src/core/backup-format.js', 'utf8');
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
const formatPresets = fs.readFileSync('src/story/format-presets.js', 'utf8');
const colorUtils = fs.readFileSync('src/story/color-utils.js', 'utf8');
const storyHeaderLayout = fs.readFileSync('src/story/story-header-layout.js', 'utf8');
const storyHeaderLayoutStyles = fs.readFileSync('assets/styles/story-header-layout.css', 'utf8');
const storyOutputTools = fs.readFileSync('src/story-output-tools.js', 'utf8');
const storyHtmlCopy = fs.readFileSync('src/story/story-html-copy.js', 'utf8');
const storyHtml = fs.readFileSync('src/story/story-html.js', 'utf8');
const storyHtmlUtils = fs.readFileSync('src/story/story-html-utils.js', 'utf8');
const textFormatting = fs.readFileSync('src/story/text-formatting.js', 'utf8');
const richHtml = fs.readFileSync('src/story/rich-html.js', 'utf8');
const storyOutputStyles = fs.readFileSync('assets/styles/story-output-tools.css', 'utf8');
const storySaveStyles = fs.readFileSync('assets/styles/story-save-manager.css', 'utf8');
const actionDialogs = fs.readFileSync('src/ui/action-dialogs.js', 'utf8');
const actionDialogStyles = fs.readFileSync('assets/styles/action-dialogs.css', 'utf8');
const toastUi = fs.readFileSync('src/ui/toast.js', 'utf8');
const storySaveManager = fs.readFileSync('src/story/story-save-manager.js', 'utf8');
const db = fs.readFileSync('src/db.js', 'utf8');
const storySaveFormat = fs.readFileSync('src/story/story-save-format.js', 'utf8');
const storySaveFolders = fs.readFileSync('src/story/story-save-folders.js', 'utf8');
const storyRender = fs.readFileSync('src/story/story-render.js', 'utf8');
const app = fs.readFileSync('src/app.js', 'utf8');
const model = fs.readFileSync('src/model.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const eventName = 'hhjcon:library-close-all';
const navigationRenderEvent = 'hhjcon:library-navigation-rendered';
const gridRenderEvent = 'hhjcon:library-grid-rendered';
const tabsRenderEvent = 'hhjcon:library-tabs-rendered';
const collectionCreatedEvent = 'hhjcon:collection-created';
const appImport = "../app.js?v=20260917-1";
const modelImport = "../model.js?v=20260912-1";
const selectionImport = "../core/selection.js?v=20260907-1";
const backupFormatImport = "../core/backup-format.js?v=20260910-1";
const jsonDownloadImport = "../core/json-download.js?v=20260909-3";
const libraryTabsImport = "./library-tabs.js?v=20260911-2";

function fail(message) {
  console.error(`Library structure validation failed: ${message}`);
  process.exitCode = 1;
}

if (!workspace.includes(eventName) || !closeAll.includes(eventName)) {
  fail('workspace and close-all control must share the atomic close event');
}
if (!libraryRender.includes(`root.dispatchEvent(new Event('${navigationRenderEvent}'))`)
  || !workspace.includes(`collectionList.addEventListener(NAVIGATION_RENDER_EVENT, queueRefreshData)`)
  || workspace.includes('new MutationObserver')) {
  fail('library navigation refresh must use the explicit render event');
}
if (!libraryRender.includes(`root.dispatchEvent(new Event('${gridRenderEvent}'))`)
  || !collectionMissingUi.includes(`addEventListener('${gridRenderEvent}', annotateMissingCards)`)
  || collectionMissingUi.includes('new MutationObserver')) {
  fail('missing con decoration must use the explicit grid render event');
}
if (!collectionMissingUi.includes('export async function showMissingConNotice(meta)')
  || !collectionMissingUi.includes("from './dccon-purchase-url.js?v=20260914-1'")
  || !collectionMissingUi.includes("import('../ui/action-dialogs.js?v=20260917-1')")
  || !collectionMissingUi.includes("window.open(purchaseUrl, '_blank', 'noopener,noreferrer')")
  || !dcconPurchaseUrl.includes("const DCCON_SEARCH_URL = 'https://dccon.dcinside.com/new/1/title/'")
  || !dcconPurchaseUrl.includes("!/^\\d+$/.test(sourcePackageId)")
  || !storyRender.includes("from '../collections/collection-missing-ui.js?v=20260917-1'")
  || !storyRender.includes('showMissingConNotice(conRef)')
  || app.includes('해당 콘을 구매하지 않았습니다.')) {
  fail('library and story missing cons must share one notice function');
}
if (!libraryTabRender.includes(`root.dispatchEvent(new Event('${tabsRenderEvent}'))`)
  || !closeAll.includes(`viewTabs.addEventListener(TABS_RENDER_EVENT, updateViewState)`)
  || closeAll.includes('new MutationObserver')
  || !libraryTabRender.includes(tabsRenderEvent)
  || !closeAll.includes(tabsRenderEvent)) {
  fail('library tab state must use the explicit tab render event');
}
if (!workspace.includes("from './library-tab-render.js?v=20260913-1'")
  || !workspace.includes('renderLibraryViewTabs(viewTabs')
  || workspace.includes("main.className = 'library-view-tab-main'")
  || !libraryTabRender.includes("tab.className = 'library-view-tab'")
  || !libraryTabRender.includes('await onDrop(event, view);')) {
  fail('library tab DOM construction must remain delegated to the tab renderer');
}
if (!workspace.includes("from './library-edit-controls.js?v=20260914-1'")
  || !workspace.includes('createCollectionEditControls(toolbarActions)')
  || workspace.includes("editControls.className = 'collection-edit-controls'")
  || !libraryEditControls.includes("root.className = 'collection-edit-controls'")
  || !libraryEditControls.includes('root.append(editButton, deleteButton, saveButton, cancelButton)')) {
  fail('collection edit control DOM must remain delegated to its renderer');
}
if (!workspace.includes(appImport) || !workspace.includes('commitCollectionDraft(collectionId, editDraft.items)')) {
  fail('collection draft saves must use the canonical app state command');
}
if (!workspace.includes(libraryTabsImport)
  || !workspace.includes('closeLibraryView(openViews, activeViewKey, key)')
  || !workspace.includes('openLibraryView(openViews, activeViewKey, { type, id, name }, activate)')
  || !workspace.includes('reconcileLibraryViews(')
  || workspace.includes('function keyOf(')
  || !libraryTabs.includes('export function closeLibraryView(')
  || !libraryTabs.includes('export function openLibraryView(')
  || !libraryTabs.includes('export function reconcileLibraryViews(')) {
  fail('library tab open, close, and restoration calculations must use the tested pure state module');
}
if (!workspace.includes("from '../story-dnd-utils.js?v=20260906-2'")
  || !workspace.includes('readTransferIds(event.dataTransfer, CON_IDS_MIME)')
  || !workspace.includes('transferHasType(event.dataTransfer, CON_IDS_MIME)')
  || workspace.includes("getData('application/x-hhjcon-ids')")) {
  fail('collection editing must reuse the shared con drag payload reader');
}
if (!app.includes("from './library/library-view.js?v=20260911-2'")
  || !app.includes('return selectVisibleCons(state);')) {
  fail('app library list calculation must use the tested pure selector');
}
const selectionStart = app.indexOf('function setSelection(');
const selectionEnd = app.indexOf('\n}', selectionStart);
const selectionSource = app.slice(selectionStart, selectionEnd);
if (selectionStart < 0
  || !selectionSource.includes("querySelectorAll('.con-card[data-con-id]')")
  || selectionSource.includes('renderGrid()')
  || app.includes('function setLibraryBoxSelection(')
  || !app.includes('setSelection\n});')) {
  fail('all library selection paths must update existing cards without rebuilding the grid');
}
if (!app.includes('function renderLibrary()')
  || !app.includes('function renderAll() {\n  renderLibrary();\n  renderStory();\n}')
  || (app.match(/renderAll\(\);/g) || []).length !== 2) {
  fail('library-only changes must not rebuild the story DOM');
}
if (!workspace.includes('addIdsToCollection(view.id, ids)')
  || !app.includes('export async function addIdsToCollection')
  || workspace.includes('forwardDrop(')
  || workspace.includes("new Event('drop'")) {
  fail('collection tab drops must call the app state command directly');
}
if (!libraryEditDraft.includes(selectionImport)
  || !libraryEditDraft.includes('planOrderedSelection(draft.items, draft.selectedIds, draft.anchorId, targetId, options)')) {
  fail('collection draft selection must use the shared ordered selection plan');
}
if (!libraryEditDraft.includes(modelImport)
  || !libraryEditDraft.includes('reorderOrderedIds(draft.items, movingIds, beforeId)')) {
  fail('collection draft reorder must use the shared ordered id calculation');
}
if (!workspace.includes("from './library-edit-draft.js?v=20260914-1'")
  || !workspace.includes('let editDraft = null;')
  || !workspace.includes('createCollectionEditDraft(')
  || !workspace.includes('selectCollectionEditDraft(editDraft, id, {')
  || !workspace.includes('prepareCollectionEditDrag(editDraft, fallbackId)')
  || !workspace.includes('reorderCollectionEditDraft(editDraft, ids, beforeId)')
  || !workspace.includes('deleteCollectionEditSelection(editDraft)')
  || workspace.includes('let draftItems =')
  || workspace.includes('let draftSelectedIds =')
  || workspace.includes('let draftAnchorId =')) {
  fail('collection edit state must remain one tested draft value');
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
if (!workspace.includes('let libraryDeleteArmed = false;')
  || !workspace.includes('libraryDeleteArmed = target instanceof Node && libraryPanel.contains(target);')
  || !workspace.includes("document.addEventListener('pointerdown', event => updateLibraryDeleteContext(event.target), true)")
  || !workspace.includes("document.addEventListener('focusin', event => updateLibraryDeleteContext(event.target), true)")
  || !workspace.includes('if (!editDraft || !libraryDeleteArmed) return;')) {
  fail('collection draft Delete must stay scoped to active library interaction');
}
if (!app.includes('function clearStorySelectionOutsideStory(target)')
  || !app.includes('if (el.storyList.contains(target) || el.storyDropZone.contains(target)) return;')
  || !app.includes("document.addEventListener('pointerdown', event => clearStorySelectionOutsideStory(event.target), true)")
  || !app.includes("document.addEventListener('focusin', event => clearStorySelectionOutsideStory(event.target), true)")) {
  fail('story selection must clear when interaction moves outside the story');
}
if (app.includes('exportCollectionBtn') || app.includes('importCollectionInput')) {
  fail('app.js must not register legacy collection file handlers');
}
if (!workspace.includes("document.querySelector('.story-item.selected')")) {
  fail('library Delete handling must yield to any selected story item type');
}
if (!collectionBackup.includes("exportButton.addEventListener('click', handleExport)")
  || !collectionBackup.includes("importInput.addEventListener('change', handleImport)")) {
  fail('collection backup module must own collection file handlers');
}
if (collectionBackup.includes('stopImmediatePropagation()') || collectionBackup.includes('capture: true')) {
  fail('collection file handlers must not rely on suppressing legacy listeners');
}
if (!actionDialogs.includes("from '../app.js?v=20260917-1'")
  || !actionDialogs.includes('createNamedCollection,')
  || !actionDialogs.includes('deleteCollectionById,')
  || !actionDialogs.includes('clearCurrentStory,')
  || !actionDialogs.includes('hasCurrentStoryItems')) {
  fail('action dialogs must import canonical app state commands');
}
if (!actionDialogs.includes('const collectionId = await createNamedCollection(collectionName)')
  || !actionDialogs.includes('await deleteCollectionById(collectionId)')) {
  fail('collection dialogs must call app state commands directly');
}
if (!actionDialogs.includes(`new CustomEvent('${collectionCreatedEvent}'`)
  || !workspace.includes(`const COLLECTION_CREATED_EVENT = '${collectionCreatedEvent}'`)
  || !workspace.includes('document.addEventListener(COLLECTION_CREATED_EVENT')
  || !workspace.includes("openView('collections', id, name, true)")
  || workspace.includes('pendingOpenCreatedCollection')) {
  fail('successful collection creation must explicitly open its matching library tab');
}
if (app.includes("el.newCollectionBtn.addEventListener('click'")
  || app.includes("del.addEventListener('click'")) {
  fail('app.js must not retain replay-only collection click handlers');
}
if (!libraryRender.includes('row.dataset.collectionId = collection.id')) {
  fail('collection rows must expose their stable id to the dialog action');
}
if (!actionDialogs.includes('if (hasCurrentStoryItems()) {')
  || !actionDialogs.includes('현재 편집 중인 원고의 모든 내용을 비웁니다.')
  || !actionDialogs.includes('await clearCurrentStory();')
  || !actionDialogs.includes("document.dispatchEvent(new Event('hhjcon:story-cleared'))")
  || !storySaveManager.includes("document.addEventListener('hhjcon:story-cleared', () => rememberSaveTarget('', ''))")
  || app.includes("el.clearStoryBtn.addEventListener('click'")) {
  fail('confirmed story clearing must reset the saved name after the app state command');
}
if (!storySaveManager.includes("from '../ui/action-dialogs.js?v=20260917-1'")
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
if (![collectionBackup, editorBackup, storySaveFormat].every(source => source.includes(backupFormatImport))
  || !backupFormat.includes('export function wrongBackupTypeMessage(')
  || !collectionBackup.includes("wrongBackupTypeMessage(data?.format, 'collection')")
  || !storySaveFormat.includes("wrongBackupTypeMessage(data?.format, 'story')")
  || !editorBackup.includes("wrongBackupTypeMessage(data?.format, 'editor')")
  || [collectionBackup, editorBackup, storySaveFormat].some(source => source.includes('백업파일입니다.'))) {
  fail('wrong backup type guidance must have one tested owner');
}
if (![collectionBackup, editorBackup, storySaveManager].every(source => !source.includes('function downloadJson('))
  || !jsonDownload.includes('export function downloadJson(')) {
  fail('JSON download implementation must have one owner');
}
if ([collectionBackup, editorBackup].some(source => source.includes('function safeFileName('))
  || storySaveManager.includes('const safeName =')
  || !jsonDownload.includes('export function sanitizeDownloadName(')
  || ![collectionBackup, editorBackup, storySaveManager].every(source => source.includes('sanitizeDownloadName('))) {
  fail('download filename sanitization must have one tested owner');
}
if ([collectionBackup, storySaveManager].some(source => source.includes('function backupFileName('))
  || !jsonDownload.includes('export function makeTimestampedBackupName(')
  || ![collectionBackup, storySaveManager].every(source => source.includes('makeTimestampedBackupName('))) {
  fail('timestamped bundle backup filenames must have one tested owner');
}
if ([editorBackup, storySaveManager].some(source => source.includes('function defaultName('))
  || !jsonDownload.includes('export function makeDatedDefaultName(')
  || !editorBackup.includes("makeDatedDefaultName('에디터 백업')")
  || !storySaveManager.includes("makeDatedDefaultName('콘문학')")) {
  fail('readable dated default names must have one tested owner');
}
if (!index.includes('./src/app.js?v=20260917-1')
  || !index.includes('./src/collections/collection-missing-ui.js?v=20260917-1')
  || !index.includes('./src/library/library-workspace.js?v=20260917-1')
  || !index.includes('./src/library/library-tab-close-all.js?v=20260910-1')
  || !index.includes('./src/ui/action-dialogs.js?v=20260917-1')
  || !index.includes('./src/story/story-save-manager.js?v=20260917-10')
  || !index.includes('./src/collections/collection-backup.js?v=20260912-1')
  || !index.includes('./src/backup/editor-backup.js?v=20260910-1')) {
  fail('index.html dialog and story-save cache versions are not canonical');
}
const topbarOrder = ['themeToggleBtn', 'tooltipToggle', 'editorBackupBtn', 'editorBackupRestoreBtn', 'syncDcBtn'];
if (topbarOrder.some((id, i) => i && index.indexOf(`id="${id}"`) <= index.indexOf(`id="${topbarOrder[i - 1]}"`))
  || !index.includes('id="editorBackupBtn" class="setup-link-button"')
  || !index.includes('id="editorBackupRestoreBtn" class="setup-link-button"')
  || index.indexOf('id="editorBackupRestoreBtn"') >= index.indexOf('class="bridge-setup-group"')) {
  fail('topbar backup controls must be compact and precede the bridge group and DC sync');
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
  || !index.includes('./assets/styles/theme.css?v=20260916-5')
  || !index.includes('./assets/styles/styles.css?v=20260917-3')
  || !baseStyles.includes('button:hover:not(:disabled)')
  || !themeStyles.includes('button:hover:not(:disabled)')
  || !index.includes('./assets/styles/workspace-enhancements.css?v=20260913-1')) {
  fail('workspace UI cache versions are not canonical');
}
if (!baseStyles.includes('.con-card { min-height: 140px;')
  || !baseStyles.includes('grid-template-columns: repeat(auto-fill, 116px)')
  || !baseStyles.includes('width: 100px; height: 100px; align-self: center; aspect-ratio: 1 / 1')) {
  fail('library con cards must keep fixed square 100px thumbnails');
}
if (!model.includes('export const COLLECTION_NAME_MAX_LENGTH = 40;')
  || !model.includes('trimmed.length > COLLECTION_NAME_MAX_LENGTH')
  || !model.includes('rawName.slice(0, COLLECTION_NAME_MAX_LENGTH)')
  || !actionDialogs.includes("from '../model.js?v=20260912-1'")
  || !actionDialogs.includes('maxLength: COLLECTION_NAME_MAX_LENGTH')) {
  fail('collection names must use the shared 40-character limit for creation and import');
}
if (!index.includes('class="library-heading"')
  || !index.includes('class="library-title-scroll"')
  || !controlRowPagerStyles.includes('#selectionStatus { flex: 0 0 auto; white-space: nowrap; }')) {
  fail('library selection count must remain separate from the horizontally scrolling title');
}
if (!index.includes('./assets/styles/control-row-pager.css?v=20260914-1')
  || !index.includes('./src/ui/control-row-pager.js?v=20260913-1')
  || !controlRowPager.includes("document.querySelectorAll('.story-header-edit-actions, .text-format-toolbar')")
  || !controlRowPager.includes("offset - lines.at(-1) > 4")
  || !controlRowPager.includes('viewport.scrollTo({ top: lines[lineIndex] || 0')
  || controlRowPagerStyles.includes('.story-header-edit-actions .hhj-control-row-track > .story-html-copy { margin-left: auto; }')
  || controlRowPager.includes('new MutationObserver')) {
  fail('narrow editor control rows must keep the one-line pager contract');
}
if (!textFormatControls.includes("from './color-utils.js?v=20260908-1'")
  || /function (?:clamp|normalizeHex|hexToHsv|hsvToHex)\(/.test(textFormatControls)
  || !['clamp', 'normalizeHex', 'hexToHsv', 'hsvToHex'].every(name => colorUtils.includes(`export function ${name}(`))
  || !textFormatControls.includes('function applyFontSize(pixelSize)')
  || !textFormatControls.includes("document.execCommand('fontSize', false, '7')")
  || !textFormatControls.includes('font.style.fontSize = pixelSize')
  || !textFormatControls.includes("pendingElement.style.fontSize === 'xxx-large'")
  || !textFormatControls.includes("parent?.tagName === 'SPAN' && parent.childNodes.length === 1")
  || !textFormatControls.includes('activeEditor.dataset.fontSizePx = pixelSize;\n    captureSelection();\n    normalizeFontSize(pixelSize);\n    restoreSelection();\n    captureSelection();')
  || !textFormatControls.includes("toolbar.addEventListener('hhjcon:apply-format-preset'")
  || !textFormatControls.includes('if (preset.align) applyCommand(preset.align);')
  || !textFormatControls.includes("applyCommand('removeFormat')")
  || !textFormatControls.includes("applyCommand('justifyLeft');")
  || !textFormatControls.includes("toolbar.addEventListener('hhjcon:open-format-color-picker'")
  || !textFormatControls.includes("source.closest('dialog[open]') || document.body")
  || !textFormatControls.includes('data-popup-action="reset"')
  || !textFormatControls.includes('function clearSelectedTextColor()')
  || !textFormatControls.includes('function removeEmptyInlineElements(root)')
  || textFormatControls.includes("applyCommand('foreColor', 'inherit')")
  || !textFormatControls.includes("applyCommand('hiliteColor', 'transparent', 'backColor')")
  || !index.includes('./src/story/text-format-control-fix.js?v=20260916-7')) {
  fail('text format controls must use the shared tested color utility module');
}
if (textFormatControls.includes("document.createElement('style')")
  || textFormatControls.includes('format-color-popup-style')
  || !textFormattingStyles.includes('.format-color-popup {')
  || !textFormattingStyles.includes('.format-color-sv {')
  || !textFormattingStyles.includes('.format-color-hue {')
  || !textFormattingStyles.includes('font-size: 12px;')
  || !textFormattingStyles.includes('.format-preset-dialog {')
  || !textFormattingStyles.includes('.format-color-reset-icon {')
  || !textFormatting.includes('class="format-color-reset-icon"')
  || !textFormattingStyles.includes('.format-align-menu:popover-open {')
  || !textFormattingStyles.includes('.format-align svg {')
  || !textFormattingStyles.includes('.format-preset-dialog[open] { display: flex; flex-direction: column; }')
  || !textFormattingStyles.includes('.format-preset-dialog .hhj-ui-dialog-body { min-height: 0; overflow-y: auto; }')
  || !index.includes('./assets/styles/text-formatting.css?v=20260916-7')) {
  fail('the color popup must keep its presentation in the text formatting stylesheet');
}
if (storyHeaderLayout.includes("document.createElement('style')")
  || !storyHeaderLayoutStyles.includes(':root { --workspace-row-height: 42px; }')
  || !storyHeaderLayoutStyles.includes('.editor-header.story-header-split {')
  || !storyHeaderLayoutStyles.includes('.editor-header > .story-header-top { align-items: flex-start; flex-direction: column; }')
  || !storyHeaderLayoutStyles.includes('@media (max-width: 900px)')
  || !index.includes('./assets/styles/story-header-layout.css?v=20260917-3')
  || storyHeaderLayout.includes('patchWarning')
  || storyHeaderLayout.includes('bodyObserver')
  || storyHeaderLayout.includes('new MutationObserver')
  || !workspace.includes("document.dispatchEvent(new Event('hhjcon:library-sidebar-rendered'))")
  || !storyHeaderLayout.includes("document.addEventListener('hhjcon:library-sidebar-rendered', scheduleTopSync)")
  || !storyHeaderLayout.includes("const toggleButton = document.querySelector('.story-html-toggle')")
  || !storyHeaderLayout.includes('ensureOutputPlacement()')
  || !index.includes('./src/story/story-header-layout.js?v=20260917-1')) {
  fail('story header presentation must stay in its dedicated stylesheet');
}
if (storyOutputTools.includes("document.createElement('style')")
  || storyHtmlCopy.includes("document.createElement('style')")
  || !storyOutputStyles.includes('.story-image-placeholder {')
  || !storyOutputStyles.includes('.story-html-preview {')
  || !storyOutputStyles.includes('.story-html-copy {')
  || !storyOutputStyles.includes('.text-format-toolbar.html-preview-active .hhj-control-row-track > :not(.story-html-toggle):not(.story-html-copy):not(.story-format-presets)')
  || storyOutputStyles.includes('.text-format-toolbar.html-preview-active > :not(.story-html-toggle)')
  || !index.includes('./assets/styles/story-output-tools.css?v=20260916-1')
  || !index.includes('./src/story-output-tools.js?v=20260917-2')
  || !index.includes('./src/story/story-html-copy.js?v=20260914-2')
  || !storyOutputTools.includes(".story-header-edit-actions button:not(.story-html-copy):not(.story-html-toggle):not(.story-format-presets)")
  || !storyOutputTools.includes('button.disabled = previewMode')
  || !storyOutputTools.includes("from './story/story-html.js?v=20260914-1'")
  || !storyOutputTools.includes("toolbar.insertBefore(toggle, toolbar.querySelector('.story-html-copy'))")
  || !storyHtmlCopy.includes("from './story-html.js?v=20260914-1'")
  || !storyHtmlCopy.includes('if (toggle) toggle.after(copyButton)')) {
  fail('story output presentation must stay in its dedicated stylesheet');
}
if (!storyHtml.includes("from './rich-html.js?v=20260914-1'")
  || !textFormatting.includes("from './rich-html.js?v=20260914-1'")
  || storyHtml.includes('function sanitizeRichHtml(')
  || textFormatting.includes('function sanitizeHtml(')
  || !richHtml.includes('export function sanitizeRichHtml(')
  || !richHtml.includes('export function copySafeStyle(')
  || !richHtml.includes('function flattenSingleChildSpan(span)')
  || !textFormatting.includes('<option value="">글꼴</option>')
  || !textFormatting.includes('<option value="Malgun Gothic" style="font-family:\'Malgun Gothic\'">맑은 고딕</option>')
  || !textFormatting.includes('<option value="MS UI Gothic" style="font-family:\'MS UI Gothic\'">MS UI Gothic</option>')
  || !textFormatting.includes("document.queryCommandValue('fontName')")
  || !textFormatting.includes('<option value="8px">8</option>')
  || !textFormatting.includes('<option value="96px">96</option>')
  || !textFormatting.includes("String(document.queryCommandValue('fontSize')) === '7'")
  || !textFormatting.includes("sizeSelect.value = '12px'")
  || textFormatting.includes('data-action="clear-background"')
  || !textFormatting.includes('data-color-apply="color"')
  || !textFormatting.includes('data-color-apply="background"')
  || !textFormatting.includes('data-action="toggle-align-menu"')
  || !textFormatting.includes("alignIcon('center')")
  || !textFormatting.includes('aria-label="문단 정렬"')
  || !textFormatting.includes('class="format-align-menu" role="menu" popover="manual"')
  || !textFormatting.includes('alignMenu.showPopover()')
  || !textFormatting.includes('function setAlignMenuOpen(open)')
  || textFormatting.includes('data-action="format-presets"')
  || !formatPresets.includes('data-use="align"')
  || !formatPresets.includes("trigger.textContent = '서식 프리셋'")
  || !formatPresets.includes("trigger.className = 'small story-format-presets'")
  || !formatPresets.includes("sample.textContent = '가나다ABCabc123'")
  || !formatPresets.includes("edit.textContent = '수정'")
  || !formatPresets.includes("id: editingId || crypto.randomUUID()")
  || !formatPresets.includes("presets.map(item => item.id === editingId ? preset : item)")
  || !textFormattingStyles.includes('grid-template-columns: 184px minmax(0, 1fr)')
  || !formatPresets.includes("toolbar?.querySelector('[data-format=\"font\"]')?.before(trigger)")
  || !formatPresets.includes("trigger.addEventListener('pointerdown', event => event.preventDefault())")
  || !index.includes('./src/story/text-formatting.js?v=20260916-6')
  || !index.includes('./src/story/format-presets.js?v=20260917-2')) {
  fail('rich text paste and story output must share the canonical sanitizer');
}
if (!storyHtml.includes("from './story-html-utils.js?v=20260912-3'")
  || storyHtml.includes('function validDcConSource(')
  || storyHtml.includes('function conHtml(')
  || !storyHtmlUtils.includes('export function validDcConSource(')
  || !storyHtmlUtils.includes('export function buildDcConHtml(')) {
  fail('DC con URL validation and HTML generation must stay in the tested utility module');
}
if (!storyHtmlUtils.includes('export function estimateDcHtmlCharCount(')
  || !storyOutputTools.includes('snapshot.dcHtmlCharCount > DC_HTML_LIMIT')
  || !storyHtmlCopy.includes('snapshot.dcHtmlCharCount > DC_HTML_LIMIT')) {
  fail('DC HTML estimate and over-limit warning must share the tested count');
}
if (storySaveManager.includes("document.createElement('style')")
  || !storySaveStyles.includes('.story-save-dialog {')
  || !storySaveStyles.includes('.story-save-row,')
  || !storySaveStyles.includes('.story-folder-row {')
  || !storySaveStyles.includes('@media (max-width: 650px)')
  || !storySaveManager.includes("label.textContent = '원고 백업 불러오기'")
  || !storySaveManager.includes("headActions.append(head.querySelector('strong'), save, newFolder)")
  || !storySaveManager.includes('selectionTools.append(selectGroup, deleteSelected, exportSelected, label)')
  || !storySaveManager.includes("selectAll.type = 'checkbox'")
  || !storySaveManager.includes("button.dataset.select = action")
  || !storySaveManager.includes("ui.selectAll.addEventListener('change'")
  || !storySaveManager.includes('row.append(check, info, actions)')
  || storySaveManager.includes('moveSelectedSaves(')
  || !storySaveStyles.includes('.story-save-parent-drop[hidden]')
  || !index.includes('./assets/styles/story-save-manager.css?v=20260917-6')
  || !storySaveManager.includes('warning.textContent = STORY_WARNING')
  || !index.includes('./src/story/story-save-manager.js?v=20260917-10')) {
  fail('story save manager presentation must stay in its dedicated stylesheet');
}
if (!storySaveManager.includes("const draftName = storyNameInput?.value.trim() || '';")
  || !storySaveManager.includes('const input = await showSavePrompt(folders, draftName,')
  || !storySaveManager.includes("input.value = initialName || makeDatedDefaultName('콘문학')")
  || !storySaveManager.includes('const folderSelect = createFolderSelect(folders, initialFolderId)')
  || !storySaveManager.includes("rememberSaveTarget(save.name, save.folderId || '')")
  || !storyHeaderLayout.includes('top.append(titleGroup, nameInput, saveActions)')
  || !storyHeaderLayoutStyles.includes('.story-header-top #storyStats')
  || !storySaveStyles.includes('.story-save-dialog[open] { display: flex; flex-direction: column; }')
  || !storySaveStyles.includes('min-height: 0;')) {
  fail('the draft name must prefill the save dialog without skipping folder selection, and the save list must scroll inside its dialog');
}
if (!storySaveManager.includes("head.innerHTML = '<strong>원고 목록</strong>'")
  || !storySaveManager.includes('actions.append(load, exp, rename, del)')
  || !storySaveManager.includes('const current = latestSaves.find(item => item.id === save.id)')
  || !storySaveManager.includes('item.id !== current.id && item.name === nextName')
  || !storySaveManager.includes("await putOne('documents', { ...current, name: nextName })")
  || !storySaveStyles.includes('.story-save-actions button { padding: 5px 8px; font-size: 12px; }')) {
  fail('saved manuscripts must support safe renaming and compact list controls');
}
if (!storySaveManager.includes("from './story-save-folders.js?v=20260917-1'")
  || !storySaveFolders.includes("STORY_FOLDER_DOCUMENT_ID = 'story-save-folders-v1'")
  || !storySaveManager.includes("makeImportedSave(parsed, names, '', sortOrder)")
  || !storySaveManager.includes('normalizeStoryFolderId(save.folderId, folders)')
  || !storySaveManager.includes("row.dataset.tooltipTitle = '저장된 원고'")
  || !storySaveManager.includes("row.addEventListener('dragstart', event => {")
  || !storySaveManager.includes('syncSelectionCheckbox(ui)')
  || !storySaveManager.includes('row.append(check, handle, open, actions)')
  || !storySaveManager.includes("newFolder.textContent = '+ 새 폴더'")
  || !storySaveManager.includes("trigger.setAttribute('aria-haspopup', 'listbox')")
  || !storySaveManager.includes("event.key === 'Escape'")) {
  fail('story folders must preserve legacy top-level saves and use the accessible folder picker');
}
if (!storySaveManager.includes("remove.textContent = '폴더 안 원고도 삭제'")
  || !storySaveManager.includes("title: '폴더와 원고 삭제', confirmText: '모두 삭제', danger: true")
  || !storySaveManager.includes("row.addEventListener('dragenter', guideRowDrop)")
  || !storySaveManager.includes("ui.parentDrop.addEventListener('dragenter'")
  || !storySaveManager.includes("row.addEventListener('dragenter', guideFolderRowDrop)")) {
  fail('story folder deletion must confirm contents twice, and native dragenter must accept save drops');
}
if (!storySaveManager.includes("event.dataTransfer.setData('application/x-hhj-story-folder'")
  || !storySaveManager.includes('dropStoryFolders(ui, beforeId)')
  || !storySaveFolders.includes('export function planStoryFolderPlacement(')
  || !storySaveStyles.includes('.story-folder-row.story-drop-before')) {
  fail('folder handles must reorder selected folders with native drag and visible drop guides');
}
if (!storySaveManager.includes("from './story-save-format.js?v=20260915-2'")
  || storySaveManager.includes('function parseImportData(')
  || storySaveManager.includes('function exportSave(')
  || !storySaveFormat.includes('export function parseImportData(')
  || !storySaveFormat.includes('export function exportSave(')) {
  fail('story save file parsing and serialization must stay in the tested pure format module');
}
if (!storySaveManager.includes("deleteSelected.textContent = '선택 항목 삭제'")
  || !storySaveManager.includes("if (!saveIds.size && !folderIds.size) return alert('삭제할 원고나 폴더를 하나 이상 선택하세요.')")
  || !storySaveManager.includes('function confirmStoryDeletion(firstLine)')
  || !storySaveManager.includes("title: '원고 삭제', confirmText: '삭제', danger: true")
  || storySaveManager.includes("title: '저장 원고 삭제'")
  || storySaveManager.includes("title: '선택 원고 삭제'")
  || !storySaveManager.includes('“${save.name}” 원고를 삭제합니다.')
  || !storySaveManager.includes('선택된 원고 ${saveIds.size}개를 삭제합니다.')
  || !storySaveManager.includes('chooseStoryFolderDeletion(folderIds.size, contained.length, saveIds.size)')
  || !storySaveManager.includes("applyMany('documents', folderIds.size ? [plan.document, ...plan.updates] : [], plan.deleteIds)")
  || !storySaveFolders.includes('export function planStoryFolderSelectionRemoval(')
  || !db.includes('export async function applyMany(')
  || !storySaveManager.includes("ui.deleteSelected.addEventListener('click'")) {
  fail('selected saves and folders must validate content and delete atomically after confirmation');
}
if (editorBackup.includes("document.createElement('style')")
  || !editorBackupStyles.includes('.editor-backup-dialog {')
  || !editorBackupStyles.includes('.editor-backup-warning-dialog .editor-backup-head strong {')
  || !index.includes('./assets/styles/editor-backup.css?v=20260908-1')
  || !index.includes('./src/backup/editor-backup.js?v=20260910-1')) {
  fail('editor backup presentation must stay in its dedicated stylesheet');
}
if (actionDialogs.includes("document.createElement('style')")
  || actionDialogs.includes('installStyles')
  || !actionDialogStyles.includes('.hhj-ui-dialog {')
  || !actionDialogStyles.includes('.hhj-ui-dialog .danger-action {')
  || !actionDialogStyles.includes('.collection-backup-dialog {')
  || !index.includes('./assets/styles/action-dialogs.css?v=20260909-1')
  || !index.includes('./src/ui/action-dialogs.js?v=20260917-1')
  || !index.includes('./src/story/story-save-manager.js?v=20260917-10')) {
  fail('shared action dialog presentation must stay in its dedicated stylesheet');
}
const toastClients = [app, collectionBackup, editorBackup, storySaveManager, storyHtmlCopy];
if (!toastUi.includes('export function showToast(message, duration = 2400)')
  || !toastUi.includes('export function saveToastForReload(message)')
  || !toastUi.includes('clearTimeout(hideTimer)')
  || !toastClients.every(source => source.includes('ui/toast.js?v=20260909-2'))
  || toastClients.some(source => /function\s+(?:toast|showToast)\s*\(/.test(source))
  || ![collectionBackup, editorBackup, storySaveManager].every(source => source.includes('saveToastForReload('))
  || [collectionBackup, editorBackup, storySaveManager].some(source => /sessionStorage\.(?:getItem|setItem|removeItem)\([^)]*toast/i.test(source))
  || !app.includes(', 1800)')
  || !storyHtmlCopy.includes(', 2600)')) {
  fail('toast messages must share one timer owner while preserving feature durations');
}
if (!app.includes("from './library/library-render.js?v=20260913-1'")
  || !app.includes('renderPackageNavigation(el.packageList')
  || !app.includes('renderCollectionNavigation(el.collectionList')
  || !app.includes('renderConGrid(el.conGrid')
  || app.includes("button.className = 'nav-item'")
  || app.includes("card.className = 'con-card'")
  || libraryRender.includes('.innerHTML')
  || !libraryRender.includes('button.append(name, count)')
  || !libraryRender.includes('card.append(thumbnail, name)')) {
  fail('library DOM construction must remain delegated to the library renderer');
}
if (!workspace.includes('viewTabs.addEventListener(CLOSE_ALL_EVENT, closeAllViews)')) {
  fail('workspace must own the close-all state mutation');
}
if (!workspace.includes('openViews = [];') || !workspace.includes("activeViewKey = '';")) {
  fail('close-all must clear open and active view state together');
}
if (!workspace.includes('openViews, activeViewKey, packages, collections, restorePending && shouldOpenDefaultView')) {
  fail('the default tab may only open during a first-run restoration');
}
if (!workspace.includes("if (activate && editDraft && key !== libraryViewKey('collections', editDraft.collectionId)) cancelEditState();")) {
  fail('switching library views must cancel collection editing');
}
if (!libraryEditControls.includes("editButton.classList.toggle('hidden', !hasItems || editing)")) {
  fail('empty collections must not expose collection editing');
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
