import { createHash } from 'node:crypto';
import { z } from 'zod';
import { ToolFault, type ToolContext, type ToolRegistry, type Verification } from '../tools/registry.js';

export interface IncidentConnectorOptions {
  allowedYoutubeVideoIds: string[];
  allowedNtfyTopics: string[];
  fetch?: typeof globalThis.fetch;
  ntfyOrigin?: string;
}

const videoIdSchema = z.string().regex(/^[A-Za-z0-9_-]{11}$/);
const topicSchema = z.string().regex(/^[A-Za-z0-9_-]{8,80}$/);
const youtubeInput = z.strictObject({ videoId: videoIdSchema });
const youtubeOutput = z.strictObject({
  videoId: videoIdSchema,
  title: z.string().min(1),
  isLiveNow: z.boolean(),
  isLiveContent: z.boolean(),
  sourceUrl: z.url(),
});
const ntfyInput = z.strictObject({
  topic: topicSchema,
  title: z.string().min(1).max(120),
  message: z.string().min(1).max(1000),
});
const ntfyOutput = z.strictObject({ eventId: z.string().min(1), sourceUrl: z.url() });
const ntfyEvent = z.object({
  id: z.string().min(1),
  event: z.string(),
  topic: z.string(),
  title: z.string().optional(),
  message: z.string().optional(),
}).passthrough();

function extractObject(text: string, marker: string): unknown {
  const markerAt = text.indexOf(marker);
  if (markerAt < 0) throw new Error('marker missing');
  const start = text.indexOf('{', markerAt + marker.length);
  if (start < 0) throw new Error('object missing');
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') quoted = false;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return JSON.parse(text.slice(start, i + 1));
  }
  throw new Error('unterminated object');
}

const marker = (context: ToolContext) => `[fr3k:${createHash('sha256').update(context.idempotencyKey).digest('hex').slice(0, 24)}]`;
const messageBody = (value: z.infer<typeof ntfyInput>, context: ToolContext) => `${value.message}\n${marker(context)}`;

export function registerIncidentConnectors(registry: ToolRegistry, options: IncidentConnectorOptions): void {
  const youtubeIds = new Set(options.allowedYoutubeVideoIds.map(value => videoIdSchema.parse(value)));
  const ntfyTopics = new Set(options.allowedNtfyTopics.map(value => topicSchema.parse(value)));
  const transport = options.fetch ?? globalThis.fetch;
  const ntfyOrigin = new URL(options.ntfyOrigin ?? 'https://ntfy.sh').origin;

  registry.register({
    name: 'youtube.read_live_state',
    description: 'Read the live state and title for one explicitly allowlisted YouTube video.',
    effect: 'read', autonomy: 0, environment: 'live', reversible: true,
    blastRadius: 'None; one public YouTube watch page is read.',
    idempotency: 'read-only',
    verificationMethod: 'Parse YouTube player metadata and require exact video identity plus live-broadcast state.',
    input: youtubeInput, output: youtubeOutput,
    execute: async value => {
      if (!youtubeIds.has(value.videoId)) throw new ToolFault('REJECTED');
      const sourceUrl = `https://www.youtube.com/watch?v=${value.videoId}`;
      let response: Response;
      try {
        response = await transport(sourceUrl, { redirect: 'error', headers: { 'User-Agent': 'Mozilla/5.0 FR3K-Live-Verification/1.0' } });
      } catch { throw new ToolFault('UNAVAILABLE'); }
      if (!response.ok) throw new ToolFault(response.status >= 500 ? 'TRANSIENT' : 'REJECTED');
      try {
        const html = await response.text();
        const details = z.object({ videoId: videoIdSchema, title: z.string().min(1), isLiveContent: z.boolean() }).parse(extractObject(html, '"videoDetails":'));
        const live = z.object({ isLiveNow: z.boolean() }).parse(extractObject(html, '"liveBroadcastDetails":'));
        if (details.videoId !== value.videoId) throw new Error('identity mismatch');
        return { videoId: details.videoId, title: details.title, isLiveNow: live.isLiveNow, isLiveContent: details.isLiveContent, sourceUrl };
      } catch { throw new ToolFault('UNAVAILABLE'); }
    },
  });

  const source = (topic: string) => `${ntfyOrigin}/${encodeURIComponent(topic)}`;
  const publish = async (value: z.infer<typeof ntfyInput>, context: ToolContext) => {
    if (!ntfyTopics.has(value.topic)) throw new ToolFault('REJECTED');
    let response: Response;
    try {
      response = await transport(ntfyOrigin, {
        method: 'POST', redirect: 'error', signal: context.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: value.topic, title: value.title, message: messageBody(value, context) }),
      });
    } catch { throw new ToolFault('UNCERTAIN'); }
    if (!response.ok) {
      if (response.status >= 500 || response.status === 408) throw new ToolFault('UNCERTAIN');
      if (response.status === 429) throw new ToolFault('TRANSIENT');
      throw new ToolFault('REJECTED');
    }
    try {
      const event = ntfyEvent.parse(await response.json());
      if (event.event !== 'message' || event.topic !== value.topic || event.title !== value.title || event.message !== messageBody(value, context)) throw new Error('response mismatch');
      return { eventId: event.id, sourceUrl: source(value.topic) };
    } catch { throw new ToolFault('UNCERTAIN'); }
  };
  const verify = async (value: z.infer<typeof ntfyInput>, context: ToolContext, result?: z.infer<typeof ntfyOutput>): Promise<Verification> => {
    if (!ntfyTopics.has(value.topic)) return { status: 'unknown', source: source(value.topic) };
    try {
      const url = `${source(value.topic)}/json?poll=1&since=10m`;
      const response = await transport(url, { redirect: 'error', signal: context.signal, headers: { Accept: 'application/x-ndjson, application/json' } });
      if (!response.ok) return { status: 'unknown', source: source(value.topic) };
      const text = await response.text();
      const events = text.split(/\r?\n/).filter(Boolean).map(line => ntfyEvent.parse(JSON.parse(line)));
      const body = messageBody(value, context);
      const matches = events.filter(event => event.event === 'message' && event.topic === value.topic && event.title === value.title && event.message === body);
      if (matches.length === 0) return { status: 'absent', source: source(value.topic) };
      if (matches.length !== 1) return { status: 'unknown', source: source(value.topic) };
      const event = matches[0]!;
      if (result && result.eventId !== event.id) return { status: 'unknown', source: source(value.topic) };
      return { status: 'confirmed', source: source(value.topic), observation: { eventId: event.id, topic: event.topic, title: event.title ?? '', message: event.message ?? '' } };
    } catch { return { status: 'unknown', source: source(value.topic) }; }
  };

  registry.register({
    name: 'ntfy.publish_status',
    description: 'Publish one approved, non-sensitive operator status to an explicitly allowlisted ntfy topic.',
    effect: 'write', autonomy: 2, environment: 'live', reversible: false,
    blastRadius: 'One notification on one isolated allowlisted ntfy topic.',
    idempotency: 'reconcile-only',
    verificationMethod: 'Poll the exact topic, require one correlation marker match, and reject duplicate or mismatched events.',
    input: ntfyInput, output: ntfyOutput,
    execute: publish,
    verify,
  });
}
