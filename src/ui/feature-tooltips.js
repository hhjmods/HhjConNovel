import { placeFeatureTooltip } from './feature-tooltip-position.js?v=20260916-1';

// 기존 화면의 설명은 이 목록에 모으고, 새 UI는 data-tooltip-title/description 속성만 붙이면 된다.
const descriptions = [
  ['#themeToggleBtn', '화면 테마', '밝은 화면과 어두운 화면을 전환합니다.'],
  ['.dc-connect-box a[href$="/USAGE.md"]', '사용법', '편집기의 전체 사용법을 새 탭에서 엽니다.'],
  ['.dc-connect-box a[href^="https://www.tampermonkey.net/"]', 'Tampermonkey 설치', 'DC 브리지를 실행하는 브라우저 확장 프로그램을 설치합니다.'],
  ['.dc-connect-box a[href^="./bridge/"]', 'DC 브리지 설치', '디시콘 동기화와 DC 글쓰기 붙여넣기에 필요한 스크립트를 설치합니다.'],
  ['#editorBackupBtn', '에디터 백업', '콘묶음·원고·설정 등 편집기 데이터를 파일로 저장합니다.'],
  ['#editorBackupRestoreBtn', '백업 불러오기', '에디터 백업 파일을 불러와 저장된 데이터를 복원합니다.'],
  ['#demoBtn', '개발용 데모', '동작 확인을 위한 예시 데이터를 불러옵니다.'],
  ['[data-library-tab="packages"]', '디시콘', '동기화된 디시콘 묶음 목록을 봅니다.'],
  ['[data-library-tab="collections"]', '내 콘묶음', '직접 만든 콘묶음 목록을 봅니다.'],
  ['#newCollectionBtn', '새 콘묶음', '선택한 콘을 모아 둘 새 콘묶음을 만듭니다.'],
  ['#exportCollectionBtn', '콘묶음 내보내기', '콘묶음을 파일로 백업합니다.'],
  ['.collection-transfer-row .file-button', '콘묶음 불러오기', '백업한 콘묶음 파일을 불러옵니다.'],
  ['#packageList .nav-item', '디시콘 묶음 열기', '이 디시콘 묶음의 콘을 새 탭에서 봅니다.'],
  ['#collectionList .collection-main', '내 콘묶음 열기', '이 콘묶음의 콘을 새 탭에서 봅니다.'],
  ['#collectionList .collection-row > .icon-button', '콘묶음 삭제', '이 콘묶음을 삭제합니다.'],
  ['.library-view-tab-main', '콘 탭 전환', '열어 둔 디시콘 또는 콘묶음으로 이동합니다.'],
  ['.library-view-tab-close', '탭 닫기', '이 콘 탭만 닫습니다.'],
  ['.library-view-close-all', '탭 전체 닫기', '열려 있는 콘 탭을 모두 닫습니다.'],
  ['#searchInput', '콘 이름 검색', '현재 열린 목록에서 콘 이름을 검색합니다.'],
  ['#selectAllBtn', '전체 선택', '현재 목록에 표시된 콘을 모두 선택합니다.'],
  ['#clearSelectionBtn', '선택 해제', '현재 선택한 콘을 모두 해제합니다.'],
  ['.collection-edit-controls button:nth-child(1)', '콘 편집', '이 콘묶음에서 콘 삭제나 순서 변경을 시작합니다.'],
  ['.collection-edit-controls button:nth-child(2)', '선택 콘 삭제', '편집 중 선택한 콘을 콘묶음에서 제거합니다.'],
  ['.collection-edit-controls button:nth-child(3)', '편집 저장', '콘묶음 편집 내용을 저장합니다.'],
  ['.collection-edit-controls button:nth-child(4)', '편집 취소', '저장하지 않은 콘묶음 편집을 취소합니다.'],
  ['.story-header-save-actions button:first-child', '원고 저장', '현재 작성 중인 원고를 저장합니다.'],
  ['.story-header-save-actions button:last-child', '원고 목록', '저장한 원고와 폴더를 관리합니다.'],
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
  ['.text-format-toolbar [data-action="toggle-align-menu"]', '문단 정렬', '대사를 왼쪽·가운데·오른쪽으로 정렬합니다.'],
  ['.text-format-toolbar [data-action="remove-format"]', '서식 초기화', '선택한 글자의 서식을 지웁니다.']
];

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
    const target = node.closest('button, a, label, input, select, [data-tooltip-title]');
    if (!target) return null;
    if (target.dataset.tooltipTitle) {
      return { target, title: target.dataset.tooltipTitle, description: target.dataset.tooltipDescription || '' };
    }
    for (const [selector, title, description] of descriptions) {
      if (target.matches(selector)) {
        return { target, title: typeof title === 'function' ? title(target) : title, description };
      }
    }
    return null;
  }

  // 기존 title 브라우저 팝업과 새 설명이 겹치지 않게 한다. 아이콘의 접근성 이름은 남긴다.
  function suppressNativeTitle(target) {
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

  function schedule(entry, delay) {
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
      tooltip.hidden = false;
      tooltip.style.visibility = 'hidden';
      const rect = active.getBoundingClientRect();
      const size = tooltip.getBoundingClientRect();
      const position = placeFeatureTooltip(rect, size, { width: innerWidth, height: innerHeight });
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
    if (!entry) return;
    suppressNativeTitle(entry.target);
    schedule(entry, 190);
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
