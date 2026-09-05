const header = document.querySelector('.editor-header');
const WARNING = '(저장한 원고는 브라우저 데이터 삭제시 지워집니다. 원고 내보내기로 백업을 해두십시오.)';

function arrangeHeader() {
  if (!header || header.classList.contains('story-header-split')) return;
  const groups = [...header.children];
  if (groups.length < 2) return;
  const titleGroup = groups[0];
  const actionGroup = groups[1];
  const saveButton = [...actionGroup.querySelectorAll('button')].find(button => button.textContent.trim() === '원고 저장');
  const listButton = [...actionGroup.querySelectorAll('button')].find(button => button.textContent.trim() === '원고 목록');
  if (!saveButton || !listButton) return;

  const top = document.createElement('div');
  top.className = 'story-header-top';
  const saveActions = document.createElement('div');
  saveActions.className = 'story-header-save-actions';
  const editActions = document.createElement('div');
  editActions.className = 'story-header-edit-actions';

  saveActions.append(saveButton, listButton);
  [...actionGroup.children].forEach(child => editActions.append(child));
  top.append(titleGroup, saveActions);
  header.replaceChildren(top, editActions);
  header.classList.add('story-header-split');
}

function patchWarning(root = document) {
  root.querySelectorAll?.('.story-save-warning').forEach(element => {
    if (element.textContent !== WARNING) element.textContent = WARNING;
  });
}

if (header) {
  const style = document.createElement('style');
  style.textContent = '.editor-header.story-header-split{display:flex;flex-direction:column;align-items:stretch;gap:0;padding:0}.story-header-top{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px 7px}.story-header-top>div:first-child,.story-header-save-actions,.story-header-edit-actions{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.story-header-edit-actions{justify-content:flex-end;padding:0 12px 10px}.story-header-save-actions{justify-content:flex-end}@media(max-width:650px){.story-header-top{align-items:flex-start;flex-direction:column}.story-header-save-actions,.story-header-edit-actions{width:100%;justify-content:flex-start}}';
  document.head.append(style);
  arrangeHeader();
  const observer = new MutationObserver(records => {
    if (!header.classList.contains('story-header-split')) arrangeHeader();
    records.forEach(record => record.addedNodes.forEach(node => {
      if (node.nodeType === 1) patchWarning(node);
    }));
  });
  observer.observe(document.body, { childList: true, subtree: true });
  patchWarning();
}
