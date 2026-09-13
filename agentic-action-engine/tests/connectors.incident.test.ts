import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { registerIncidentConnectors } from '../src/connectors/incident.js';
import { ToolFault, ToolRegistry, type ToolContext } from '../src/tools/registry.js';

const videoId = 'xKOL36Yjs0U';
const topic = 'fr3k-test-topic';
const context: ToolContext = { runId: 'run', step: 'step', idempotencyKey: 'key', signal: new AbortController().signal };
const marker = `[fr3k:${createHash('sha256').update('key').digest('hex').slice(0, 24)}]`;
const html = `<html><script>"videoDetails":{"videoId":"${videoId}","title":"Live build","isLiveContent":true}</script><script>"liveBroadcastDetails":{"isLiveNow":true}</script></html>`;
const response = (body: string, init: ResponseInit = {}) => new Response(body, init);
const json = (value: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' }, ...init });
const fault = (code: string) => (error: unknown) => error instanceof ToolFault && error.code === code;

function setup(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const registry = new ToolRegistry();
  registerIncidentConnectors(registry, { allowedYoutubeVideoIds: [videoId], allowedNtfyTopics: [topic], fetch: (async (url, init) => handler(String(url), init)) as typeof fetch });
  return registry;
}

test('YouTube connector grounds exact live identity and rejects malformed state', async () => {
  const tool = setup(() => response(html)).get('youtube.read_live_state');
  assert.deepEqual(await tool.execute({ videoId }, context), { videoId, title: 'Live build', isLiveNow: true, isLiveContent: true, sourceUrl: `https://www.youtube.com/watch?v=${videoId}` });
  await assert.rejects(setup(() => response('<html>not player metadata</html>')).get('youtube.read_live_state').execute({ videoId }, context), fault('UNAVAILABLE'));
  await assert.rejects(tool.execute({ videoId: 'AAAAAAAAAAA' }, context), fault('REJECTED'));
});

test('ntfy write is verified by exact topic read-back', async () => {
  let event: Record<string, unknown> | undefined;
  const tool = setup((_url, init) => {
    if (init?.method === 'POST') {
      const body = JSON.parse(String(init.body));
      event = { id: 'evt-1', event: 'message', topic, title: body.title, message: body.message };
      return json(event);
    }
    return response(`${JSON.stringify(event)}\n`);
  }).get('ntfy.publish_status');
  const input = { topic, title: 'Status', message: 'Stream verified' };
  const result = await tool.execute(input, context);
  assert.equal((await tool.verify(input, context, result)).status, 'confirmed');
  assert.equal(event?.message, `Stream verified\n${marker}`);
});

test('ntfy lost response reconciles once and duplicate marker fails closed', async () => {
  const input = { topic, title: 'Status', message: 'Stream verified' };
  const stored = { id: 'evt-lost', event: 'message', topic, title: input.title, message: `${input.message}\n${marker}` };
  let posts = 0;
  const lost = setup((_url, init) => {
    if (init?.method === 'POST') { posts++; throw new Error('response lost'); }
    return response(`${JSON.stringify(stored)}\n`);
  }).get('ntfy.publish_status');
  await assert.rejects(lost.execute(input, context), fault('UNCERTAIN'));
  assert.equal((await lost.verify(input, context)).status, 'confirmed');
  assert.equal(posts, 1);

  const duplicate = setup((_url, init) => init?.method === 'POST' ? json(stored) : response(`${JSON.stringify(stored)}\n${JSON.stringify({ ...stored, id: 'evt-2' })}\n`)).get('ntfy.publish_status');
  assert.equal((await duplicate.verify(input, context)).status, 'unknown');
});
