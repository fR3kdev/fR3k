import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { z } from 'zod';
import { createLiveIncidentMission } from '../demo/live-incident-mission.js';
import { TraceStore } from '../trace/jsonl.js';
import { project } from '../core/state-machine.js';
import type { FetchModelEndpoint } from '../model/planner.js';

const execFileAsync = promisify(execFile);
const targetSchema = z.strictObject({
  repository: z.string().regex(/^[\w.-]+\/[\w.-]+$/), issueNumber: z.int().positive(),
  videoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/), ntfyTopic: z.string().regex(/^[A-Za-z0-9_-]{8,80}$/),
});
const configured = (env: NodeJS.ProcessEnv, key: string) => env[key]?.trim() || undefined;

export function modelConfiguration(env: NodeJS.ProcessEnv): FetchModelEndpoint | undefined {
  const mode = configured(env, 'FR3K_PLANNER') ?? (configured(env, 'FR3K_MODEL') ? 'model' : 'deterministic');
  if (!['model', 'deterministic'].includes(mode)) throw new Error('FR3K_PLANNER must be model or deterministic');
  if (mode === 'deterministic') return undefined;
  const endpoint = configured(env, 'FR3K_MODEL_ENDPOINT');
  const model = configured(env, 'FR3K_MODEL');
  const apiKey = configured(env, 'FR3K_MODEL_API_KEY');
  if (!endpoint || !model || !apiKey) throw new Error('Model mode requires FR3K_MODEL_ENDPOINT, FR3K_MODEL and FR3K_MODEL_API_KEY');
  return { endpoint, model, apiKey };
}

/** Shared by the CLI and dashboard; credentials are never serialized in the journal. */
export async function openLiveIncident(env: NodeJS.ProcessEnv = process.env, transport?: typeof fetch) {
  const resume = env.FR3K_RESUME === '1';
  if (resume && !configured(env, 'FR3K_RUN_ID')) throw new Error('Resume requires FR3K_RUN_ID');
  const runId = configured(env, 'FR3K_RUN_ID') ?? `live-incident-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const root = resolve(configured(env, 'FR3K_TRACE_ROOT') ?? '.work/live-traces');
  let target = targetSchema.parse({
    repository: configured(env, 'FR3K_REPOSITORY') ?? 'fR3kdev/fR3k',
    issueNumber: Number(configured(env, 'FR3K_ISSUE_NUMBER') ?? '1'),
    videoId: configured(env, 'FR3K_YOUTUBE_VIDEO_ID') ?? 'xKOL36Yjs0U',
    ntfyTopic: configured(env, 'FR3K_NTFY_TOPIC') ?? `fr3k-live-${randomUUID().replaceAll('-', '').slice(0, 16)}`,
  });
  const previous = resume ? project(await new TraceStore(root).read(runId)) : undefined;
  if (previous) {
    const persisted = targetSchema.parse(previous.mission.context);
    for (const [key, variable] of Object.entries({ repository: 'FR3K_REPOSITORY', issueNumber: 'FR3K_ISSUE_NUMBER', videoId: 'FR3K_YOUTUBE_VIDEO_ID', ntfyTopic: 'FR3K_NTFY_TOPIC' })) {
      if (configured(env, variable) && String(target[key as keyof typeof target]) !== String(persisted[key as keyof typeof persisted])) throw new Error('Resume target differs from persisted mission');
    }
    target = persisted;
  }
  const model = modelConfiguration(env);
  const live = createLiveIncidentMission({ root, runId, ...target, model, fetch: transport,
    timeoutMs: z.coerce.number().int().min(1000).max(300_000).parse(env.FR3K_TIMEOUT_MS ?? 60_000),
    githubToken: async () => {
      const key = configured(env, 'FR3K_GITHUB_TOKEN') ?? configured(env, 'GH_TOKEN');
      if (key) return key;
      try {
        const result = await execFileAsync('gh', ['auth', 'token'], { encoding: 'utf8', timeout: 10_000 });
        if (result.stdout.trim()) return result.stdout.trim();
      } catch { /* only a sanitized error escapes */ }
      throw new Error('Configure FR3K_GITHUB_TOKEN, GH_TOKEN or an authenticated GitHub CLI');
    },
  });
  if (previous) {
    if (previous.events[0]?.data.planner !== live.runtime.planner.id || previous.events[0]?.data.evaluator !== live.runtime.evaluator.id) throw new Error('Resume planner/evaluator configuration differs from recorded run');
  } else await live.runtime.create(live.mission);
  return { ...live, root, runId, target, actor: configured(env, 'FR3K_OPERATOR') ?? 'stream-operator', plannerMode: model ? 'model' : 'deterministic' };
}
