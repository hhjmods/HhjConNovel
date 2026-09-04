const MESSAGE_TYPE = 'HHJCON_DC_SYNC_RESULT';
const REQUEST_TYPE = 'HHJCON_DC_SYNC_REQUEST';
let requestCounter = 0;

export function requestDcSync({ writeUrl, timeoutMs = 30000 } = {}) {
  return new Promise((resolve, reject) => {
    const requestId = `sync_${Date.now()}_${++requestCounter}`;
    let settled = false;
    const cleanup = () => window.removeEventListener('message', onMessage);
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn(value);
    };
    const onMessage = event => {
      if (event.source !== window) return;
      const data = event.data;
      if (!data || data.type !== MESSAGE_TYPE || data.requestId !== requestId) return;
      if (data.error) finish(reject, new Error(data.error));
      else finish(resolve, data.payload);
    };

    window.addEventListener('message', onMessage);
    window.postMessage({ type: REQUEST_TYPE, requestId, writeUrl: String(writeUrl || '') }, '*');
    setTimeout(() => finish(reject, new Error('DC 브리지를 찾을 수 없습니다. 먼저 DC 브리지를 설치하거나 활성화했는지 확인해주세요.')), timeoutMs);
  });
}

export const DcBridgeProtocol = Object.freeze({ REQUEST_TYPE, MESSAGE_TYPE });
