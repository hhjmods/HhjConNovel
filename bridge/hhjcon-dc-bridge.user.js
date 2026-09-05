// ==UserScript==
// @name         HhjConNovel DC Bridge
// @namespace    https://github.com/hhjmods/HhjConNovel
// @version      0.6.1
// @description  HhjConNovel의 디시콘 동기화 기능을 연결합니다.
// @match        https://hhjmods.github.io/HhjConNovel/*
// @match        https://gall.dcinside.com/*
// @connect      gall.dcinside.com
// @connect      dcimg5.dcinside.com
// @grant        GM_xmlhttpRequest
// @grant        GM_cookie
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        unsafeWindow
// @updateURL    https://hhjmods.github.io/HhjConNovel/bridge/hhjcon-dc-bridge.user.js
// @downloadURL  https://hhjmods.github.io/HhjConNovel/bridge/hhjcon-dc-bridge.user.js
// @run-at       document-start
// ==/UserScript==

(() => {
  'use strict';

  const CI_CACHE_KEY = 'hhjcon-dc-ci-c';

  function readDocumentCookie(name) {
    const prefix = `${name}=`;
    const part = document.cookie.split(';').map(value => value.trim()).find(value => value.startsWith(prefix));
    return part ? decodeURIComponent(part.slice(prefix.length)) : '';
  }

  function readCookie(url, name) {
    return new Promise(resolve => {
      if (typeof GM_cookie === 'undefined' || typeof GM_cookie.list !== 'function') {
        resolve('');
        return;
      }
      try {
        GM_cookie.list({ url, name }, (cookies, error) => {
          if (error || !Array.isArray(cookies)) {
            resolve('');
            return;
          }
          resolve(cookies.find(cookie => cookie.name === name)?.value || '');
        });
      } catch {
        resolve('');
      }
    });
  }

  async function cacheDcCookie() {
    let value = readDocumentCookie('ci_c');
    if (!value) value = await readCookie(location.href, 'ci_c');
    if (value) GM_setValue(CI_CACHE_KEY, value);
  }

  if (location.hostname === 'gall.dcinside.com') {
    cacheDcCookie();
    return;
  }

  const pageWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  const REQUEST_TYPE = 'HHJCON_DC_SYNC_REQUEST';
  const RESULT_TYPE = 'HHJCON_DC_SYNC_RESULT';
  const PING_TYPE = 'HHJCON_DC_BRIDGE_PING';
  const PONG_TYPE = 'HHJCON_DC_BRIDGE_PONG';
  const VERSION = '0.6.1';
  const MAX_PAGE = 30;
  const IMAGE_CACHE_NAME = 'hhjcon-dccon-images-v1';
  const IMAGE_NETWORK_LIMIT = 4;
  const imageCache = new Map();
  let persistentImageCachePromise = null;
  let activeImageRequests = 0;
  const imageRequestQueue = [];

  function post(message) {
    pageWindow.postMessage(message, '*');
  }

  function sendResult(requestId, payload = null, error = null) {
    post({ type: RESULT_TYPE, requestId, payload, error });
  }

  function requestText({ method = 'GET', url, data = null, headers = {} }) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method,
        url,
        data,
        headers,
        anonymous: false,
        timeout: 15000,
        onload: response => {
          if (response.status < 200 || response.status >= 400) {
            reject(new Error(`DC 요청 실패: HTTP ${response.status}`));
            return;
          }
          resolve(response.responseText || '');
        },
        ontimeout: () => reject(new Error('DC 요청 시간이 초과되었습니다.')),
        onerror: () => reject(new Error('DC 요청 중 네트워크 오류가 발생했습니다.'))
      });
    });
  }

  function isDcConImage(url) {
    try {
      const parsed = new URL(String(url || ''), location.href);
      return parsed.hostname === 'dcimg5.dcinside.com' && parsed.pathname === '/dccon.php' && parsed.searchParams.has('no');
    } catch {
      return false;
    }
  }

  function openPersistentImageCache() {
    if (persistentImageCachePromise) return persistentImageCachePromise;
    if (!pageWindow.caches?.open) return Promise.resolve(null);
    persistentImageCachePromise = pageWindow.caches.open(IMAGE_CACHE_NAME).catch(() => null);
    return persistentImageCachePromise;
  }

  async function readPersistentImage(url) {
    try {
      const cache = await openPersistentImageCache();
      if (!cache) return null;
      const response = await cache.match(url);
      if (!response) return null;
      const blob = await response.blob();
      return blob?.size ? blob : null;
    } catch {
      return null;
    }
  }

  async function writePersistentImage(url, blob, contentType = '') {
    try {
      const cache = await openPersistentImageCache();
      if (!cache) return;
      const response = new pageWindow.Response(blob, {
        status: 200,
        headers: { 'Content-Type': contentType || blob.type || 'application/octet-stream' }
      });
      await cache.put(url, response);
    } catch {
    }
  }

  function pumpImageQueue() {
    while (activeImageRequests < IMAGE_NETWORK_LIMIT && imageRequestQueue.length) {
      const entry = imageRequestQueue.shift();
      activeImageRequests += 1;
      Promise.resolve()
        .then(entry.task)
        .then(entry.resolve, entry.reject)
        .finally(() => {
          activeImageRequests -= 1;
          pumpImageQueue();
        });
    }
  }

  function queueImageNetwork(task) {
    return new Promise((resolve, reject) => {
      imageRequestQueue.push({ task, resolve, reject });
      pumpImageQueue();
    });
  }

  function requestImageBlob(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        responseType: 'blob',
        anonymous: false,
        timeout: 15000,
        headers: {
          'Referer': 'https://dccon.dcinside.com/',
          'X-Requested-With': 'XMLHttpRequest'
        },
        onload: response => {
          if (response.status < 200 || response.status >= 400) {
            reject(new Error(`DC콘 이미지 요청 실패: HTTP ${response.status}`));
            return;
          }
          const blob = response.response;
          if (!blob || typeof blob.size !== 'number' || blob.size <= 0) {
            reject(new Error('DC콘 이미지 응답이 비어 있습니다.'));
            return;
          }
          resolve({ blob, contentType: response.responseHeaders?.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim() || blob.type || '' });
        },
        ontimeout: () => reject(new Error('DC콘 이미지 요청 시간이 초과되었습니다.')),
        onerror: () => reject(new Error('DC콘 이미지 요청 중 네트워크 오류가 발생했습니다.'))
      });
    });
  }

  function fetchDcConImage(url) {
    if (imageCache.has(url)) return imageCache.get(url);
    const task = (async () => {
      const cachedBlob = await readPersistentImage(url);
      if (cachedBlob) return pageWindow.URL.createObjectURL(cachedBlob);
      const { blob, contentType } = await queueImageNetwork(() => requestImageBlob(url));
      await writePersistentImage(url, blob, contentType);
      return pageWindow.URL.createObjectURL(blob);
    })().catch(error => {
      imageCache.delete(url);
      throw error;
    });
    imageCache.set(url, task);
    return task;
  }

  function resolveDcConImage(img) {
    const ImageClass = pageWindow.HTMLImageElement || HTMLImageElement;
    if (!(img instanceof ImageClass)) return;
    if (img.dataset.hhjconDcImageState) return;
    const source = img.getAttribute('src') || '';
    if (!isDcConImage(source)) return;
    img.dataset.hhjconDcImageState = 'loading';
    img.dataset.hhjconDcImageSource = source;
    img.removeAttribute('src');
    fetchDcConImage(source).then(objectUrl => {
      if (!img.isConnected) return;
      img.dataset.hhjconDcImageState = 'ready';
      img.src = objectUrl;
    }).catch(() => {
      if (!img.isConnected) return;
      img.dataset.hhjconDcImageState = 'error';
      img.src = source;
    });
  }

  function scanDcConImages(root) {
    const ImageClass = pageWindow.HTMLImageElement || HTMLImageElement;
    if (root instanceof ImageClass) resolveDcConImage(root);
    if (root?.querySelectorAll) root.querySelectorAll('img').forEach(resolveDcConImage);
  }

  function startImageResolver() {
    scanDcConImages(document);
    const observer = new MutationObserver(records => {
      records.forEach(record => record.addedNodes.forEach(scanDcConImages));
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.documentElement) startImageResolver();
  else window.addEventListener('DOMContentLoaded', startImageResolver, { once: true });

  function normalizeWriteUrl(raw) {
    let url;
    try {
      url = new URL(String(raw || '').trim());
    } catch {
      throw new Error('DC 글쓰기 URL이 올바르지 않습니다.');
    }
    if (url.protocol !== 'https:' || url.hostname !== 'gall.dcinside.com') {
      throw new Error('gall.dcinside.com의 글쓰기 URL을 입력하세요.');
    }
    if (!/\/board\/write\/?$/i.test(url.pathname)) {
      throw new Error('DC 갤러리 글쓰기 페이지 URL을 입력하세요.');
    }
    return url;
  }

  async function findCiToken(html, writeUrl) {
    const patterns = [
      /name=["']ci_t["'][^>]*value=["']([^"']+)["']/i,
      /value=["']([^"']+)["'][^>]*name=["']ci_t["']/i,
      /(?:window\.)?ci_t\s*=\s*["']([^"']+)["']/i,
      /["']ci_t["']\s*:\s*["']([^"']+)["']/i
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1] && match[1] !== 'undefined') return match[1];
    }

    const cookieValue = await readCookie(writeUrl.href, 'ci_c');
    if (cookieValue) {
      GM_setValue(CI_CACHE_KEY, cookieValue);
      return cookieValue;
    }

    const cachedValue = GM_getValue(CI_CACHE_KEY, '');
    if (cachedValue) return cachedValue;

    throw new Error('DC 인증값(ci_c/ci_t)을 찾지 못했습니다. DC 글쓰기 페이지를 새로고침한 뒤 다시 시도해주세요.');
  }

  function parseJson(text) {
    try {
      return JSON.parse(text);
    } catch {
      throw new Error('DC콘 목록 응답을 JSON으로 해석하지 못했습니다. DC 응답 형식이 변경되었을 수 있습니다.');
    }
  }

  function asList(value) {
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object') return Object.values(value);
    return [];
  }

  function firstString(source, keys) {
    for (const key of keys) {
      const value = source?.[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
      if (typeof value === 'number') return String(value);
    }
    return '';
  }

  function absolutize(url, base) {
    if (!url) return '';
    try {
      return new URL(url, base).href;
    } catch {
      return String(url);
    }
  }

  function readSourceNo(url) {
    if (!url) return '';
    const match = String(url).match(/[?&]no=([^&#]+)/i);
    return match ? decodeURIComponent(match[1]) : '';
  }

  function walk(value, visitor, seen = new Set()) {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    visitor(value);
    if (Array.isArray(value)) {
      value.forEach(item => walk(item, visitor, seen));
      return;
    }
    Object.values(value).forEach(item => walk(item, visitor, seen));
  }

  function harvestPage(root, packageMap, conMap, baseUrl) {
    walk(root, candidate => {
      const rawPackageId = candidate.package_idx ?? candidate.packageIdx;
      const details = asList(candidate.detail ?? candidate.details);
      if (rawPackageId == null || !details.length) return;

      const sourcePackageId = String(rawPackageId);
      const packageId = `dc:${sourcePackageId}`;
      const existing = packageMap.get(packageId);
      const packageName = firstString(candidate, [
        'package_name', 'package_title', 'dccon_name', 'title', 'name'
      ]) || existing?.name || `DC콘 ${sourcePackageId}`;

      if (!existing) {
        packageMap.set(packageId, {
          id: packageId,
          sourcePackageId,
          name: packageName
        });
      } else if (existing.name.startsWith('DC콘 ') && packageName !== existing.name) {
        existing.name = packageName;
      }

      details.forEach((detail, index) => {
        if (!detail || typeof detail !== 'object') return;
        const imageUrl = absolutize(firstString(detail, [
          'list_img', 'image_url', 'img', 'image', 'src'
        ]), baseUrl);
        const sourceNo = readSourceNo(imageUrl);
        if (!sourceNo) return;
        const detailId = firstString(detail, [
          'detail_idx', 'detailIdx', 'detail_id', 'detailId', 'detail_no', 'detailNo'
        ]);

        const key = `${packageId}\u0000${sourceNo}`;
        if (conMap.has(key)) return;

        conMap.set(key, {
          packageId,
          sourceNo,
          detailId,
          name: firstString(detail, [
            'title', 'name', 'dccon_name', 'alt', 'detail_name'
          ]) || String(index + 1),
          imageUrl,
          thumbnailUrl: imageUrl,
          order: index
        });
      });
    });
  }

  async function collect(writeUrl) {
    const writePage = await requestText({ url: writeUrl.href });
    const ciT = await findCiToken(writePage, writeUrl);
    const listUrl = new URL('/dccon/lists', writeUrl).href;
    const packageMap = new Map();
    const conMap = new Map();

    let stableEmptyPages = 0;
    for (let page = 1; page <= MAX_PAGE; page += 1) {
      const beforePackages = packageMap.size;
      const beforeCons = conMap.size;
      const body = new URLSearchParams({ ci_t: ciT, target: 'icon', page: String(page) }).toString();
      const responseText = await requestText({
        method: 'POST',
        url: listUrl,
        data: body,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': writeUrl.href
        }
      });
      const payload = parseJson(responseText);
      harvestPage(payload, packageMap, conMap, writeUrl.href);

      const changed = packageMap.size !== beforePackages || conMap.size !== beforeCons;
      stableEmptyPages = changed ? 0 : stableEmptyPages + 1;
      if (stableEmptyPages >= 1) break;
    }

    if (!packageMap.size || !conMap.size) {
      throw new Error('보유 디시콘을 찾지 못했습니다. DC 응답 구조가 바뀌었거나 로그인 상태가 아닐 수 있습니다.');
    }

    return {
      account: null,
      packages: [...packageMap.values()],
      cons: [...conMap.values()]
    };
  }

  pageWindow.addEventListener('message', event => {
    const data = event.data;
    if (!data || !data.requestId) return;

    if (data.type === PING_TYPE) {
      post({ type: PONG_TYPE, requestId: data.requestId, version: VERSION });
      return;
    }

    if (data.type !== REQUEST_TYPE) return;

    (async () => {
      try {
        const writeUrl = normalizeWriteUrl(data.writeUrl);
        const payload = await collect(writeUrl);
        sendResult(data.requestId, payload, null);
      } catch (error) {
        sendResult(data.requestId, null, error?.message || String(error));
      }
    })();
  });
})();