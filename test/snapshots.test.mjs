// Whole-file tokenization snapshots of real Siyo 0.9 programs. Any change to
// how a fixture tokenizes fails here; regenerate deliberately with
//   UPDATE_SNAPSHOTS=1 npm test
// and review the diff.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { tokenizeLines } from './helpers/tokenize.mjs';
import { ROOT as root, fixtureFiles } from './helpers/fixtures.mjs';

const snapshotsDir = path.join(root, 'test', 'snapshots');
const update = process.env.UPDATE_SNAPSHOTS === '1';

function render(lines, source) {
  const out = [];
  source.split(/\r?\n/).forEach((text, i) => {
    out.push(`${i + 1}: ${text}`);
    for (const t of lines[i]) {
      const scopes = t.scopes.filter((s) => s !== 'source.siyo');
      out.push(`  ${JSON.stringify(t.text)} ${scopes.join(' ')}`.trimEnd());
    }
  });
  return out.join('\n') + '\n';
}

describe('fixture snapshots', async () => {
  for (const file of await fixtureFiles()) {
    const name = path.basename(file, '.siyo');
    it(name, async () => {
      const source = (await readFile(file, 'utf8')).replace(/\r\n/g, '\n');
      const lines = await tokenizeLines(source);
      const actual = render(lines, source);
      const snapshotPath = path.join(snapshotsDir, `${name}.snap`);
      if (update) {
        await mkdir(snapshotsDir, { recursive: true });
        await writeFile(snapshotPath, actual);
        return;
      }
      let expected;
      try {
        expected = await readFile(snapshotPath, 'utf8');
      } catch {
        assert.fail(`missing snapshot ${path.relative(root, snapshotPath)}; run UPDATE_SNAPSHOTS=1 npm test`);
      }
      assert.equal(actual, expected);
    });

    it(`${name} has no invalid tokens (fixtures are valid Siyo)`, async () => {
      const source = await readFile(file, 'utf8');
      const bad = (await tokenizeLines(source)).flat().filter((t) => t.scopes.some((s) => s.startsWith('invalid')));
      assert.deepEqual(bad, []);
    });
  }
});
