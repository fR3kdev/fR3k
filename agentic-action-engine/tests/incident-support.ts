import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLiveIncidentMission } from '../src/demo/live-incident-mission.js';

const repository = 'fR3kdev/fR3k';
const issueNumber = 1;
const videoId = 'xKOL36Yjs0U';
const ntfyTopic = 'fr3k-live-testtopic';
const youtubeHtml = `<script>"videoDetails":{"videoId":"${videoId}","title":"Hackathon stream","isLiveContent":true}</script><script>"liveBroadcastDetails":{"isLiveNow":true}</script>`;

export function fakeFetch(options: { wrongIssue?: boolean; offline?: boolean } = {}) {
  let ntfyEvent: Record<string, unknown> | undefined;
  let githubComment: Record<string, unknown> | undefined;
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url === `https://www.youtube.com/watch?v=${videoId}`) return new Response(options.offline ? youtubeHtml.replace('"isLiveNow":true', '"isLiveNow":false') : youtubeHtml);
    if (url === 'https://ntfy.sh' && init?.method === 'POST') {
      const body = JSON.parse(String(init.body));
      ntfyEvent = { time: Math.floor(Date.now()/1000), id: 'ntfy-event-1', event: 'message', topic: ntfyTopic, title: body.title, message: body.message };
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

export async function fixture(t: { after(fn: () => void | Promise<void>): void }, runId: string, fetch: typeof globalThis.fetch) {
  const root = await mkdtemp(join(tmpdir(), 'fr3k-live-incident-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return createLiveIncidentMission({ root, runId, repository, issueNumber, videoId, ntfyTopic, githubToken: async () => 'test-token', fetch });
}

