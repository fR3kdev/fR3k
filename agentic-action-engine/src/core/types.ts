import { z } from 'zod';

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export const json = (value: unknown): Json => z.json().parse(value);
export const identifier = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,95}$/);
export const policySchema = z.strictObject({
  allowedTools: z.array(identifier).min(1),
  maxAutonomy: z.int().min(0).max(4),
  maxWrites: z.int().min(0).max(100),
  sandbox: z.boolean(),
});
export const missionSchema = z.strictObject({
  id: identifier,
  world: identifier,
  goal: z.string().min(1).max(16000),
  context: z.json(),
  policy: policySchema,
  maxSteps: z.int().min(1).max(100).default(20),
  maxReplans: z.int().min(0).max(5).default(1),
});
export type Mission = z.infer<typeof missionSchema>;
export type Policy = Mission['policy'];
export const actionSchema = z.strictObject({
  tool: identifier,
  input: z.json(),
  reason: z.string().min(1).max(8000),
  evidenceRefs: z.array(z.int().positive()),
});
export type Action = z.infer<typeof actionSchema>;
export const decisionSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('action'), action: actionSchema }),
  z.strictObject({ kind: z.literal('finish'), reason: z.string().min(1).max(8000) }),
]);
export type Decision = z.infer<typeof decisionSchema>;
export type EvidenceLabel = 'VERIFIED' | 'SIMULATION_ONLY';
export type RunStatus = 'RUNNING' | 'WAITING_FOR_APPROVAL' | 'UNCERTAIN_SIDE_EFFECT'
  | 'TOOL_UNAVAILABLE' | 'DENIED_BY_POLICY' | 'CONFIRMED_FAILURE' | 'CONFIRMED_SUCCESS';
export const eventKinds = [
  'run.created', 'run.status', 'plan.action', 'plan.finish', 'planner.error',
  'policy.decision', 'approval.requested', 'approval.granted', 'approval.denied',
  'tool.started', 'tool.result', 'tool.error', 'tool.verification', 'step.completed',
  'memory.retrieved', 'evaluation.result', 'replan.requested',
] as const;
export const eventSchema = z.strictObject({
  version: z.literal(1), runId: identifier, seq: z.int().positive(),
  time: z.iso.datetime(), kind: z.enum(eventKinds), data: z.record(z.string(), z.json()),
  previousHash: z.string(), hash: z.string().length(64),
});
export type TraceEvent = z.infer<typeof eventSchema>;
export type EventKind = TraceEvent['kind'];
export interface Observation { seq: number; tool: string; value: Json; label: EvidenceLabel }
export interface MemoryEntry { id: string; world: string; text: string; source: string; outcome: Json }
export interface PlannerContext {
  mission: Mission;
  observations: Observation[];
  memory: MemoryEntry[];
  events: TraceEvent[];
}
export interface Planner {
  id: string;
  decide(context: PlannerContext, signal: AbortSignal): Promise<unknown>;
}
export interface EvaluationCheck { id: string; passed: boolean; detail: string; evidenceRefs: number[] }
export interface Evaluation { passed: boolean; score: number; checks: EvaluationCheck[] }
export interface Evaluator {
  id: string;
  evaluate(context: PlannerContext, signal: AbortSignal): Promise<EvaluationCheck[]>;
}
export interface RunView {
  mission: Mission;
  status: RunStatus;
  events: TraceEvent[];
  observations: Observation[];
  pending?: { step: string; action: Action; digest: string };
  evaluation?: Evaluation;
}
