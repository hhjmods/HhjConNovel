import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];

function fail(owner, target) {
  failures.push(`${owner}: missing ${target}`);
}

function localTarget(specifier) {
  return specifier.split(/[?#]/, 1)[0];
}

function check(owner, baseDir, specifier) {
  if (!specifier.startsWith('.')) return;
  const target = localTarget(specifier);
  const resolved = path.resolve(baseDir, target);
  if (!fs.existsSync(resolved)) fail(owner, specifier);
}

function walk(directory, extension) {
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...walk(fullPath, extension));
    else if (entry.isFile() && entry.name.endsWith(extension)) result.push(fullPath);
  }
  return result;
}

const indexPath = path.join(root, 'index.html');
const index = fs.readFileSync(indexPath, 'utf8');
for (const match of index.matchAll(/\b(?:src|href)=["'](\.\/[^"']+)["']/g)) {
  check('index.html', root, match[1]);
}

for (const file of walk(path.join(root, 'src'), '.js')) {
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*)["'](\.[^"']+)["']/g)) {
    check(path.relative(root, file), path.dirname(file), match[1]);
  }
}

for (const file of walk(path.join(root, 'assets', 'styles'), '.css')) {
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
    const target = match[1].trim();
    if (/^(?:data:|https?:|#)/i.test(target)) continue;
    check(path.relative(root, file), path.dirname(file), target);
  }
}

if (failures.length) {
  failures.forEach(message => console.error(`Local path check failed: ${message}`));
  process.exitCode = 1;
} else {
  console.log('Local entrypoint and import paths OK');
}
