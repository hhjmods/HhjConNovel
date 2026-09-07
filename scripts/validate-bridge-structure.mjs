import fs from 'node:fs';

const adapterPath = 'src/integrations/dc-adapter.js';
const adapter = fs.readFileSync(adapterPath, 'utf8');
const bridge = fs.readFileSync('bridge/hhjcon-dc-bridge.user.js', 'utf8');
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
rejectWildcardPostMessage(adapter, adapterPath);
rejectWildcardPostMessage(bridge, 'bridge/hhjcon-dc-bridge.user.js');

if (failures.length) {
  failures.forEach(message => console.error(`Bridge structure check failed: ${message}`));
  process.exitCode = 1;
} else {
  console.log('Bridge message boundary contracts OK');
}
