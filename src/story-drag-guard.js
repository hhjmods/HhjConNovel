import { writeStoryTransfer } from './story-dnd-utils.js?v=20260906-2';

const storyList = document.getElementById('storyList');
const storyDropZone = document.getElementById('storyDropZone');

storyList?.addEventListener('dragstart', event => {
  const row = event.target.closest('.story-con');
  if (!row || !event.dataTransfer) return;
  const selectedRows = [...storyList.querySelectorAll('.story-con.selected')];
  const ids = row.classList.contains('selected')
    ? selectedRows.map(item => item.dataset.storyId).filter(Boolean)
    : [row.dataset.storyId].filter(Boolean);
  if (!ids.length) return;
  if (!row.classList.contains('selected')) {
    selectedRows.forEach(item => item.classList.remove('selected'));
    row.classList.add('selected');
  }
  writeStoryTransfer(event.dataTransfer, ids);
  event.stopPropagation();
}, true);

// 이 모듈은 native drop 허용만 담당한다. fixed guide를 쓰는 동안 구형 target class를 매 dragover마다
// 추가/제거하면 불필요한 DOM mutation이 계속 발생하므로 시각 상태는 story-slot-mode에 맡긴다.
storyList?.addEventListener('dragover', event => event.preventDefault(), true);
storyDropZone?.addEventListener('dragover', event => event.preventDefault(), true);
