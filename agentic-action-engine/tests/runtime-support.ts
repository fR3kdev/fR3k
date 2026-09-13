import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { z } from 'zod';
import { Runtime, type RuntimeOptions } from '../src/core/orchestrator.js';
import type { Evaluator, Mission, Planner, PlannerContext } from '../src/core/types.js';
import { ToolFault, ToolRegistry, type ToolDefinition, type ToolMetadata } from '../src/tools/registry.js';
import { TraceStore } from '../src/trace/jsonl.js';
import { MemoryStore } from '../src/memory/store.js';

export interface ScenarioOptions {
  autonomy?: ToolMetadata['autonomy'];
  environment?: ToolMetadata['environment'];
  idempotency?: ToolMetadata['idempotency'];
  readFailures?: number;
  writeFailure?: 'before' | 'after' | 'rejected' | 'wrong-record' | 'invalid-output';
  unknownVerification?: boolean;
  planner?: Planner;
  evaluator?: Evaluator;
  runtimeOptions?: RuntimeOptions;
  /** Swap the fixture read tool before registration (e.g. to simulate a hang or a deploy). */
  overrideRead?: (def: ToolDefinition<{ id: string }, { id: string; value: string; source: string }>) => ToolDefinition<{ id: string }, { id: string; value: string; source: string }>;
  /** Swap the fixture write tool before registration (e.g. to pin a contract variant). */
  overrideWrite?: (def: ToolDefinition<{ id: string; value: string }, { accepted: boolean }>) => ToolDefinition<{ id: string; value: string }, { accepted: boolean }>;
}

export async function scenario(t: TestContext, options: ScenarioOptions = {}) {
  const root = await mkdtemp(join(tmpdir(), 'fr3k-runtime-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const state = { records: new Map([['target', 'pending'], ['other', 'pending']]), reads: 0, writes: 0,
    attempts: 0, keys: [] as string[], unknownVerification: options.unknownVerification ?? false };
  const applied = new Set<string>();
  const registry = new ToolRegistry();
  const readDefinition: ToolDefinition<{ id: string }, { id: string; value: string; source: string }> = {
    name: 'records.read', description: 'Read a synthetic record', effect: 'read', autonomy: 0,
    environment: 'sandbox', reversible: true, blastRadius: 'None', idempotency: 'read-only', verificationMethod: 'Direct record read',
    input: z.strictObject({ id: z.string() }), output: z.strictObject({ id: z.string(), value: z.string(), source: z.string() }),
    async execute(input) {
      state.reads++;
      if (state.reads <= (options.readFailures ?? 0)) throw new ToolFault('TRANSIENT');
      return { id: input.id, value: state.records.get(input.id) ?? 'missing', source: `fixture://records/${input.id}` };
    },
  };
  const writeDefinition: ToolDefinition<{ id: string; value: string }, { accepted: boolean }> = {
    name: 'records.write', description: 'Update exactly one synthetic record', effect: 'write', autonomy: options.autonomy ?? 2,
    environment: options.environment ?? 'sandbox', reversible: true, blastRadius: 'One synthetic record',
    idempotency: options.idempotency ?? 'provider-key', verificationMethod: 'Read exact record and idempotency marker',
    input: z.strictObject({ id: z.string(), value: z.string() }), output: z.strictObject({ accepted: z.boolean() }),
    async execute(input, context) {
      state.attempts++;
      state.keys.push(context.idempotencyKey);
      if (options.writeFailure === 'rejected') throw new ToolFault('REJECTED');
      if (options.writeFailure === 'before' && state.attempts === 1) throw new ToolFault('TRANSIENT');
      if (!applied.has(context.idempotencyKey)) {
        state.records.set(options.writeFailure === 'wrong-record' ? 'other' : input.id, input.value);
        applied.add(context.idempotencyKey);
        state.writes++;
      }
      if (options.writeFailure === 'after') throw new ToolFault('UNCERTAIN');
      if (options.writeFailure === 'invalid-output') return { accepted: 'invalid' } as unknown as { accepted: boolean };
      return { accepted: true };
    },
    async verify(input, context) {
      const source = `fixture://records/${input.id}`;
      if (state.unknownVerification) return { status: 'unknown', source };
      if (state.records.get(input.id) === input.value && applied.has(context.idempotencyKey)) {
        return { status: 'confirmed', source, observation: { id: input.id, value: input.value } };
      }
      return { status: 'absent', source };
    },
  };
  registry.register(options.overrideRead ? options.overrideRead(readDefinition) : readDefinition);
  registry.register(options.overrideWrite ? options.overrideWrite(writeDefinition) : writeDefinition);
  const planner: Planner = options.planner ?? {
    id: 'fixture-planner-v1',
    async decide(context) {
      if (!context.observations.some(item => item.tool === 'records.read')) {
        return { kind: 'action', action: { tool: 'records.read', input: { id: 'target' }, reason: 'Observe target record', evidenceRefs: [] } };
      }
      if (!context.observations.some(item => item.tool === 'records.write')) {
        return { kind: 'action', action: { tool: 'records.write', input: { id: 'target', value: 'done' },
          reason: 'Update the observed target', evidenceRefs: [context.observations[0]!.seq] } };
      }
      return { kind: 'finish', reason: 'Request independent evaluation' };
    },
  };
  const evaluator: Evaluator = options.evaluator ?? {
    id: 'fixture-evaluator-v1',
    async evaluate(context) {
      const refs = context.observations.map(item => item.seq);
      return [
        { id: 'target.updated', passed: state.records.get('target') === 'done', detail: 'Target record has expected final state', evidenceRefs: refs },
        { id: 'other.unchanged', passed: state.records.get('other') === 'pending', detail: 'Unrelated record was not touched', evidenceRefs: refs },
        { id: 'writes.once', passed: state.writes === 1, detail: 'One external mutation', evidenceRefs: refs },
      ];
    },
  };
  const store = new TraceStore(root);
  const memory = new MemoryStore([{ id: 'prior-1', world: 'test', text: 'Update target record',
    source: 'fixture://history/1', outcome: { verified: true } }]);
  const runtime = new Runtime(store, registry, planner, evaluator, memory, options.runtimeOptions);
  const mission: Mission = { id: 'run-test', world: 'test', goal: 'Update target record without touching other records', context: {},
    policy: { allowedTools: ['records.read', 'records.write'], maxAutonomy: 2, maxWrites: 1, sandbox: true }, maxSteps: 10, maxReplans: 0 };
  return { runtime, registry, store, memory, planner, evaluator, state, mission, root };
}

export function finalChecks(context: PlannerContext, passed: boolean) {
  return [{ id: 'goal', passed, detail: 'Independent fixture verdict', evidenceRefs: context.observations.map(o => o.seq) }];
}
