import { getAll } from '../db.js';
import { makeDcconPurchaseUrl } from './dccon-purchase-url.js?v=20260914-1';

let refMetaByConId = new Map();
let refreshPromise = null;

export async function showMissingConNotice(meta) {
  const packageName = meta?.packageName || '원본 디시콘 묶음 이름을 확인할 수 없습니다.';
  const message = `해당 콘을 구매하지 않았습니다.\n\n디시콘 묶음: ${packageName}`;
  const purchaseUrl = makeDcconPurchaseUrl(meta);
  if (!purchaseUrl) return alert(message);

  const { showConfirm } = await import('../ui/action-dialogs.js?v=20260917-1');
  const openPurchase = await showConfirm(message, {
    title: '미보유 디시콘', cancelText: '닫기', confirmText: '구매 페이지 열기'
  });
  if (openPurchase) window.open(purchaseUrl, '_blank', 'noopener,noreferrer');
}

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
  await showMissingConNotice(meta);
}, true);

document.getElementById('conGrid')?.addEventListener('hhjcon:library-grid-rendered', annotateMissingCards);
refreshMetadata().then(annotateMissingCards);
