// Static checks of the GitHub Actions workflows: Actions cannot run here, so
// these pin the properties the release process depends on.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import { ROOT } from './helpers/fixtures.mjs';

const dir = path.join(ROOT, '.github', 'workflows');
const load = async (name) => YAML.parse(await readFile(path.join(dir, name), 'utf8'));
const runOf = (job) => job.steps.map((s) => s.run ?? '').join('\n');

function* conditions(workflow) {
  for (const [jobName, job] of Object.entries(workflow.jobs)) {
    if (job.if) yield [jobName, String(job.if)];
    for (const step of job.steps ?? []) if (step.if) yield [`${jobName}: ${step.name ?? step.uses ?? step.run}`, String(step.if)];
  }
}

describe('workflows', () => {
  it('are exactly ci.yml and release.yml', async () => {
    assert.deepEqual((await readdir(dir)).sort(), ['ci.yml', 'release.yml']);
  });

  it('never read secrets in an if: (the secrets context is not available there)', async () => {
    for (const name of ['ci.yml', 'release.yml']) {
      for (const [where, condition] of conditions(await load(name))) {
        assert.doesNotMatch(condition, /secrets\./, `${name} ${where}`);
      }
    }
  });

  it('never ignore failures', async () => {
    for (const name of ['ci.yml', 'release.yml']) {
      const text = await readFile(path.join(dir, name), 'utf8');
      assert.doesNotMatch(text, /continue-on-error/, name);
    }
  });

  it('install from the lockfile with the .nvmrc Node version', async () => {
    for (const name of ['ci.yml', 'release.yml']) {
      for (const [jobName, job] of Object.entries((await load(name)).jobs)) {
        const setup = job.steps.find((s) => String(s.uses).startsWith('actions/setup-node@'));
        assert.equal(setup?.with?.['node-version-file'], '.nvmrc', `${name} ${jobName}`);
        assert.match(runOf(job), /^npm ci( --ignore-scripts)?$/m, `${name} ${jobName}`);
        assert.doesNotMatch(runOf(job), /npm install|npx --yes|@latest/, `${name} ${jobName}`);
      }
    }
  });

  it('CI tests, packages and verifies the VSIX', async () => {
    const run = runOf((await load('ci.yml')).jobs.build);
    for (const cmd of ['npm test', 'npm run package', 'npm run verify:vsix']) assert.match(run, new RegExp(`^${cmd}$`, 'm'));
  });

  describe('release', async () => {
    const wf = await load('release.yml');
    const { build, publish } = wf.jobs;
    const step = (name) => publish.steps.find((s) => s.name === name);

    it('runs on version tags', () => assert.deepEqual(wf.on, { push: { tags: ['v*'] } }));

    it('build checks the tag against package.json, then tests, packages and verifies', () => {
      const run = runOf(build);
      assert.match(run, /GITHUB_REF_NAME/);
      for (const cmd of ['npm test', 'npm run package', 'npm run verify:vsix']) assert.match(run, new RegExp(`^${cmd}`, 'm'));
    });

    it('publish uses the VSIX built and tested by the build job', () => {
      assert.equal(publish.needs, 'build');
      assert.ok(publish.steps.some((s) => String(s.uses).startsWith('actions/download-artifact@')));
      assert.match(runOf(publish), /verify-vsix\.mjs "\$VSIX"/);
      assert.doesNotMatch(runOf(publish), /npm run package|vsce package/);
    });

    it('detects credentials without exposing them beyond single steps', () => {
      assert.equal(publish.env?.OVSX_PAT, undefined);
      assert.equal(publish.env?.VSCE_PAT, undefined);
      const creds = step('Detect registry credentials');
      assert.equal(creds.env.OVSX_PAT, '${{ secrets.OVSX_PAT }}');
      assert.equal(creds.env.VSCE_PAT, '${{ secrets.VSCE_PAT }}');
    });

    for (const [registry, secret, output] of [['Open VSX', 'OVSX_PAT', 'ovsx'], ['VS Code Marketplace', 'VSCE_PAT', 'vsce']]) {
      it(`${registry}: publishes only with ${secret}, otherwise reports the skip`, () => {
        const pub = step(`Publish to ${registry}`);
        assert.equal(pub.if, `steps.credentials.outputs.${output} == 'true'`);
        assert.equal(pub.env[secret], `\${{ secrets.${secret} }}`);
        assert.match(pub.run, /"\$VSIX"/);
        const skipped = step(`Skip ${registry}`);
        assert.equal(skipped.if, `steps.credentials.outputs.${output} != 'true'`);
        assert.match(skipped.run, /::notice/);
        assert.match(skipped.run, /GITHUB_STEP_SUMMARY/);
        assert.ok(!skipped.env?.[secret]);
      });
    }

    it('the job holding write access keeps its token out of .git and runs no install scripts', () => {
      const checkout = publish.steps.find((s) => String(s.uses).startsWith('actions/checkout@'));
      assert.equal(checkout.with?.['persist-credentials'], false);
      assert.match(runOf(publish), /^npm ci --ignore-scripts$/m);
    });

    it('a re-run after a partial release does not fail on an already published version', () => {
      assert.match(step('Publish to Open VSX').run, /ovsx publish .*--skip-duplicate/);
      assert.match(step('Publish to VS Code Marketplace').run, /vsce publish .*--skip-duplicate/);
    });

    it('only the publish job can write repository contents', () => {
      assert.deepEqual(wf.permissions, { contents: 'read' });
      assert.deepEqual(publish.permissions, { contents: 'write' });
      assert.equal(build.permissions, undefined);
    });
  });
});
