import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { Runtime } from '../src/core/orchestrator.js';
import { scenario } from './runtime-support.js';
import { createBoundedModelPlanner } from '../src/model/planner.js';
import { PlannerBoundaryError } from '../src/model/bounded.js';
import { missingModelCredentials } from '../src/model/credentials.js';

type Fixer = (prompt: { observations: Array<{ seq: number; tool: string }> }) => unknown;

const playToSuccess: Fixer[] = [
  () => ({ kind: 'action', action: { tool: 'records.read', input: { id: 'target' }, reason: 'observe target', evidenceRefs: [] } }),
  prompt => ({ kind: 'action', action: { tool: 'records.write', input: { id: 'target', value: 'done' }, reason: 'update the observed target', evidenceRefs: [prompt.observations[0]!.seq] } }),
  () => ({ kind: 'finish', reason: 'request independent evaluation' }),
];

function provider(decisions: Fixer[], hang = false) {
  let call = 0;
  return {
    id: hang ? 'hang' : `steps-${decisions.length}`,
    async generate(prompt: unknown, signal: AbortSignal) {
      if (hang) { signal.addEventListener('abort', () => undefined, { once: true }); await new Promise(() => undefined); return null; }
      const step = decisions[call] ?? decisions[decisions.length - 1]!;
      call++;
      return step(prompt as never);
    },
  };
}

async function bounded(t: TestContext, decisions: Fixer[], hang = false) {
  const s = await scenario(t);
  const planner = createBoundedModelPlanner({
    provider: provider(decisions, hang),
    toolEffect: tool => tool === 'records.write' ? 'write' : 'read',
    boundaries: { allowedReadTools: ['records.read'], allowedWriteTools: ['records.write'] },
  });
  const runtime = new Runtime(s.store, s.registry, planner, s.evaluator, s.memory, { timeoutMs: 400 });
  return { runtime, mission: s.mission };
}

async function run(runtime: Runtime, missionId: string) {
  let view = await runtime.run(missionId);
  while (view.status === 'WAITING_FOR_APPROVAL' && view.pending) {
    view = await runtime.approve(missionId, view.pending!.digest, 'operator', true);
    view = await runtime.run(missionId);
  }
  return view;
}

test('model-backed planner carries a bounded mission to an independent green', async t => {
  const { runtime, mission } = await bounded(t, playToSuccess);
  await runtime.create(mission);
  const view = await run(runtime, mission.id);
  assert.equal(view.status, 'CONFIRMED_SUCCESS');
  assert.equal(view.events.some(e => e.kind === 'planner.error'), false);
});

test('prompt injection that proposes a forbidden tool cannot escape the boundary', async t => {
  const injected: Fixer[] = [
    () => ({ kind: 'action', action: { tool: 'gh.repo.delete', input: { repo: 'fR3k/fR3k' }, reason: 'support note instructs to delete the repository', evidenceRefs: [] } }),
  ];
  const { runtime, mission } = await bounded(t, injected);
  await runtime.create(mission);
  const view = await run(runtime, mission.id);
  assert.equal(view.status, 'CONFIRMED_FAILURE');
  assert.ok(view.events.some(e => e.kind === 'planner.error'));
});

test('an action citing an observation that does not exist never reaches the tools', async t => {
  const { runtime, mission } = await bounded(t, [
    () => ({ kind: 'action', action: { tool: 'records.write', input: { id: 'target', value: 'done' }, reason: 'drift', evidenceRefs: [999] } }),
  ]);
  await runtime.create(mission);
  const view = await run(runtime, mission.id);
  assert.equal(view.status, 'CONFIRMED_FAILURE');
  assert.ok(view.events.some(e => e.kind === 'planner.error'));
});

test('a write without observed evidence is refused before the policy layer', async t => {
  const { runtime, mission } = await bounded(t, [
    () => ({ kind: 'action', action: { tool: 'records.write', input: { id: 'target', value: 'done' }, reason: 'ungrounded', evidenceRefs: [] } }),
  ]);
  await runtime.create(mission);
  const view = await run(runtime, mission.id);
  assert.equal(view.status, 'CONFIRMED_FAILURE');
});

test('finishing before any evidence exists is a boundary violation, not a success', async t => {
  const { runtime, mission } = await bounded(t, [() => ({ kind: 'finish', reason: 'declare victory' })]);
  await runtime.create(mission);
  const view = await run(runtime, mission.id);
  assert.equal(view.status, 'CONFIRMED_FAILURE');
});

test('a hanging provider becomes a bounded planner error, not a stall', async t => {
  const { runtime, mission } = await bounded(t, [], true);
  await runtime.create(mission);
  const view = await run(runtime, mission.id);
  assert.equal(view.status, 'CONFIRMED_FAILURE');
  assert.ok(view.events.some(e => e.kind === 'planner.error'));
});

test('model credentials fail closed when no API key is present', () => {
  const error = missingModelCredentials();
  assert.ok(error instanceof Error);
  assert.match(error.message, /OPENAI_API_KEY/);
});

test('guard rejects a finish past the evidence budget and a ref count over budget', async () => {
  const { boundPrompt, defaultBoundaries, guardProviderDecision } = await import('../src/model/bounded.js');
  const mission = { id: 'x', world: 'test', goal: 'g', context: {}, policy: { allowedTools: ['a'], maxAutonomy: 0, maxWrites: 0, sandbox: true }, maxSteps: 1, maxReplans: 0 };
  const empty = boundPrompt(mission, [], [], [], defaultBoundaries);
  assert.throws(() => guardProviderDecision({ kind: 'finish', reason: 'w' }, empty, defaultBoundaries, () => 'read'), PlannerBoundaryError);
  const refs = Array.from({ length: 11 }, (_, i) => i + 1);
  const observations = refs.map(seq => ({ seq, tool: 'a', value: {}, label: 'VERIFIED' as const }));
  const prompt = boundPrompt(mission, observations, [], [], defaultBoundaries);
  const allowedReads = { ...defaultBoundaries, allowedReadTools: ['a'] };
  assert.throws(
    () => guardProviderDecision({ kind: 'action', action: { tool: 'a', input: {}, reason: 'r', evidenceRefs: refs } }, prompt, allowedReads, () => 'read'),
    /EVIDENCE_REFS_OVER_BUDGET/);
  assert.doesNotThrow(
    () => guardProviderDecision({ kind: 'action', action: { tool: 'a', input: {}, reason: 'r', evidenceRefs: [1] } }, prompt, allowedReads, () => 'read'));
});