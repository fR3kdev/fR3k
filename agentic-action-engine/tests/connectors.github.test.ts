import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { registerLiveConnectors } from '../src/connectors/index.js';
import { ToolRegistry, ToolFault, type ToolContext } from '../src/tools/registry.js';
const context: ToolContext = { runId: 'run', step: 'step', idempotencyKey: 'key', signal: new AbortController().signal };
const value = { repository: 'sample/project', issueNumber: 7 };
const write = { ...value, body: 'Evidence ✓' };
const marked = `${write.body}\n\n<!-- fr3k-evidence:${createHash('sha256').update('key').digest('hex')} -->`;
const comment = { id: 42, body: marked, issue_url: 'https://api.github.com/repos/sample/project/issues/7', html_url: 'https://github.com/sample/project/issues/7#issuecomment-42' };
const issue = { id: 12, number: 7, title: 'Incident', body: null, state: 'open', url: comment.issue_url, html_url: 'https://github.com/sample/project/issues/7' };
function setup(handler: (url: string, init?: RequestInit) => Response | Promise<Response>, token = async () => 'private-token') {
  const registry = new ToolRegistry();
  registerLiveConnectors(registry, { allowedRepositories: ['sample/project'], githubToken: token, fetch: (async (url, init) => handler(String(url), init)) as typeof fetch });
  return registry;
}
const response = (data: unknown, headers?: HeadersInit) => new Response(JSON.stringify(data), { headers });
const fault = (code: string) => (error: unknown) => error instanceof ToolFault && error.code === code && error.message === code;
test('registry metadata and normalized issue read with fixed transport settings', async () => {
  const registry = setup((url, init) => {
    assert.equal(url, comment.issue_url); assert.equal(init?.redirect, 'error');
    assert.equal(init?.signal, context.signal); return response(issue);
  });
  assert.equal(registry.list().length, 2);
  assert.equal(registry.get('github.write_evidence').idempotency, 'reconcile-only');
  assert.deepEqual(await registry.get('github.read_issue').execute(value, context), { issueId: 12, number: 7, title: 'Incident', body: '', state: 'open', sourceUrl: issue.html_url });
});
test('strict schemas and allowlist reject before credentials or transport', async () => {
  let called = false;
  const registry = setup(() => { called = true; throw Error('transport'); }, async () => { called = true; return 'token'; });
  const tool = registry.get('github.read_issue');
  for (const bad of [{ ...value, issueNumber: 0 }, { ...value, extra: true }, { ...value, repository: 'sample/..' }, { ...value, repository: 'https://evil.test' }]) assert.throws(() => tool.parse(bad));
  await assert.rejects(tool.execute({ ...value, repository: 'sample/other' }, context), fault('REJECTED'));
  assert.equal(called, false);
});
test('provider response identity and schema are validated', async () => {
  for (const bad of [{ ...issue, number: 8 }, { ...issue, html_url: 'https://evil.test' }, { ...issue, id: 'bad' }]) {
    await assert.rejects(setup(() => response(bad)).get('github.read_issue').execute(value, context), fault('UNAVAILABLE'));
  }
});
for (const [status, code] of [[401, 'REJECTED'], [403, 'REJECTED'], [404, 'REJECTED'], [429, 'TRANSIENT'], [500, 'TRANSIENT']] as const) {
  test(`HTTP ${status} is sanitized`, async () => {
    await assert.rejects(setup(() => new Response('private-token secret provider body', { status })).get('github.read_issue').execute(value, context), fault(code));
  });
}
test('rate-limited 403, abort, credentials and malformed JSON have sanitized faults', async () => {
  await assert.rejects(setup(() => new Response('', { status: 403, headers: { 'x-ratelimit-remaining': '0' } })).get('github.read_issue').execute(value, context), fault('TRANSIENT'));
  await assert.rejects(setup(() => { throw Error('secret'); }).get('github.read_issue').execute(value, context), fault('UNAVAILABLE'));
  await assert.rejects(setup(() => response(issue), async () => { throw Error('secret'); }).get('github.read_issue').execute(value, context), fault('UNAVAILABLE'));
  await assert.rejects(setup(() => new Response('secret')).get('github.read_issue').execute(value, context), fault('UNAVAILABLE'));
  await assert.rejects(setup(() => { throw Error('should not call'); }).get('github.read_issue').execute(value, { ...context, signal: AbortSignal.abort() }), fault('UNAVAILABLE'));
});
test('write appends marker and verification paginates then reads exact comment', async () => {
  const requests: string[] = [];
  const registry = setup((url, init) => {
    requests.push(url);
    if (init?.method === 'POST') { assert.deepEqual(JSON.parse(String(init.body)), { body: marked }); return response(comment); }
    if (new URL(url).searchParams.get('page') === '1') return response([], { link: '<https://api.github.com/repos/sample/project/issues/7/comments?per_page=100&page=2>; rel="next"' });
    if (new URL(url).searchParams.get('page') === '2') return response([comment]);
    assert.equal(url, 'https://api.github.com/repos/sample/project/issues/comments/42'); return response(comment);
  });
  const tool = registry.get('github.write_evidence');
  const result = await tool.execute(write, context);
  assert.equal((await tool.verify(write, context, result)).status, 'confirmed');
  assert.equal(requests.length, 4);
});
test('lost response makes exactly one write and can reconcile later', async () => {
  let posts = 0;
  const tool = setup((url, init) => {
    if (init?.method === 'POST') { posts++; throw Error('secret transport failure'); }
    return response(url.includes('?') ? [comment] : comment);
  }).get('github.write_evidence');
  await assert.rejects(tool.execute(write, context), fault('UNCERTAIN'));
  assert.equal((await tool.verify(write, context)).status, 'confirmed'); assert.equal(posts, 1);
});
test('empty, duplicate, wrong issue, changed body, and readback mismatch remain unknown', async () => {
  for (const comments of [[], [comment, comment], [{ ...comment, issue_url: `${comment.issue_url}9` }], [{ ...comment, body: `altered ${marked}` }]]) {
    const tool = setup(() => response(comments)).get('github.write_evidence');
    assert.equal((await tool.verify(write, context)).status, 'unknown');
  }
  const tool = setup(url => response(url.includes('?') ? [comment] : { ...comment, id: 99 })).get('github.write_evidence');
  assert.equal((await tool.verify(write, context)).status, 'unknown');
});
test('successful POST is not proof; malformed write and server failure are uncertain', async () => {
  const tool = setup((_, init) => response(init?.method === 'POST' ? comment : [])).get('github.write_evidence');
  const result = await tool.execute(write, context);
  assert.equal((await tool.verify(write, context, result)).status, 'unknown');
  for (const reply of [response({ id: 42 }), new Response('secret', { status: 500 })]) {
    await assert.rejects(setup(() => reply).get('github.write_evidence').execute(write, context), fault('UNCERTAIN'));
  }
});
test('untrusted pagination URL never receives credentials and failed verification stays unknown', async () => {
  let calls = 0;
  const tool = setup(() => { calls++; return response([comment], { link: '<https://evil.test/comments?page=2>; rel="next"' }); }).get('github.write_evidence');
  assert.equal((await tool.verify(write, context)).status, 'unknown'); assert.equal(calls, 1);
  assert.equal((await setup(() => { throw Error('secret'); }).get('github.write_evidence').verify(write, context)).status, 'unknown');
});
