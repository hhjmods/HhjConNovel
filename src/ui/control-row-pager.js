const desktopQuery = window.matchMedia('(min-width: 901px)');
const rows = document.querySelectorAll('.story-header-edit-actions, .text-format-toolbar');

function visibleLineOffsets(track) {
  const offsets = [...track.children]
    .filter(item => !item.hidden && getComputedStyle(item).display !== 'none')
    .map(item => item.offsetTop)
    .sort((a, b) => a - b);
  return offsets.reduce((lines, offset) => {
    if (!lines.length || offset - lines.at(-1) > 4) lines.push(offset);
    return lines;
  }, []);
}

function installPager(row) {
  if (row.classList.contains('hhj-control-row-paged')) return;
  const viewport = document.createElement('div');
  viewport.className = 'hhj-control-row-viewport';
  const track = document.createElement('div');
  track.className = 'hhj-control-row-track';
  while (row.firstChild) track.append(row.firstChild);
  viewport.append(track);

  const nav = document.createElement('div');
  nav.className = 'hhj-control-row-nav';
  const up = document.createElement('button');
  up.type = 'button';
  up.textContent = '▲';
  up.title = '이전 버튼 줄';
  up.setAttribute('aria-label', up.title);
  const down = document.createElement('button');
  down.type = 'button';
  down.textContent = '▼';
  down.title = '다음 버튼 줄';
  down.setAttribute('aria-label', down.title);
  nav.append(up, down);
  row.append(viewport, nav);
  row.classList.add('hhj-control-row-paged');

  let lines = [0];
  let lineIndex = 0;
  let measureFrame = 0;

  function showLine(nextIndex, smooth = true) {
    lineIndex = Math.max(0, Math.min(nextIndex, lines.length - 1));
    viewport.scrollTo({ top: lines[lineIndex] || 0, behavior: smooth ? 'smooth' : 'auto' });
    up.disabled = lineIndex === 0;
    down.disabled = lineIndex >= lines.length - 1;
  }

  function measure() {
    measureFrame = 0;
    lines = desktopQuery.matches ? visibleLineOffsets(track) : [0];
    if (!lines.length) lines = [0];
    const hasPages = desktopQuery.matches && lines.length > 1;
    row.classList.toggle('has-pages', hasPages);
    nav.hidden = !hasPages;
    showLine(Math.min(lineIndex, lines.length - 1), false);
  }

  function scheduleMeasure() {
    if (measureFrame) cancelAnimationFrame(measureFrame);
    measureFrame = requestAnimationFrame(measure);
  }

  up.addEventListener('click', event => {
    event.stopPropagation();
    showLine(lineIndex - 1);
  });
  down.addEventListener('click', event => {
    event.stopPropagation();
    showLine(lineIndex + 1);
  });

  const resizeObserver = new ResizeObserver(scheduleMeasure);
  resizeObserver.observe(row);
  resizeObserver.observe(track);
  const mutationObserver = new MutationObserver(scheduleMeasure);
  mutationObserver.observe(track, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden'] });
  desktopQuery.addEventListener?.('change', scheduleMeasure);
  scheduleMeasure();
}

rows.forEach(installPager);
