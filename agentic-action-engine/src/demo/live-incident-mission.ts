import { Runtime } from '../core/orchestrator.js';
import { decisionSchema, type EvaluationCheck, type Mission, type Planner, type PlannerContext } from '../core/types.js';
import { ToolRegistry } from '../tools/registry.js';
import { createBoundedModelPlanner, createFetchModelProvider, type FetchModelEndpoint } from '../model/planner.js';
import { TraceStore } from '../trace/jsonl.js';
import { registerLiveConnectors } from '../connectors/index.js';
import { registerIncidentConnectors } from '../connectors/incident.js';

export interface LiveIncidentOptions {
  root: string;
  runId: string;
  repository: string;
  issueNumber: number;
  videoId: string;
  ntfyTopic: string;
  githubToken: () => Promise<string>;
  fetch?: typeof globalThis.fetch;
  model?: FetchModelEndpoint;
  timeoutMs?: number;
}

const find = (context: PlannerContext, tool: string) => context.observations.find(observation => observation.tool === tool);
const value = (context: PlannerContext, tool: string) => (find(context, tool)?.value ?? {}) as Record<string, unknown>;
const seq = (context: PlannerContext, tool: string) => find(context, tool)?.seq;

export function createLiveIncidentMission(options: LiveIncidentOptions): { runtime: Runtime; mission: Mission } {
  const registry = new ToolRegistry();
  registerLiveConnectors(registry, {
    githubToken: options.githubToken,
    allowedRepositories: [options.repository],
    fetch: options.fetch,
  });
  registerIncidentConnectors(registry, {
    allowedYoutubeVideoIds: [options.videoId],
    allowedNtfyTopics: [options.ntfyTopic],
    fetch: options.fetch,
  });

  const deterministicPlanner: Planner = {
    id: 'live-incident-planner-v1',
    async decide(context) {
      if (!find(context, 'youtube.read_live_state')) {
        return { kind: 'action', action: { tool: 'youtube.read_live_state', input: { videoId: options.videoId }, reason: 'Observe the exact public stream before any incident action', evidenceRefs: [] } };
      }
      if (!find(context, 'github.read_issue')) {
        return { kind: 'action', action: { tool: 'github.read_issue', input: { repository: options.repository, issueNumber: options.issueNumber }, reason: 'Ground the canonical incident contract in GitHub', evidenceRefs: [seq(context, 'youtube.read_live_state')!] } };
      }
      if (value(context, 'youtube.read_live_state').isLiveNow !== true) return { kind: 'finish', reason: 'The configured stream is offline; no writes are appropriate' };
      if (!find(context, 'ntfy.publish_status')) {
        const youtube = value(context, 'youtube.read_live_state');
        const issue = value(context, 'github.read_issue');
        return { kind: 'action', action: {
          tool: 'ntfy.publish_status',
          input: { topic: options.ntfyTopic, title: 'fR3k live incident verified', message: `Stream ${String(youtube.videoId)} live=${String(youtube.isLiveNow)}. GitHub issue #${String(issue.number)} grounded. Operator notification verified by runtime.` },
          reason: 'Notify the operator only after YouTube and GitHub state are grounded',
          evidenceRefs: [seq(context, 'youtube.read_live_state')!, seq(context, 'github.read_issue')!],
        } };
      }
      if (!find(context, 'github.write_evidence')) {
        const youtube = value(context, 'youtube.read_live_state');
        const notice = value(context, 'ntfy.publish_status');
        return { kind: 'action', action: {
          tool: 'github.write_evidence',
          input: {
            repository: options.repository,
            issueNumber: options.issueNumber,
            body: `## Live mission evidence\n\n- YouTube video: \`${String(youtube.videoId)}\`\n- Stream live now: **${String(youtube.isLiveNow)}**\n- Stream title: ${String(youtube.title)}\n- ntfy receipt: \`${String(notice.eventId)}\`\n- Runtime evidence: all writes required exact approval and read-after-write verification.`,
          },
          reason: 'Append verified cross-app receipts to the canonical GitHub incident',
          evidenceRefs: context.observations.map(observation => observation.seq),
        } };
      }
      return { kind: 'finish', reason: 'YouTube, GitHub, and ntfy all produced grounded and verified evidence' };
    },
  };

  const toolOrder = ['youtube.read_live_state', 'github.read_issue', 'ntfy.publish_status', 'github.write_evidence'];
  const selectedPlanner = options.model ? createBoundedModelPlanner({
    provider: createFetchModelProvider({ ...options.model, instructions: 'Workflow: read the YouTube live state, then read the canonical GitHub issue, then publish a concise ntfy status grounded in those observations, then write GitHub evidence including the exact video ID and verified ntfy event ID. Use mission.context for all target identifiers. If the stream is not live, finish without writes. After all four tools have observations, finish. ' + (options.model.instructions ?? '') }),
    tools: registry.list().map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
    toolEffect: name => registry.get(name).effect,
    boundaries: { allowedReadTools: toolOrder.slice(0, 2), allowedWriteTools: toolOrder.slice(2) },
  }) : deterministicPlanner;
  const planner: Planner = {
    id: `${selectedPlanner.id}-incident-scope-v2`,
    drainGenerations: () => selectedPlanner.drainGenerations?.() ?? [],
    async decide(context, signal) {
      const raw = await selectedPlanner.decide(context, signal);
      const decision = decisionSchema.parse(raw);
      if (decision.kind === 'finish') return decision;
      const { tool, input, evidenceRefs } = decision.action;
      const target = input as Record<string, unknown>;
      const next = toolOrder.find(name => !find(context, name));
      if (tool !== next) throw new Error('Mission tool order violated');
      if (tool === 'youtube.read_live_state' && target.videoId !== options.videoId ||
          tool.startsWith('github.') && (target.repository !== options.repository || target.issueNumber !== options.issueNumber) ||
          tool === 'ntfy.publish_status' && target.topic !== options.ntfyTopic) throw new Error('Mission target changed');
      if (registry.get(tool).effect === 'write') {
        const required = context.observations.map(observation => observation.seq);
        if (value(context, 'youtube.read_live_state').isLiveNow !== true || required.some(ref => !evidenceRefs.includes(ref))) throw new Error('Write requires live stream and all preceding evidence');
      }
      if (tool === 'github.write_evidence') {
        const body = String(target.body);
        if (!body.includes(options.videoId) || !body.includes(String(value(context, 'ntfy.publish_status').eventId))) throw new Error('Evidence must include verified video and notification receipt');
      }
      return decision;
    },
  };

  const evaluator = {
    id: 'live-incident-evaluator-v1',
    async evaluate(context: PlannerContext): Promise<EvaluationCheck[]> {
      const youtube = find(context, 'youtube.read_live_state');
      const issue = find(context, 'github.read_issue');
      const ntfy = find(context, 'ntfy.publish_status');
      const githubWrite = find(context, 'github.write_evidence');
      const youtubeValue = (youtube?.value ?? {}) as Record<string, unknown>;
      const issueValue = (issue?.value ?? {}) as Record<string, unknown>;
      const ntfyValue = (ntfy?.value ?? {}) as Record<string, unknown>;
      return [
        { id: 'youtube.exact-live-stream', passed: youtubeValue.videoId === options.videoId && youtubeValue.isLiveNow === true && typeof youtubeValue.title === 'string' && youtubeValue.title.length > 0, detail: 'Exact YouTube video is currently live and has a grounded title', evidenceRefs: youtube ? [youtube.seq] : [] },
        { id: 'github.canonical-issue', passed: issueValue.number === options.issueNumber && issueValue.sourceUrl === `https://github.com/${options.repository}/issues/${options.issueNumber}`, detail: 'Canonical GitHub incident was read from the exact allowlisted repository', evidenceRefs: issue ? [issue.seq] : [] },
        { id: 'ntfy.operator-receipt', passed: typeof ntfyValue.eventId === 'string' && ntfyValue.topic === options.ntfyTopic, detail: 'Operator notification was read back from the exact isolated ntfy topic', evidenceRefs: ntfy ? [ntfy.seq] : [] },
        { id: 'github.evidence-receipt', passed: Boolean(githubWrite), detail: 'GitHub evidence comment was posted and read back exactly', evidenceRefs: githubWrite ? [githubWrite.seq] : [] },
      ];
    },
  };

  const mission: Mission = {
    id: options.runId,
    world: 'hackathon-live-incident',
    goal: 'Verify the live stream, notify the operator, and record exact cross-app evidence without unapproved writes',
    context: { repository: options.repository, issueNumber: options.issueNumber, videoId: options.videoId, ntfyTopic: options.ntfyTopic },
    policy: { allowedTools: ['youtube.read_live_state', 'github.read_issue', 'ntfy.publish_status', 'github.write_evidence'], maxAutonomy: 2, maxWrites: 2, sandbox: false },
    maxSteps: 8,
    maxReplans: 0,
  };
  return { runtime: new Runtime(new TraceStore(options.root), registry, planner, evaluator, undefined, { timeoutMs: options.timeoutMs ?? 60_000 }), mission };
}
