const DCCON_SEARCH_URL = 'https://dccon.dcinside.com/new/1/title/';

export function makeDcconPurchaseUrl(meta) {
  const packageName = String(meta?.packageName || '').trim();
  const sourcePackageId = String(meta?.sourcePackageId || '').trim();
  if (!packageName || !/^\d+$/.test(sourcePackageId)) return '';
  return `${DCCON_SEARCH_URL}${encodeURIComponent(packageName)}#${sourcePackageId}`;
}
