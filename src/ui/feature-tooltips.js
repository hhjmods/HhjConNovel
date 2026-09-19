import { placeFeatureTooltip } from './feature-tooltip-position.js?v=20260916-1';

// 기존 화면의 설명은 이 목록에 모으고, 새 UI는 data-tooltip-title/description 속성만 붙이면 된다.
const descriptions = [
  ['#themeToggleBtn', '화면 테마', '밝은 화면과 어두운 화면을 전환합니다.'],
  ['.dc-connect-box a[href$="/USAGE.md"]', '사용법', '편집기의 전체 사용법을 새 탭에서 엽니다.'],
  ['.dc-connect-box a[href^="https://www.tampermonkey.net/"]', 'Tampermonkey 설치', 'DC 브리지를 실행하는 브라우저 확장 프로그램을 설치합니다.'],
  ['.dc-connect-box a[href^="./bridge/"]', 'DC 브리지 설치', '디시콘 동기화와 DC 글쓰기 붙여넣기에 필요한 스크립트를 설치합니다.'],
  ['#editorBackupBtn', '에디터 백업', '콘묶음·원고·설정 등 편집기 데이터를 파일로 저장합니다.'],
  ['#editorBackupRestoreBtn', '에디터 백업 불러오기', '에디터 백업 파일을 불러와 저장된 데이터를 복원합니다.'],
  ['#demoBtn', '개발용 데모', '동작 확인을 위한 예시 데이터를 불러옵니다.'],
  ['[data-library-tab="packages"]', '디시콘', '동기화된 디시콘 묶음 목록을 봅니다.'],
  ['[data-library-tab="collections"]', '내 콘묶음', '직접 만든 콘묶음 목록을 봅니다.'],
  ['#newCollectionBtn', '새 콘묶음', '선택한 콘을 모아 둘 새 콘묶음을 만듭니다.'],
  ['#exportCollectionBtn', '콘묶음 내보내기', '콘묶음을 파일로 백업합니다.'],
  ['.collection-transfer-row .file-button', '콘묶음 불러오기', '백업한 콘묶음 파일을 불러옵니다.'],
  ['#packageList .nav-item', '디시콘 묶음 열기', '이 디시콘 묶음의 콘을 새 탭에서 봅니다.'],
  ['#collectionList .collection-main', '내 콘묶음 열기', '이 콘묶음의 콘을 새 탭에서 봅니다. 이곳에 디시콘을 끌어다 놓으면 콘묶음에 그 콘을 추가할 수 있습니다.'],
  ['#collectionList .collection-row > .icon-button', '콘묶음 삭제', '이 콘묶음을 삭제합니다.'],
  ['.library-view-tab-main', '콘 탭 전환', '열어 둔 디시콘 또는 콘묶음으로 이동합니다.'],
  ['.library-view-tab-close', '탭 닫기', '이 콘 탭만 닫습니다.'],
  ['.library-view-close-all', '탭 전체 닫기', '열려 있는 콘 탭을 모두 닫습니다.'],
  ['#searchInput', '콘 이름 검색', '현재 열린 목록에서 콘 이름을 검색합니다.'],
  ['.con-card.missing', '미보유 디시콘', '현재 계정에 없는 콘입니다. 클릭하면 원본 디시콘 묶음과 구매 페이지를 안내합니다.'],
  ['.con-card', '디시콘', '더블클릭하면 원고 끝에 추가하고, 끌어 놓으면 원하는 위치에 넣습니다. Ctrl/Shift+클릭으로 여러 개를 선택할 수 있습니다. 내 콘묶음으로 끌어 놓으면 그 묶음에 추가됩니다.'],
  ['#selectAllBtn', '전체 선택', '현재 목록에 표시된 콘을 모두 선택합니다.'],
  ['#clearSelectionBtn', '선택 해제', '현재 선택한 콘을 모두 해제합니다.'],
  ['.collection-edit-controls button:nth-child(1)', '콘 편집', '이 콘묶음에서 콘 삭제나 순서 변경을 시작합니다.'],
  ['.collection-edit-controls button:nth-child(2)', '선택 콘 삭제', '편집 중 선택한 콘을 콘묶음에서 제거합니다.'],
  ['.collection-edit-controls button:nth-child(3)', '편집 저장', '콘묶음 편집 내용을 저장합니다.'],
  ['.collection-edit-controls button:nth-child(4)', '편집 취소', '저장하지 않은 콘묶음 편집을 취소합니다.'],
  ['.story-header-save-actions button:first-child', '원고 저장', '현재 작성 중인 원고를 저장합니다.'],
  ['.story-header-save-actions button:last-child', '원고 목록', '저장한 원고와 폴더를 관리합니다.'],
  ['.story-save-head .icon-button', '원고 목록 닫기', '원고 목록을 닫습니다.'],
  ['.story-save-head-actions > button:nth-child(2)', '현재 원고 저장', '현재 작성 중인 원고의 이름과 저장 위치를 확인한 뒤 저장합니다.'],
  ['.story-save-head-actions > button:nth-child(3)', '새 폴더', '저장 원고를 정리할 폴더를 만듭니다.'],
  ['.story-save-select-group > input', '전체 선택', '체크하면 현재 목록의 원고와 폴더를 모두 선택하고, 해제하면 선택을 지웁니다.'],
  ['.story-save-select-menu summary', '선택 종류', '폴더만 선택하거나 원고만 선택할 수 있습니다.'],
  ['.story-save-select-options [data-select="folders"]', '폴더 선택', '현재 목록의 폴더만 모두 선택합니다.'],
  ['.story-save-select-options [data-select="saves"]', '원고 선택', '현재 목록의 원고만 모두 선택합니다.'],
  ['.story-save-select-options [data-select="clear"]', '선택 해제', '현재 목록의 선택을 모두 지웁니다.'],
  ['.story-save-selection-tools > button:nth-child(2)', '선택 항목 삭제', '체크한 원고와 폴더를 삭제합니다. 폴더 안의 원고를 함께 삭제할지 선택할 수 있습니다.'],
  ['.story-save-selection-tools > button:nth-child(3)', '선택 항목 내보내기', '체크한 원고와 폴더를 백업 파일로 내보냅니다.'],
  ['.story-save-selection-tools .file-button', '원고 백업 불러오기', '백업 파일에서 원고를 불러옵니다.'],
  ['.story-save-location > button', '최상위로 이동', '폴더 밖의 최상위 원고 목록으로 돌아갑니다.'],
  ['.story-folder-row .story-save-drag-handle', '폴더 이동 손잡이', '끌어 놓아 폴더 순서를 바꿉니다.'],
  ['.story-folder-check, .story-save-check', '항목 선택', '여러 원고와 폴더를 함께 이동·내보내기·삭제할 때 체크합니다.'],
  ['.story-folder-main', '폴더 열기', '이 폴더에 저장된 원고 목록을 엽니다.'],
  ['.story-folder-row .story-save-actions > button:nth-child(1)', '폴더 내보내기', '이 폴더와 안의 원고를 백업 파일로 내보냅니다.'],
  ['.story-folder-row .story-save-actions > button:nth-child(2)', '폴더 이름 변경', '폴더 이름을 바꿉니다.'],
  ['.story-folder-row .story-save-actions > button:nth-child(3)', '폴더 삭제', '폴더를 삭제합니다. 안의 원고를 남길지 함께 삭제할지 선택할 수 있습니다.'],
  ['.story-save-row .story-save-actions > button:nth-child(1)', '원고 불러오기', '저장된 원고를 편집기로 불러옵니다.'],
  ['.story-save-row .story-save-actions > button:nth-child(2)', '원고 내보내기', '이 원고를 백업 파일로 내보냅니다.'],
  ['.story-save-row .story-save-actions > button:nth-child(3)', '원고 이름 변경', '저장된 원고의 이름을 바꿉니다.'],
  ['.story-save-row .story-save-actions > button:nth-child(4)', '원고 삭제', '이 원고를 삭제합니다. 삭제 전 확인창이 열립니다.'],
  ['.story-tools > button:nth-last-child(3)', '위로 이동', '이 블록을 한 칸 위로 옮깁니다. 여러 블록을 선택했다면 함께 이동합니다.'],
  ['.story-tools > button:nth-last-child(2)', '아래로 이동', '이 블록을 한 칸 아래로 옮깁니다. 여러 블록을 선택했다면 함께 이동합니다.'],
  ['.story-tools > button:last-child', '블록 삭제', '이 블록 또는 선택한 블록들을 삭제합니다. 대사가 포함되면 한 번 더 눌러 확인합니다.'],
  ['.story-tools .con-size-toggle', '대왕콘 전환', '일반콘과 대왕콘 크기를 전환합니다. 여러 콘을 선택했다면 함께 바뀝니다.'],
  ['.story-drag-handle', '블록 이동 손잡이', '끌어 놓아 이 블록을 원고 안에서 이동합니다. Ctrl/Shift를 누른 채 클릭하면 여러 블록을 선택할 수 있습니다.'],
  ['.story-break, .story-break-count-control, .story-break-count-input', '줄바꿈 블록', target => `이 위치에서 ${Number(target.closest('.story-break')?.dataset.breakCount) || 1}줄 줄바꿈합니다. 숫자 입력칸에서 줄 수를 바꿀 수 있습니다. 연속된 콘 삽입시 필요하다면 콘과 콘 사이 줄바꿈을 위해서도 사용합니다.`],
  ['.story-image-placeholder, .story-image-memo-input', '이미지 자료 위치 마커', '나중에 DC 글쓰기에서 이미지를 넣을 위치를 표시합니다. 메모로 어떤 이미지인지 구분할 수 있습니다.'],
  ['.story-text, .story-text .rich-text-editor', '대사 블록', '대사를 입력합니다. 글자를 드래그해 선택한 뒤 위 메뉴의 서식 버튼으로 글꼴·크기·색 등을 적용할 수 있습니다. 엔터로 줄바꿈하며 장문의 서술을 입력할 때 사용해도 됩니다. 우측 하단을 잡고 끌어 대사입력창의 크기를 조절 할 수 있습니다.'],
  ['#addSelectedConsBtn', '선택한 콘 추가', '라이브러리에서 선택한 콘을 원고 끝에 추가합니다.'],
  ['.story-header-edit-actions .story-create-drag-source', button => button.textContent.trim().replace(/^\\+\\s*/, ''), '클릭하면 원고 끝에 추가하고, 끌어 놓으면 원하는 위치에 넣습니다.'],
  ['#clearStoryBtn', '원고 비우기', '현재 원고의 블록을 모두 비웁니다.'],
  ['.story-html-toggle', 'HTML/블록 보기', '원고의 HTML 코드를 보거나 블록 편집 화면으로 돌아갑니다.'],
  ['.story-html-copy', '작성내용 복사', 'DC 글쓰기 창에 붙여넣을 수 있게 현재 원고를 복사합니다.'],
  ['.story-format-presets', '서식 프리셋', '자주 쓰는 글자 서식을 저장하고 선택한 글자에 적용합니다.'],
  ['.text-format-toolbar [data-format="font"]', '글꼴', '선택한 글자의 글꼴을 바꿉니다.'],
  ['.text-format-toolbar [data-format="size"]', '글자 크기', '선택한 글자의 크기를 바꿉니다.'],
  ['.text-format-toolbar [data-color-apply="color"]', '글자색 적용', '현재 선택된 글자색을 바로 적용합니다.'],
  ['.text-format-toolbar [data-format="color"]', '글자색 선택', '글자색을 고르거나 기본색으로 되돌립니다.'],
  ['.text-format-toolbar [data-color-apply="background"]', '배경색 적용', '현재 선택된 배경색을 바로 적용합니다.'],
  ['.text-format-toolbar [data-format="background"]', '배경색 선택', '글자 배경색을 고르거나 투명하게 되돌립니다.'],
  ['.text-format-toolbar [data-command="bold"]', '굵게', '선택한 글자를 굵게 표시하거나 해제합니다.'],
  ['.text-format-toolbar [data-command="italic"]', '기울임', '선택한 글자를 기울여 표시하거나 해제합니다.'],
  ['.text-format-toolbar [data-command="underline"]', '밑줄', '선택한 글자에 밑줄을 넣거나 해제합니다.'],
  ['.text-format-toolbar [data-command="strikeThrough"]', '취소선', '선택한 글자에 취소선을 넣거나 해제합니다.'],
  ['.text-format-toolbar [data-action="toggle-align-menu"]', '문단 정렬', '대사를 왼쪽·가운데·오른쪽으로 정렬하거나 해제합니다.'],
  ['.text-format-toolbar [data-action="remove-format"]', '서식 초기화', '선택한 글자의 서식을 지웁니다.']
];

const bridgeHelp = document.querySelector('.bridge-help');
if (bridgeHelp) {
  const introKey = 'hhjcon-bridge-help-intro-shown';
  let shouldShowIntro = true;
  try {
    shouldShowIntro = localStorage.getItem(introKey) !== 'yes';
    if (shouldShowIntro) localStorage.setItem(introKey, 'yes');
  } catch { /* 저장소가 막힌 경우 현재 방문에서만 표시 */ }

  if (shouldShowIntro) {
    bridgeHelp.classList.add('bridge-help-intro-open');
    const closeIntro = () => {
      bridgeHelp.classList.remove('bridge-help-intro-open');
      document.removeEventListener('pointerdown', closeIntro, true);
      document.removeEventListener('keydown', closeIntro, true);
      window.removeEventListener('scroll', closeIntro, true);
    };
    document.addEventListener('pointerdown', closeIntro, true);
    document.addEventListener('keydown', closeIntro, true);
    window.addEventListener('scroll', closeIntro, true);
  }
}

const toggle = document.getElementById('tooltipToggle');
if (toggle) {
  const key = 'hhjcon-feature-tooltips';
  let enabled = true;
  try { enabled = localStorage.getItem(key) !== 'off'; } catch { /* 저장소가 막힌 경우 현재 탭에서만 사용 */ }

  const tooltip = document.createElement('div');
  tooltip.id = 'featureTooltip';
  tooltip.className = 'feature-tooltip';
  tooltip.setAttribute('role', 'tooltip');
  tooltip.hidden = true;
  const heading = document.createElement('strong');
  const detail = document.createElement('span');
  tooltip.append(heading, detail);
  document.body.append(tooltip);

  let active = null;
  let timer = 0;
  let lastInputWasTouch = false;

  function findDescription(node) {
    if (!(node instanceof Element)) return null;
    const target = node.closest('button, a, label, input, select, textarea, summary, [contenteditable="true"], [data-tooltip-title], .story-item');
    if (!target) return null;
    if (target === document.activeElement && target.matches('.rich-text-editor, .story-image-memo-input')) return null;
    if (target.dataset.tooltipTitle) {
      return { target, title: target.dataset.tooltipTitle, description: target.dataset.tooltipDescription || '' };
    }
    for (const [selector, title, description] of descriptions) {
      if (target.matches(selector)) {
        return { target, title: typeof title === 'function' ? title(target) : title, description: typeof description === 'function' ? description(target) : description };
      }
    }
    return null;
  }

  // 기존 title 브라우저 팝업과 새 설명이 겹치지 않게 한다. 아이콘의 접근성 이름은 남긴다.
  function suppressNativeTitle(target) {
    const storyRow = target.closest('.story-item');
    if (storyRow && storyRow !== target) storyRow.removeAttribute('title');
    if (!target.hasAttribute('title')) return;
    if (!target.hasAttribute('aria-label') && (target.textContent.trim().length <= 2 || target.querySelector('svg'))) {
      target.setAttribute('aria-label', target.title);
    }
    target.removeAttribute('title');
  }

  function hide() {
    clearTimeout(timer);
    timer = 0;
    if (active) {
      const ids = (active.getAttribute('aria-describedby') || '').split(/\\s+/).filter(id => id && id !== tooltip.id);
      if (ids.length) active.setAttribute('aria-describedby', ids.join(' '));
      else active.removeAttribute('aria-describedby');
    }
    active = null;
    tooltip.hidden = true;
  }

  function schedule(entry, delay, pointerY = null) {
    if (!enabled || entry.target.matches(':disabled') || entry.target === active) return;
    hide();
    active = entry.target;
    heading.textContent = entry.title;
    detail.textContent = entry.description;
    detail.hidden = !entry.description;
    const ids = (active.getAttribute('aria-describedby') || '').split(/\\s+/).filter(Boolean);
    if (!ids.includes(tooltip.id)) active.setAttribute('aria-describedby', [...ids, tooltip.id].join(' '));
    timer = window.setTimeout(() => {
      timer = 0;
      if (!enabled || !active?.isConnected) { hide(); return; }
      const host = active.closest('dialog[open]') || document.body;
      if (tooltip.parentElement !== host) host.append(tooltip);
      tooltip.hidden = false;
      tooltip.style.visibility = 'hidden';
      const rect = active.getBoundingClientRect();
      const size = tooltip.getBoundingClientRect();
      const anchor = active.dataset.tooltipAnchor === 'pointer' && pointerY !== null
        ? { left: rect.left, width: rect.width, top: pointerY, bottom: pointerY } : rect;
      const position = placeFeatureTooltip(anchor, size, { width: innerWidth, height: innerHeight });
      tooltip.style.left = `${position.left}px`;
      tooltip.style.top = `${position.top}px`;
      tooltip.style.visibility = '';
    }, delay);
  }

  function renderToggle() {
    toggle.setAttribute('aria-checked', String(enabled));
    toggle.querySelector('.tooltip-toggle-state').textContent = enabled ? 'ON' : 'OFF';
  }

  toggle.addEventListener('click', () => {
    hide();
    enabled = !enabled;
    try { localStorage.setItem(key, enabled ? 'on' : 'off'); } catch { /* 현재 탭 상태만 유지 */ }
    renderToggle();
  });
  renderToggle();

  document.addEventListener('pointerover', event => {
    if (event.pointerType === 'touch') return;
    const entry = findDescription(event.target);
    if (!entry) {
      if (active?.contains(event.target)) hide();
      return;
    }
    suppressNativeTitle(entry.target);
    schedule(entry, 190, event.clientY);
  });
  document.addEventListener('pointerout', event => {
    if (event.pointerType === 'touch' || !active?.contains(event.target)) return;
    if (event.relatedTarget instanceof Node && active.contains(event.relatedTarget)) return;
    hide();
  });
  document.addEventListener('focusin', event => {
    if (lastInputWasTouch || !event.target.matches?.(':focus-visible')) return;
    const entry = findDescription(event.target);
    if (!entry) return;
    suppressNativeTitle(entry.target);
    schedule(entry, 0);
  });
  document.addEventListener('focusout', event => {
    if (active === event.target && !active.contains(event.relatedTarget)) hide();
  });
  document.addEventListener('pointerdown', event => {
    lastInputWasTouch = event.pointerType === 'touch';
    hide();
  }, true);
  document.addEventListener('click', event => {
    hide();
    // 클릭 처리에서 title을 다시 설정하는 버튼도 네이티브 팝업이 중복되지 않게 한다.
    const entry = findDescription(event.target);
    if (entry) suppressNativeTitle(entry.target);
  });
  document.addEventListener('keydown', () => {
    lastInputWasTouch = false;
    hide();
  }, true);
  document.addEventListener('dragstart', hide, true);
  [['#packageList', 'hhjcon:library-navigation-rendered'], ['#collectionList', 'hhjcon:library-navigation-rendered'],
    ['#conGrid', 'hhjcon:library-grid-rendered'], ['.library-view-tabs', 'hhjcon:library-tabs-rendered']]
    .forEach(([selector, name]) => document.querySelector(selector)?.addEventListener(name, hide));
  document.addEventListener('hhjcon:story-rendered', hide);
  window.addEventListener('scroll', hide, true);
  window.addEventListener('resize', hide);
  window.addEventListener('blur', hide);
}
