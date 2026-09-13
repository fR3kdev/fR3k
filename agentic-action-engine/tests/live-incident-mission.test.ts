import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { createLiveIncidentMission } from '../src/demo/live-incident-mission.js';

const repository = 'fR3kdev/fR3k';
const issueNumber = 1;
const videoId = 'xKOL36Yjs0U';
const ntfyTopic = 'fr3k-live-testtopic';
const youtubeHtml = `<script>"videoDetails":{"videoId":"${videoId}","title":"Hackathon stream","isLiveContent":true}</script><script>"liveBroadcastDetails":{"isLiveNow":true}</script>`;

function fakeFetch(options: { wrongIssue?: boolean } = {}) {
  let ntfyEvent: Record<string, unknown> | undefined;
  let githubComment: Record<string, unknown> | undefined;
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url === `https://www.youtube.com/watch?v=${videoId}`) return new Response(youtubeHtml);
    if (url === 'https://ntfy.sh' && init?.method === 'POST') {
      const body = JSON.parse(String(init.body));
      ntfyEvent = { id: 'ntfy-event-1', event: 'message', topic: ntfyTopic, title: body.title, message: body.message };
      return new Response(JSON.stringify(ntfyEvent));
    }
    if (url.startsWith(`https://ntfy.sh/${ntfyTopic}/json?`)) return new Response(`${JSON.stringify(ntfyEvent)}\n`);

    const issueApi = `https://api.github.com/repos/${repository}/issues/${issueNumber}`;
    if (url === issueApi && init?.method !== 'POST') {
      const number = options.wrongIssue ? 2 : issueNumber;
      return new Response(JSON.stringify({ id: 100, number, title: 'Hackathon P0', body: 'Ship live mission', state: 'open', url: issueApi, html_url: `https://github.com/${repository}/issues/${issueNumber}` }));
    }
    if (url === `${issueApi}/comments` && init?.method === 'POST') {
      const body = JSON.parse(String(init.body));
      githubComment = { id: 9001, body: body.body, issue_url: issueApi, html_url: `https://github.com/${repository}/issues/${issueNumber}#issuecomment-9001` };
      return new Response(JSON.stringify(githubComment));
    }
    if (url.startsWith(`${issueApi}/comments?`)) return new Response(JSON.stringify(githubComment ? [githubComment] : []));
    if (url === `https://api.github.com/repos/${repository}/issues/comments/9001`) return new Response(JSON.stringify(githubComment));
    throw new Error(`unexpected fetch ${init?.method ?? 'GET'} ${url}`);
  }) as typeof fetch;
}

async function fixture(t: TestContext, runId: string, fetch: typeof globalThis.fetch) {
  const root = await mkdtemp(join(tmpdir(), 'fr3k-live-incident-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return createLiveIncidentMission({ root, runId, repository, issueNumber, videoId, ntfyTopic, githubToken: async () => 'test-token', fetch });
}

test('live incident mission requires two exact approvals and confirms all three external apps', async t => {
  const demo = await fixture(t, 'live-happy', fakeFetch());
  let view = await demo.runtime.create(demo.mission);
  view = await demo.runtime.run(demo.mission.id);
  assert.equal(view.status, 'WAITING_FOR_APPROVAL');
  assert.equal(view.pending?.action.tool, 'ntfy.publish_status');
  assert.deepEqual(view.observations.map(o => o.tool), ['youtube.read_live_state', 'github.read_issue']);

  view = await demo.runtime.approve(demo.mission.id, view.pending!.digest, 'test-operator', true);
  view = await demo.runtime.run(demo.mission.id);
  assert.equal(view.status, 'WAITING_FOR_APPROVAL');
  assert.equal(view.pending?.action.tool, 'github.write_evidence');
  assert.ok(view.observations.some(o => o.tool === 'ntfy.publish_status'));

  view = await demo.runtime.approve(demo.mission.id, view.pending!.digest, 'test-operator', true);
  view = await demo.runtime.run(demo.mission.id);
  assert.equal(view.status, 'CONFIRMED_SUCCESS');
  assert.equal(view.evaluation?.passed, true);
  assert.equal(view.evaluation?.score, 1);
  assert.deepEqual(view.observations.map(o => o.label), ['VERIFIED', 'VERIFIED', 'VERIFIED', 'VERIFIED']);
  assert.equal(view.events.filter(e => e.kind === 'approval.granted').length, 2);
});

test('wrong GitHub issue identity fails before any external write', async t => {
  const demo = await fixture(t, 'live-wrong-issue', fakeFetch({ wrongIssue: true }));
  await demo.runtime.create(demo.mission);
  const view = await demo.runtime.run(demo.mission.id);
  assert.equal(view.status, 'TOOL_UNAVAILABLE');
  assert.equal(view.events.some(e => e.kind === 'tool.started' && e.data.effect === 'write'), false);
});

test('policy can prohibit live writes even after YouTube and GitHub are grounded', async t => {
  const demo = await fixture(t, 'live-policy-denial', fakeFetch());
  const mission = { ...demo.mission, policy: { ...demo.mission.policy, maxWrites: 0 } };
  await demo.runtime.create(mission);
  const view = await demo.runtime.run(mission.id);
  assert.equal(view.status, 'DENIED_BY_POLICY');
  assert.equal(view.events.some(e => e.kind === 'approval.granted'), false);
  assert.equal(view.events.some(e => e.kind === 'tool.started' && e.data.effect === 'write'), false);
});
