// ==UserScript==
// @name         HhjConNovel DC Bridge
// @namespace    https://github.com/hhjmods/HhjConNovel
// @version      0.3.0
// @description  HhjConNovel의 디시콘 동기화 기능을 연결합니다.
// @match        https://hhjmods.github.io/HhjConNovel/*
// @connect      gall.dcinside.com
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @updateURL    https://hhjmods.github.io/HhjConNovel/bridge/hhjcon-dc-bridge.user.js
// @downloadURL  https://hhjmods.github.io/HhjConNovel/bridge/hhjcon-dc-bridge.user.js
// @run-at       document-start
// ==/UserScript==

(() => {
  'use strict';

  const pageWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  const REQUEST_TYPE = 'HHJCON_DC_SYNC_REQUEST';
  const RESULT_TYPE = 'HHJCON_DC_SYNC_RESULT';
  const PING_TYPE = 'HHJCON_DC_BRIDGE_PING';
  const PONG_TYPE = 'HHJCON_DC_BRIDGE_PONG';
  const VERSION = '0.3.0';
  const MAX_PAGE = 30;

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

  function findCiToken(html) {
    const patterns = [
      /name=["']ci_t["'][^>]*value=["']([^"']+)["']/i,
      /value=["']([^"']+)["'][^>]*name=["']ci_t["']/i,
      /(?:window\.)?ci_t\s*=\s*["']([^"']+)["']/i,
      /["']ci_t["']\s*:\s*["']([^"']+)["']/i
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) return match[1];
    }
    throw new Error('DC 글쓰기 페이지에서 ci_t 값을 찾지 못했습니다. 로그인 상태와 URL을 확인하세요.');
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

        const key = `${packageId}\u0000${sourceNo}`;
        if (conMap.has(key)) return;

        conMap.set(key, {
          packageId,
          sourceNo,
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
    const ciT = findCiToken(writePage);
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
