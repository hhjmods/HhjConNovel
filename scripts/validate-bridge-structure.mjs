import fs from 'node:fs';

const adapterPath = 'src/integrations/dc-adapter.js';
const adapter = fs.readFileSync(adapterPath, 'utf8');
const bridge = fs.readFileSync('bridge/hhjcon-dc-bridge.user.js', 'utf8');
const storyHtmlCopy = fs.readFileSync('src/story/story-html-copy.js', 'utf8');
const app = fs.readFileSync('src/app.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const failures = [];

function requireText(source, expected, label) {
  if (!source.includes(expected)) failures.push(label);
}

function rejectWildcardPostMessage(source, owner) {
  const lines = source.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (line.includes('postMessage') && /['"]\*['"]/.test(line)) {
      failures.push(`${owner}:${index + 1} uses wildcard postMessage targetOrigin`);
    }
  });
}

requireText(adapter, 'const PAGE_ORIGIN = window.location.origin;', 'dc-adapter is missing its page origin boundary');
requireText(adapter, 'event.source === window && event.origin === PAGE_ORIGIN', 'dc-adapter is missing source/origin validation');
requireText(adapter, 'PAGE_ORIGIN);', 'dc-adapter does not use a fixed targetOrigin');
requireText(bridge, 'const PAGE_ORIGIN = location.origin;', 'bridge is missing its page origin boundary');
requireText(bridge, 'event.source !== pageWindow || event.origin !== PAGE_ORIGIN', 'bridge is missing source/origin validation');
requireText(bridge, 'pageWindow.postMessage(message, PAGE_ORIGIN);', 'bridge does not use a fixed targetOrigin');
requireText(storyHtmlCopy, "image.classList.add('hhjcon-bridge-dccon');", 'story clipboard does not mark its own DC cons');
requireText(storyHtmlCopy, "classList.add('hhjcon-bridge-paste');", 'story clipboard does not mark con-free HhjConNovel pastes');
requireText(bridge, "querySelectorAll('img.written_dccon.hhjcon-bridge-dccon')", 'bridge does not limit detail repair to HhjConNovel clipboard cons');
requireText(bridge, "image.classList.remove('hhjcon-bridge-dccon');", 'bridge does not clear the processed clipboard marker');
requireText(bridge, "marker.classList.remove('hhjcon-bridge-paste');", 'bridge does not clear the con-free paste marker');
requireText(bridge, "const VERSION = '1.0.0';", 'bridge runtime version is not current');
requireText(index, './bridge/hhjcon-dc-bridge.user.js?v=1.0.0', 'index does not link the current bridge version');
requireText(bridge, 'const IMAGE_NETWORK_LIMIT = 6;', 'bridge image network limit is not current');
requireText(bridge, 'activeEditor.innerHTML.length', 'bridge does not report the final DC editor HTML length');
requireText(bridge, "querySelectorAll('img.written_dccon[title=\"\"]')", 'bridge does not stabilize the temporary empty con title');
if (' hhjcon-bridge-dccon'.length !== ' detail="0000000000"'.length) {
  throw new Error('clipboard marker and final detail attribute lengths differ');
}
requireText(bridge, 'if (targets.length && !activeEditor)', 'DC HTML counter is not limited to an HhjConNovel paste');
requireText(bridge, "removeAttribute('data-dcconoverstatus')", 'bridge does not remove DC editor-only con hover state');
requireText(bridge, "attributeFilter: ['src', 'data-dcconoverstatus']", 'bridge does not watch renewed DC con hover state');
if (bridge.includes("querySelectorAll('img.written_dccon')")) failures.push('bridge still scans ordinary DC cons');
rejectWildcardPostMessage(adapter, adapterPath);
rejectWildcardPostMessage(bridge, 'bridge/hhjcon-dc-bridge.user.js');
requireText(app, 'await replaceStores({ packages: payload.packages, cons: payload.cons });', 'DC sync must replace packages and cons atomically');
requireText(app, "const DC_WRITE_URL = 'https://gall.dcinside.com/mgallery/board/write/?id=legendofmortal';", 'DC sync does not use the fixed default write URL');
requireText(app, 'requestDcSync({ writeUrl: DC_WRITE_URL })', 'DC sync does not pass the fixed write URL to the bridge');
if (app.includes('DC_WRITE_URL_KEY') || app.includes('dcWriteUrlInput') || index.includes('id="dcWriteUrlInput"')) {
  failures.push('DC write URL input or saved setting was restored');
}
if (app.includes("clearStore('packages')") || app.includes("clearStore('cons')")) {
  failures.push('DC sync restored separate destructive store clears');
}

if (failures.length) {
  failures.forEach(message => console.error(`Bridge structure check failed: ${message}`));
  process.exitCode = 1;
} else {
  console.log('Bridge message boundary contracts OK');
}
