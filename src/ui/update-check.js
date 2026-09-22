const VERSION_PATTERN = /^[0-9A-Za-z._-]{1,64}$/;
const RELOAD_PARAM = 'hhjcon-version';

function validVersion(value) {
  const version = String(value || '').trim();
  return VERSION_PATTERN.test(version) ? version : '';
}

export function nextVersionUrl(currentUrl, currentVersion, latestVersion) {
  const current = validVersion(currentVersion);
  const latest = validVersion(latestVersion);
  if (!current || !latest || current === latest) return '';
  try {
    const url = new URL(currentUrl);
    if (url.searchParams.get(RELOAD_PARAM) === latest) return '';
    url.searchParams.set(RELOAD_PARAM, latest);
    return url.href;
  } catch {
    return '';
  }
}

async function checkForUpdate() {
  try {
    const current = document.querySelector('meta[name="hhjcon-app-version"]')?.content;
    if (!validVersion(current)) return;
    const currentUrl = location.href;
    const manifestUrl = new URL('./version.json', document.baseURI);
    manifestUrl.searchParams.set('_', String(Date.now()));
    const response = await fetch(manifestUrl, { cache: 'no-store' });
    if (!response.ok) return;
    const nextUrl = nextVersionUrl(currentUrl, current, (await response.json())?.version);
    if (nextUrl) location.replace(nextUrl);
  } catch {
    // 오프라인이거나 확인에 실패하면 현재 버전을 그대로 사용한다.
  }
}

if (typeof document !== 'undefined' && typeof location !== 'undefined' && typeof fetch === 'function') {
  checkForUpdate();
}
