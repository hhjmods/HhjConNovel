import { showMissingConNotice } from '../collections/collection-missing-ui.js?v=20260914-1';
import { CON_IDS_MIME, STORY_IDS_MIME, readTransferIds } from '../story-dnd-utils.js?v=20260906-2';

function storyTool(text, title, action) {
  const button = document.createElement('button');
  button.className = 'icon-button';
  button.textContent = text;
  button.title = title;
  button.addEventListener('click', event => {
    event.stopPropagation();
    action();
  });
  return button;
}

function storyTools(item, onMove, onRemove) {
  const tools = document.createElement('div');
  tools.className = 'story-tools';
  tools.append(
    storyTool('↑', '위로', () => onMove(-1, item.id)),
    storyTool('↓', '아래로', () => onMove(1, item.id)),
    storyTool('×', '삭제', () => onRemove(item.id))
  );
  return tools;
}

function addDropHandlers(row, itemId, onDrop) {
  row.addEventListener('dragover', event => {
    const storyIds = readTransferIds(event.dataTransfer, STORY_IDS_MIME);
    const conIds = readTransferIds(event.dataTransfer, CON_IDS_MIME);
    if (!storyIds.length && !conIds.length) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = storyIds.length ? 'move' : 'copy';
    row.classList.add('story-drag-target');
  });
  row.addEventListener('dragleave', () => row.classList.remove('story-drag-target'));
  row.addEventListener('drop', async event => {
    event.preventDefault();
    row.classList.remove('story-drag-target');
    await onDrop(event.dataTransfer, itemId);
  });
}

export function renderStoryList(root, {
  items,
  cons,
  selectedIds,
  createMissingThumbnail,
  onTextInput,
  onMove,
  onRemove,
  onSelect,
  onDrop
}) {
  const consById = new Map(cons.map(con => [con.id, con]));
  root.replaceChildren();
  items.forEach(item => {
    const row = document.createElement('div');
    row.className = `story-item story-${item.type}`;
    row.dataset.storyId = item.id;
    row.classList.toggle('selected', selectedIds.has(item.id));
    addDropHandlers(row, item.id, onDrop);
    row.addEventListener('click', event => {
      const dragHandle = event.target.closest('.story-drag-handle');
      if (event.target.closest('.story-tools') || (dragHandle && !event.ctrlKey && !event.metaKey && !event.shiftKey)) return;
      const editing = event.target.closest('textarea, input, [contenteditable="true"]');
      if (editing) return;
      onSelect(event, item.id);
    });

    if (item.type === 'text') {
      const textarea = document.createElement('textarea');
      textarea.rows = 2;
      textarea.placeholder = '대사를 입력하세요.';
      textarea.value = item.text || '';
      textarea.addEventListener('input', async () => onTextInput(item.id, textarea.value));
      row.append(textarea, storyTools(item, onMove, onRemove));
    } else if (item.type === 'con') {
      const con = consById.get(item.conId);
      const conRef = item.conRef && typeof item.conRef === 'object' ? item.conRef : {};
      const missing = !con;
      row.draggable = true;
      row.classList.toggle('missing', missing);
      let thumbnail;
      if (con?.thumbnailUrl) {
        thumbnail = document.createElement('img');
        thumbnail.src = con.thumbnailUrl;
        thumbnail.alt = con.name || '';
      } else {
        thumbnail = createMissingThumbnail(missing ? '미보유콘' : '');
      }
      const label = document.createElement('span');
      label.textContent = con?.name || conRef.name || '미보유/미동기화 콘';
      row.append(thumbnail, label, storyTools(item, onMove, onRemove));
      row.addEventListener('click', event => {
        if (missing && !event.target.closest('.story-tools')) showMissingConNotice(conRef);
      });
    }
    root.append(row);
  });

  const tail = document.createElement('div');
  tail.className = 'story-tail-drop';
  tail.textContent = items.length ? '여기에 놓으면 원고 맨 뒤로 이동' : '';
  tail.addEventListener('dragover', event => {
    const storyIds = readTransferIds(event.dataTransfer, STORY_IDS_MIME);
    const conIds = readTransferIds(event.dataTransfer, CON_IDS_MIME);
    if (!storyIds.length && !conIds.length) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = storyIds.length ? 'move' : 'copy';
    tail.classList.add('drop-target');
  });
  tail.addEventListener('dragleave', () => tail.classList.remove('drop-target'));
  tail.addEventListener('drop', async event => {
    event.preventDefault();
    tail.classList.remove('drop-target');
    await onDrop(event.dataTransfer);
  });
  root.append(tail);
}
