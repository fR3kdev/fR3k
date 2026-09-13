import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLiveIncidentMission } from '../src/demo/live-incident-mission.js';
import { createFetchModelProvider } from '../src/model/planner.js';
import { modelConfiguration, openLiveIncident } from '../src/live/incident-host.js';
import { modelMetrics } from '../src/model/metrics.js';
import { startDashboard } from '../src/dashboard/server.js';
import { createRuntimeDashboardBridge } from '../src/demo/dashboard-bridge.js';
import { fakeFetch, fixture } from './incident-support.js';

async function temp(t: { after(fn: () => Promise<void>): void }) {
  const root = await mkdtemp(join(tmpdir(), 'fr3k-model-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

function modelTransport(mutate?: (decision: any) => unknown) {
  const requests: any[] = [];
  const transport = (async (_url: unknown, init: RequestInit) => {
    assert.equal(init.redirect, 'error');
    const request = JSON.parse(String(init.body));
    requests.push(request);
    assert.match(request.messages[0].content, /"action":\{/);
    const prompt = JSON.parse(request.messages[1].content);
    assert.equal(prompt.tools.length, 4);
    const context = prompt.mission.context;
    const refs = prompt.observations.map((o: any) => o.seq);
    const actions = [
      { tool: 'youtube.read_live_state', input: { videoId: context.videoId } },
      { tool: 'github.read_issue', input: { repository: context.repository, issueNumber: context.issueNumber } },
      { tool: 'ntfy.publish_status', input: { topic: context.ntfyTopic, title: 'Observed stream state', message: `Stream ${context.videoId} is live; canonical issue read.` } },
      { tool: 'github.write_evidence', input: { repository: context.repository, issueNumber: context.issueNumber, body: `Stream ${context.videoId}; receipt ntfy-event-1.` } },
    ];
    const action = actions[prompt.observations.length];
    const decision = action ? { kind: 'action', action: { ...action, reason: 'Use grounded state', evidenceRefs: refs } } : { kind: 'finish', reason: 'All receipts observed' };
    return Response.json({ id: `generation-${requests.length}`, model: 'fixture-model', usage: { prompt_tokens: 100, completion_tokens: 30, cost: 0.001 }, choices: [{ message: { content: JSON.stringify(mutate ? mutate(decision) : decision) } }] });
  }) as typeof fetch;
  return { requests, transport };
}

async function modelMission(root: string, model: ReturnType<typeof modelTransport>, transport = fakeFetch()) {
  return createLiveIncidentMission({ root, runId: 'model-mission', repository: 'fR3kdev/fR3k', issueNumber: 1, videoId: 'xKOL36Yjs0U', ntfyTopic: 'fr3k-live-testtopic', githubToken: async () => 'github-secret', fetch: transport,
    model: { endpoint: 'https://model.example/chat/completions', apiKey: 'model-secret', model: 'fixture-model', fetch: model.transport },
  });
}

test('dashboard drives model planning, two separate approvals and read-back; generations survive restart', async t => {
  const root = await temp(t);
  const model = modelTransport();
  const transport = fakeFetch();
  let live = await modelMission(root, model, transport);
  await live.runtime.create(live.mission);
  const runtimes = new Map([[live.mission.id, live.runtime]]);
  const server = await startDashboard({ port: 0, actor: 'test-operator', bridge: createRuntimeDashboardBridge(runtimes) });
  t.after(server.close);
  const page = await (await fetch(server.url)).text();
  const token = /name="dashboard-token" content="([a-f0-9]+)"/.exec(page)![1]!;
  const endpoint = `${server.url}/api/runs/${live.mission.id}`;
  const post = async (path: string, body: unknown) => fetch(endpoint + path, { method: 'POST', headers: { Origin: server.url, 'Content-Type': 'application/json', 'X-Dashboard-Token': token }, body: JSON.stringify(body) });
  const wait = async (status: string) => {
    for (let i = 0; i < 100; i++) {
      const view = await (await fetch(endpoint)).json();
      if (view.status === status && !view.dashboard.resuming) return view;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.fail(`did not reach ${status}`);
  };
  assert.equal((await post('/resume', {})).status, 202);
  let view = await wait('WAITING_FOR_APPROVAL');
  assert.equal(view.pending.action.tool, 'ntfy.publish_status');
  assert.equal(view.events.filter((e: any) => e.kind === 'tool.started' && e.data.effect === 'write').length, 0);
  assert.equal((await post('/approval', { digest: 'wrong-digest', allow: true })).status, 409);
  assert.equal((await post('/approval', { digest: view.pending.digest, allow: true })).status, 200);
  assert.equal((await (await fetch(endpoint)).json()).observations.length, 2, 'approval alone does not execute');
  assert.equal((await post('/resume', {})).status, 202);
  view = await wait('WAITING_FOR_APPROVAL');
  assert.equal(view.pending.action.tool, 'github.write_evidence');
  // New runtime/provider instances attach the persisted exact pending action.
  live = await modelMission(root, model, transport);
  runtimes.set(live.mission.id, live.runtime);
  assert.equal((await live.runtime.inspect(live.mission.id)).pending?.digest, view.pending.digest);
  assert.equal((await post('/approval', { digest: view.pending.digest, allow: true })).status, 200);
  assert.equal((await post('/resume', {})).status, 202);
  view = await wait('CONFIRMED_SUCCESS');
  assert.equal(view.evaluation.score, 1);
  assert.equal(view.modelMetrics.modelCalls, 5);
  assert.equal(view.modelMetrics.inputTokens, 500);
  assert.equal(view.modelMetrics.modelCostUsd, 0.005);
  assert.equal(view.events.filter((e: any) => e.kind === 'tool.started' && e.data.effect === 'write').length, 2);
  assert.equal(view.events.filter((e: any) => e.kind === 'approval.granted').length, 2);
  const journal = JSON.stringify(view.events);
  assert.ok(!journal.includes('model-secret') && !journal.includes('github-secret'));
  assert.ok(!JSON.stringify(model.requests).includes('github-secret'));
});

test('model cannot change the exact issue target or tool sequence', async t => {
  for (const mutate of [
    (d: any) => d.kind === 'action' && d.action.tool === 'github.read_issue' ? { ...d, action: { ...d.action, input: { ...d.action.input, issueNumber: 2 } } } : d,
    (d: any) => ({ kind: 'action', action: { tool: 'github.write_evidence', input: { repository: 'fR3kdev/fR3k', issueNumber: 1, body: 'injected' }, reason: 'skip reads', evidenceRefs: [] } }),
  ]) {
    const live = await modelMission(await temp(t), modelTransport(mutate));
    await live.runtime.create(live.mission);
    const view = await live.runtime.run(live.mission.id);
    assert.equal(view.status, 'CONFIRMED_FAILURE');
    assert.equal(view.events.some(e => e.kind === 'tool.started' && e.data.effect === 'write'), false);
  }
});

test('offline stream refuses notifications for both planners', async t => {
  const fixed = await fixture(t, 'offline-fixed', fakeFetch({ offline: true }));
  const model = await modelMission(await temp(t), modelTransport(), fakeFetch({ offline: true }));
  for (const live of [fixed, model]) {
    await live.runtime.create(live.mission);
    const view = await live.runtime.run(live.mission.id);
    assert.equal(view.status, 'CONFIRMED_FAILURE');
    assert.equal(view.events.some(e => e.kind === 'approval.requested' || e.kind === 'tool.started' && e.data.effect === 'write'), false);
  }
});

test('live host resumes stored targets without generating a new topic or replaying writes', async t => {
  const env = { FR3K_TRACE_ROOT: await temp(t), FR3K_RUN_ID: 'resume-host', FR3K_GITHUB_TOKEN: 'secret' };
  const transport = fakeFetch();
  const first = await openLiveIncident(env, transport);
  const resumed = await openLiveIncident({ ...env, FR3K_RESUME: '1' }, transport);
  assert.deepEqual(resumed.target, first.target);
  assert.deepEqual((await resumed.runtime.inspect(resumed.runId)).events, (await first.runtime.inspect(first.runId)).events);
  await assert.rejects(openLiveIncident({ ...env, FR3K_RESUME: '1', FR3K_ISSUE_NUMBER: '2' }), /target differs/);
  await assert.rejects(openLiveIncident({ ...env, FR3K_RESUME: '1', FR3K_PLANNER: 'model', FR3K_MODEL: 'x', FR3K_MODEL_API_KEY: 'secret', FR3K_MODEL_ENDPOINT: 'https://model.example/chat/completions' }), /configuration differs/);
  assert.throws(() => modelConfiguration({ FR3K_PLANNER: 'model' }), /requires/);
});

test('provider errors are sanitized and failed/missing usage is never reported as free', async () => {
  const provider = createFetchModelProvider({ endpoint: 'https://model.example/chat/completions', apiKey: 'secret', model: 'x', fetch: (async () => { throw new Error('private secret'); }) as typeof fetch });
  await assert.rejects(provider.generate({} as never, new AbortController().signal), error => String(error).includes('Model request failed') && !String(error).includes('secret'));
  const records = provider.drainGenerations!();
  assert.equal((records[0] as any).status, 'failed');
  assert.equal((records[0] as any).costUsd, null);
  const metrics = modelMetrics([{ kind: 'model.generation', data: { generation: records[0] } }] as never);
  assert.equal(metrics.modelCostUsd, null);
  assert.throws(() => createFetchModelProvider({ endpoint: 'http://remote.example/chat/completions', apiKey: 'secret', model: 'x' }), /HTTPS/);
});
