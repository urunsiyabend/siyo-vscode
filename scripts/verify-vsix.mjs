#!/usr/bin/env node
// Checks a packaged VSIX before it is published: right version, every file
// the extension needs, nothing it should not ship.
//   node scripts/verify-vsix.mjs [file.vsix]   (default: siyo-<version>.vsix)
import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const file = process.argv[2] ?? `${pkg.name}-${pkg.version}.vsix`;

const REQUIRED = [
  'extension.vsixmanifest',
  'extension/package.json',
  'extension/syntaxes/siyo.tmLanguage.json',
  'extension/snippets/siyo.json',
  'extension/language-configuration.json',
  'extension/images/siyo-icon.png',
  'extension/readme.md',
  'extension/changelog.md',
  'extension/LICENSE.txt',
];
const FORBIDDEN = ['extension/node_modules/', 'extension/test/', 'extension/scripts/', 'extension/docs/', 'extension/.github/', 'extension/example.siyo', 'extension/package-lock.json'];

/** Entries of a zip file from its central directory: name -> { method, offset, size }. */
function readZip(buf) {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error(`${file} is not a zip archive`);
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const entries = new Map();
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('corrupt central directory');
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const offset = buf.readUInt32LE(p + 42);
    entries.set(buf.toString('utf8', p + 46, p + 46 + nameLen), { method, offset, size });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function readEntry(buf, { method, offset, size }) {
  const start = offset + 30 + buf.readUInt16LE(offset + 26) + buf.readUInt16LE(offset + 28);
  const data = buf.subarray(start, start + size);
  if (method === 0) return data;
  if (method === 8) return inflateRawSync(data);
  throw new Error(`unsupported compression method ${method}`);
}

const buf = readFileSync(file);
const entries = readZip(buf);
const names = [...entries.keys()];
const problems = [];

for (const required of REQUIRED) {
  if (!entries.has(required)) problems.push(`missing ${required}`);
}
for (const name of names) {
  if (FORBIDDEN.some((f) => name === f || name.startsWith(f))) problems.push(`must not ship ${name}`);
}
if (entries.has('extension/package.json')) {
  const shipped = JSON.parse(readEntry(buf, entries.get('extension/package.json')).toString('utf8'));
  if (shipped.version !== pkg.version) problems.push(`version ${shipped.version} != package.json ${pkg.version}`);
  if (shipped.name !== pkg.name || shipped.publisher !== pkg.publisher) problems.push('name/publisher mismatch');
  for (const json of ['extension/syntaxes/siyo.tmLanguage.json', 'extension/snippets/siyo.json', 'extension/language-configuration.json']) {
    if (!entries.has(json)) continue;
    try {
      JSON.parse(readEntry(buf, entries.get(json)).toString('utf8'));
    } catch (e) {
      problems.push(`${json} is not valid JSON: ${e.message}`);
    }
  }
}

if (problems.length) {
  console.error(`${file}: FAILED\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`${file}: OK (${pkg.publisher}.${pkg.name} ${pkg.version}, ${names.length} files)\n  ${names.sort().join('\n  ')}`);
