import { z } from 'zod';
import type { MemoryEntry, Mission, Observation } from '../core/types.js';

/** A JSON-safe, bounded summary of planner context that a model provider may consume. */
export interface BoundedPlannerPrompt {
  version: 1;
  mission: {
    id: string; goal: string; world: string;
    allowedTools: string[]; maxAutonomy: number; maxWrites: number;
  };
  observations: Array<{ seq: number; tool: string; value: unknown }>;
  memory: Array<Pick<MemoryEntry, 'world' | 'text' | 'source' | 'outcome'>>;
  eventsTail: Array<{ kind: string; step?: string }>;
}

export interface ModelPlannerProvider {
  id: string;
  /** Must return a value that `decisionSchema` accepts, or throw. */
  generate(prompt: BoundedPlannerPrompt, signal: AbortSignal): Promise<unknown>;
}

export const boundedModelSchema = z.strictObject({
  version: z.literal(1),
  mission: z.strictObject({
    id: z.string().min(1), goal: z.string().min(1), world: z.string().min(1),
    allowedTools: z.array(z.string()).min(1), maxAutonomy: z.number().int().nonnegative(), maxWrites: z.number().int().nonnegative(),
  }),
  observations: z.array(z.strictObject({ seq: z.number().int(), tool: z.string(), value: z.json() })).max(200),
  memory: z.array(z.strictObject({ world: z.string(), text: z.string(), source: z.string(), outcome: z.json() })).max(100),
  eventsTail: z.array(z.strictObject({ kind: z.string(), step: z.string().optional() })).max(100),
});

export interface ModelPlannerBoundaries {
  allowedReadTools: string[];
  allowedWriteTools: string[];
  maxEvidenceRefs: number;
  minObservationsBeforeFinish: number;
  maxReasonChars: number;
  eventsTail: number;
  maxObservations: number;
  maxMemory: number;
}

export const defaultBoundaries: ModelPlannerBoundaries = {
  allowedReadTools: [], allowedWriteTools: [], maxEvidenceRefs: 10,
  minObservationsBeforeFinish: 1, maxReasonChars: 8000, eventsTail: 100,
  maxObservations: 200, maxMemory: 100,
};

export type PlannerBoundaryCode =
  | 'BOUNDED_MISSION_DRIFT'
  | 'PROVIDER_INVALID_OUTPUT'
  | 'TOOL_NOT_ALLOWED'
  | 'EVIDENCE_REF_DOES_NOT_EXIST'
  | 'EVIDENCE_REFS_OVER_BUDGET'
  | 'WRITE_WITHOUT_EVIDENCE'
  | 'FINISHED_WITHOUT_EVIDENCE'
  | 'PROVIDER_HANG';

export class PlannerBoundaryError extends Error {
  constructor(readonly code: PlannerBoundaryCode, detail: string) { super(`${code}: ${detail}`); this.name = 'PlannerBoundaryError'; }
}

/** Build a bounded prompt from live context, trimming only the trusted fields we pass along. */
export function boundPrompt(
  mission: Mission,
  observations: Observation[],
  memory: MemoryEntry[],
  events: { kind: string; data: { step?: string } }[],
  boundaries: ModelPlannerBoundaries,
): BoundedPlannerPrompt {
  const obs = observations.slice(-boundaries.maxObservations)
    .map(item => ({ seq: item.seq, tool: item.tool, value: item.value }));
  const mem = memory.slice(-boundaries.maxMemory)
    .map(item => ({ world: item.world, text: item.text, source: item.source, outcome: item.outcome }));
  const tail = events.slice(-boundaries.eventsTail)
    .map(event => ({ kind: event.kind, step: event.data.step }));
  return boundedModelSchema.parse({
    version: 1,
    mission: {
      id: mission.id, goal: mission.goal, world: mission.world,
      allowedTools: mission.policy.allowedTools, maxAutonomy: mission.policy.maxAutonomy, maxWrites: mission.policy.maxWrites,
    },
    observations: obs, memory: mem, eventsTail: tail,
  });
}

/** Guard a provider output against trust and budget drift before it can reach the runtime. */
export function guardProviderDecision(
  decision: { kind: 'action'; action: { tool: string; input: unknown; reason: string; evidenceRefs: number[] } } | { kind: 'finish'; reason: string },
  prompt: BoundedPlannerPrompt,
  boundaries: ModelPlannerBoundaries,
  toolEffect: (tool: string) => 'read' | 'write',
): void {
  if (decision.kind === 'action') {
    const action = decision.action;
    const effect = toolEffect(action.tool);
    const allowed = effect === 'write' ? boundaries.allowedWriteTools : boundaries.allowedReadTools;
    if (!allowed.includes(action.tool)) throw new PlannerBoundaryError('TOOL_NOT_ALLOWED', `${action.tool} is not an allowed ${effect} tool`);
    if (action.evidenceRefs.length > boundaries.maxEvidenceRefs) {
      throw new PlannerBoundaryError('EVIDENCE_REFS_OVER_BUDGET', `${action.evidenceRefs.length} refs exceeds the budget of ${boundaries.maxEvidenceRefs}`);
    }
    const refs = new Set(prompt.observations.map(item => item.seq));
    if (action.evidenceRefs.some(ref => !refs.has(ref))) {
      throw new PlannerBoundaryError('EVIDENCE_REF_DOES_NOT_EXIST', 'action cites an observation that does not exist');
    }
    if (effect === 'write' && action.evidenceRefs.length === 0) {
      throw new PlannerBoundaryError('WRITE_WITHOUT_EVIDENCE', 'write actions must cite observed evidence');
    }
    return;
  }
  if (prompt.observations.length < boundaries.minObservationsBeforeFinish) {
    throw new PlannerBoundaryError('FINISHED_WITHOUT_EVIDENCE', `only ${prompt.observations.length} observations observed`);
  }
  if (decision.reason.length > boundaries.maxReasonChars) {
    throw new PlannerBoundaryError('PROVIDER_INVALID_OUTPUT', 'reason exceeds the character budget');
  }
}