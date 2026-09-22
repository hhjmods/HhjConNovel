const UPDATE_PARAM = 'hhjcon-version';

export function planVisit(currentUrl, navigationType) {
  try {
    const url = new URL(currentUrl);
    if (url.searchParams.has(UPDATE_PARAM)) {
      url.searchParams.delete(UPDATE_PARAM);
      return { shouldCount: false, cleanUrl: url.href };
    }
    return { shouldCount: navigationType !== 'reload', cleanUrl: '' };
  } catch {
    return { shouldCount: false, cleanUrl: '' };
  }
}

function sendVisit(endpoint) {
  if (!endpoint) return;
  if (typeof navigator.sendBeacon === 'function' && navigator.sendBeacon(endpoint)) return;
  fetch(endpoint, { method: 'POST', mode: 'no-cors', keepalive: true }).catch(() => {});
}

function startVisitCounter() {
  const endpoint = document.querySelector('meta[name="hhjcon-visit-counter-endpoint"]')?.content.trim();
  const navigationType = performance.getEntriesByType('navigation')[0]?.type;
  const plan = planVisit(location.href, navigationType);
  if (plan.cleanUrl) history.replaceState(history.state, '', plan.cleanUrl);
  if (plan.shouldCount) sendVisit(endpoint);
}

if (typeof document !== 'undefined' && typeof location !== 'undefined') {
  startVisitCounter();
}
