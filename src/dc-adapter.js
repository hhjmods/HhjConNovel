const MESSAGE_TYPE = 'HHJCON_DC_SYNC_RESULT';
const REQUEST_TYPE = 'HHJCON_DC_SYNC_REQUEST';
const PING_TYPE = 'HHJCON_DC_BRIDGE_PING';
const PONG_TYPE = 'HHJCON_DC_BRIDGE_PONG';
let requestCounter = 0;

function waitForBridge(timeoutMs = 1800) {
  return new Promise((resolve, reject) => {
    const requestId = `ping_${Date.now()}_${++requestCounter}`;
    let settled = false;
    const cleanup = () => window.removeEventListener('message', onMessage);
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn(value);
    };
    const onMessage = event => {
      const data = event.data;
      if (!data || data.type !== PONG_TYPE || data.requestId !== requestId) return;
      finish(resolve, data);
    };

    window.addEventListener('message', onMessage);
    window.postMessage({ type: PING_TYPE, requestId }, '*');
    setTimeout(() => finish(reject, new Error('DC 브리지가 연결되지 않았습니다. DC 브리지를 다시 설치하거나 최신 버전으로 업데이트한 뒤 이 페이지를 새로고침해주세요.')), timeoutMs);
  });
}

export async function requestDcSync({ writeUrl, timeoutMs = 30000 } = {}) {
  await waitForBridge();
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
      const data = event.data;
      if (!data || data.type !== MESSAGE_TYPE || data.requestId !== requestId) return;
      if (data.error) finish(reject, new Error(data.error));
      else finish(resolve, data.payload);
    };

    window.addEventListener('message', onMessage);
    window.postMessage({ type: REQUEST_TYPE, requestId, writeUrl: String(writeUrl || '') }, '*');
    setTimeout(() => finish(reject, new Error('DC 브리지는 연결되었지만 동기화 응답이 없습니다. 잠시 후 다시 시도해주세요.')), timeoutMs);
  });
}

export const DcBridgeProtocol = Object.freeze({ REQUEST_TYPE, MESSAGE_TYPE, PING_TYPE, PONG_TYPE });
