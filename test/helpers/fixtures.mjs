import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const fixturesDir = path.join(ROOT, 'test', 'fixtures');

/** example.siyo plus test/fixtures/*.siyo: valid Siyo 0.9 programs. */
export async function fixtureFiles() {
  const fixtures = (await readdir(fixturesDir)).filter((f) => f.endsWith('.siyo')).sort();
  return [path.join(ROOT, 'example.siyo'), ...fixtures.map((f) => path.join(fixturesDir, f))];
}
