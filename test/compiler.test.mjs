// Optional: checks that the fixtures and every snippet compile with a real
// Siyo compiler. Set SIYOC_JAR to a siyo-compiler-0.9.x.jar to enable; it is
// skipped otherwise, so CI does not depend on a JVM.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ROOT, fixtureFiles } from './helpers/fixtures.mjs';
import { loadSnippets, expandSnippet, programFor } from './helpers/snippets.mjs';

const jar = process.env.SIYOC_JAR;
const skip = jar ? false : 'set SIYOC_JAR to a Siyo compiler jar to run';

// `siyoc compile` exits non-zero on any diagnostic and never runs the program.
function compiles(dir, file) {
  try {
    execFileSync('java', ['-jar', jar, 'compile', file], { cwd: dir, encoding: 'utf8', timeout: 120_000, stdio: 'pipe' });
    return { ok: true, out: '' };
  } catch (e) {
    return { ok: false, out: `${e.stdout ?? ''}${e.stderr ?? ''}${e.message}` };
  }
}

async function inTempDir(fn) {
  const dir = await mkdtemp(path.join(tmpdir(), 'siyo-check-'));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe('real compiler', { skip }, async () => {
  for (const file of skip ? [] : await fixtureFiles()) {
    it(`compiles ${path.basename(file)}`, () =>
      inTempDir(async (dir) => {
        await copyFile(file, path.join(dir, path.basename(file)));
        const { ok, out } = compiles(dir, path.basename(file));
        assert.ok(ok, out);
      }));
  }

  const readme = skip ? '' : await readFile(path.join(ROOT, 'README.md'), 'utf8');
  [...readme.matchAll(/```siyo\n([\s\S]*?)```/g)].forEach(([, code], i) => {
    it(`compiles README example ${i + 1}`, () =>
      inTempDir(async (dir) => {
        await writeFile(path.join(dir, 'readme.siyo'), code);
        const { ok, out } = compiles(dir, 'readme.siyo');
        assert.ok(ok, `${code}\n${out}`);
      }));
  });

  const snippets = skip ? {} : await loadSnippets();
  for (const [name, snippet] of Object.entries(snippets)) {
    it(`compiles snippet ${snippet.prefix} (${name})`, () =>
      inTempDir(async (dir) => {
        const program = programFor(snippet.prefix, expandSnippet(snippet.body));
        await writeFile(path.join(dir, 'snippet.siyo'), program);
        const { ok, out } = compiles(dir, 'snippet.siyo');
        assert.ok(ok, `${program}\n${out}`);
      }));
  }
});
