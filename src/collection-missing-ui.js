import { getAll } from './db.js';

let refMetaByConId = new Map();
let refreshPromise = null;

async function refreshMetadata() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = getAll('collections').then(collections => {
    const next = new Map();
    collections.forEach(collection => {
      Object.entries(collection.refMeta || {}).forEach(([id, meta]) => {
        if (!next.has(id) && meta && typeof meta === 'object') next.set(id, meta);
      });
    });
    refMetaByConId = next;
  }).finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

function applyMetadataToCard(card) {
  const id = card.dataset.conId;
  const meta = refMetaByConId.get(id);
  if (!meta) return false;

  const label = card.querySelector('span');
  const nextName = String(meta.name || '미보유 디시콘');
  const nextPackageName = String(meta.packageName || '');
  const nextTitle = `${nextName}\n${nextPackageName ? `디시콘 묶음: ${nextPackageName}` : '원본 디시콘 묶음 이름을 확인할 수 없습니다.'}`;

  if (label && label.textContent !== nextName) label.textContent = nextName;
  if (card.dataset.packageName !== nextPackageName) card.dataset.packageName = nextPackageName;
  if (card.title !== nextTitle) card.title = nextTitle;
  return true;
}

function annotateMissingCards() {
  let unresolved = false;
  document.querySelectorAll('.con-card.missing[data-con-id]').forEach(card => {
    if (!applyMetadataToCard(card)) unresolved = true;
  });
  if (unresolved) refreshMetadata().then(() => {
    document.querySelectorAll('.con-card.missing[data-con-id]').forEach(applyMetadataToCard);
  });
}

document.addEventListener('click', async event => {
  const card = event.target.closest('.con-card.missing[data-con-id]');
  if (!card) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  let meta = refMetaByConId.get(card.dataset.conId);
  if (!meta) {
    await refreshMetadata();
    meta = refMetaByConId.get(card.dataset.conId);
  }
  const packageName = meta?.packageName || '원본 디시콘 묶음 이름을 확인할 수 없습니다.';
  alert(`해당 콘을 구매하지 않았습니다.\n\n디시콘 묶음: ${packageName}`);
}, true);

const observer = new MutationObserver(annotateMissingCards);
observer.observe(document.documentElement, { childList: true, subtree: true });
refreshMetadata().then(annotateMissingCards);
