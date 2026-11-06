import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from './helpers/fixtures.mjs';
import { loadSnippets, expandSnippet, SNIPPET_CONTEXT } from './helpers/snippets.mjs';
import { tokens } from './helpers/tokenize.mjs';

const snippets = await loadSnippets();
const entries = Object.entries(snippets);

describe('snippets', () => {
  it('are contributed for the siyo language', async () => {
    const pkg = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'));
    assert.deepEqual(pkg.contributes.snippets, [{ language: 'siyo', path: './snippets/siyo.json' }]);
  });

  it('have a prefix, body and description', () => {
    assert.ok(entries.length > 0);
    for (const [name, s] of entries) {
      assert.equal(typeof s.prefix, 'string', name);
      assert.ok(typeof s.body === 'string' || Array.isArray(s.body), name);
      assert.equal(typeof s.description, 'string', name);
      assert.ok(s.description.length > 0, name);
    }
  });

  it('have unique prefixes', () => {
    const prefixes = entries.map(([, s]) => s.prefix);
    assert.deepEqual(prefixes, [...new Set(prefixes)]);
  });

  it('each have a compile context (so the compiler check covers them all)', () => {
    assert.deepEqual(entries.map(([, s]) => s.prefix).sort(), Object.keys(SNIPPET_CONTEXT).sort());
  });

  it('indent with tabs so VS Code applies the user indentation', () => {
    for (const [name, s] of entries) {
      for (const line of [].concat(s.body)) assert.doesNotMatch(line, /^ +\S/, `${name}: ${line}`);
    }
  });

  for (const [name, s] of entries) {
    it(`${s.prefix} expands to Siyo with no invalid tokens`, async () => {
      const code = expandSnippet(s.body);
      assert.doesNotMatch(code, /\$\{?\d/, `${name} has an unexpanded placeholder`);
      const bad = (await tokens(code)).filter((t) => t.scopes.some((x) => x.startsWith('invalid')));
      assert.deepEqual(bad, [], name);
    });
  }

  it('use only current 0.9 syntax', () => {
    const all = entries.map(([, s]) => expandSnippet(s.body)).join('\n');
    assert.doesNotMatch(all, /\bdouble\b/, 'double is not a Siyo type');
    assert.doesNotMatch(all, /"[^"\n]*(?<![$\\])\{[a-z_][^"\n]*\}[^"\n]*"/i, 'old {expr} interpolation');
  });
});

describe('expandSnippet', () => {
  it('keeps defaults and drops tab stops', () => {
    assert.equal(expandSnippet(['fn ${1:name}(${2}) {', '\t$0', '}']), 'fn name() {\n\t\n}');
  });
  it('resolves nested placeholders and escapes', () => {
    assert.equal(expandSnippet('${1:a ${2:b}} \\$x'), 'a b $x');
  });
  it('mirrors a tab stop default', () => {
    assert.equal(expandSnippet('fn ${1:f}(${2:x}: int) { ${0:$2} } $1'), 'fn f(x: int) { x } f');
  });
});
