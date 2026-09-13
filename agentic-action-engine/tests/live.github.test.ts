import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { createGithubLiveRuntime, resolveGithubToken } from '../src/live/github.js';
import { ToolFault } from '../src/tools/registry.js';

async function root(t: TestContext) {
  const dir = await mkdtemp(join(tmpdir(), 'fr3k-live-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

test('the live GitHub launcher is read-only by construction and writes are never registered', async t => {
  const mission = await createGithubLiveRuntime({ owner: 'fR3kdev', repo: 'fR3k' }, { token: { name: 'test-token', token: 'gho_test' }, root: await root(t) });
  assert.equal(mission.mission.policy.sandbox, false);
  assert.equal(mission.mission.policy.maxWrites, 0);
  assert.deepEqual([...mission.mission.policy.allowedTools].sort(), ['github.list_commits', 'github.list_open_issues', 'github.repo_info']);
  for (const name of mission.mission.policy.allowedTools) {
    const tool = mission.runtime.tools.get(name);
    assert.equal(tool.effect, 'read');
    assert.equal(tool.autonomy, 0);
    assert.equal(tool.environment, 'live');
    assert.notEqual(tool.autonomy, 'X');
  }
  assert.throws(() => mission.runtime.tools.get('github.repo_delete'), ToolFault, 'a write tool must never be registered');
  await rm(mission.storeRoot, { recursive: true, force: true });
});

test('token resolution returns a non-empty token or fails closed', async () => {
  const { GH_TOKEN, GITHUB_TOKEN } = process.env;
  try {
    delete process.env.GH_TOKEN;
    delete process.env.GITHUB_TOKEN;
    try {
      const credential = await resolveGithubToken();
      assert.ok(credential.token.length > 0);
      assert.ok(['GH_TOKEN', 'GITHUB_TOKEN', 'gh auth token'].includes(credential.name));
    } catch (error) {
      assert.match((error as Error).message, /^No GitHub token/);
    }
  } finally {
    if (GH_TOKEN !== undefined) process.env.GH_TOKEN = GH_TOKEN;
    if (GITHUB_TOKEN !== undefined) process.env.GITHUB_TOKEN = GITHUB_TOKEN;
  }
});