import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { z } from 'zod';
import { Runtime } from '../src/core/orchestrator.js';
import { ToolRegistry } from '../src/tools/registry.js';
import { TraceStore, RunBusyError, TraceIntegrityError } from '../src/trace/jsonl.js';
import { createArgaMission, reconstructArgaState } from '../src/demo/arga-mission.js';
import { createReplayRunner, createLegacyArgaPlanner, createLegacyArgaEvaluator } from '../src/demo/replay-bridge.js';
import { scenario } from './runtime-support.js';

async function root(t: TestContext) {
  const dir = await mkdtemp(join(tmpdir(), 'fr3k-reliability-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

test('stale lock held by a dead PID is recovered; a live owner stays busy', async t => {
  const dir = await root(t);
  const store = new TraceStore(dir);
  await mkdir(dir, { recursive: true });
  const dead = join(dir, 'run.lock');
  await writeFile(dead, JSON.stringify({ pid: 2147483647, createdAt: new Date().toISOString() }));
  await store.withRun('run', async journal => {
    await journal.append('run.created', { note: 'recovered after crash' });
  });
  await store.withRun('run', async journal => {
    await journal.append('run.created', { note: 'second honest append after recovery' });
  });
  assert.equal((await store.read('run')).length, 2);
  const busy = join(dir, 'busy.lock');
  await writeFile(busy, JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }));
  await assert.rejects(store.withRun('busy', async () => undefined), RunBusyError);
});

async function twoEventJournal(t: TestContext): Promise<{ store: TraceStore; file: string; events: number }> {
  const dir = await root(t);
  const store = new TraceStore(dir);
  let count = 0;
  await store.withRun('run', async journal => {
    await journal.append('run.created', { note: 'one' });
    await journal.append('run.created', { note: 'two' });
    count = journal.events.length;
  });
  return { store, file: store.path('run'), events: count };
}

test('repairTail snapshots and truncates only the uncommitted tail', async t => {
  const { store, file } = await twoEventJournal(t);
  const original = await readFile(file, 'utf8');
  await writeFile(file, '{"torn":', { flag: 'a' });
  await assert.rejects(store.read('run'), /Incomplete journal tail/);
  const report = await store.repairTail('run');
  assert.equal(report.repaired, true);
  assert.match(report.reason, /Incomplete tail/);
  assert.equal(report.parsedEvents, 2);
  assert.ok(report.removedBytes > 0);
  assert.ok(report.preservedPath);
  const preserved = await readFile(report.preservedPath!, 'utf8');
  assert.equal(preserved, `${original}{"torn":`);
  assert.equal((await store.read('run')).length, 2);
});

test('repairTail is a no-op on a complete journal and refuses corrupted committed bytes', async t => {
  const { store, file } = await twoEventJournal(t);
  assert.equal((await store.repairTail('run')).repaired, false);
  await writeFile(file, 'this is not a journal event\n');
  await assert.rejects(store.repairTail('run'), TraceIntegrityError);
  assert.equal((await readFile(file, 'utf8')), 'this is not a journal event\n');
});

test('a denial is authoritative even when the process died before the status append', async t => {
  const s = await scenario(t);
  await s.runtime.create(s.mission);
  const paused = await s.runtime.run(s.mission.id);
  await s.runtime.approve(s.mission.id, paused.pending!.digest, 'operator', false);
  const raw = await readFile(s.store.path(s.mission.id), 'utf8');
  const lines = raw.split('\n').filter(Boolean);
  assert.equal(JSON.parse(lines.at(-1)!).kind, 'run.status');
  await writeFile(s.store.path(s.mission.id), `${lines.slice(0, -1).join('\n')}\n`);
  const view = await s.runtime.inspect(s.mission.id);
  assert.equal(view.status, 'DENIED_BY_POLICY');
  const resumed = await s.runtime.run(s.mission.id);
  assert.equal(resumed.status, 'DENIED_BY_POLICY');
  assert.equal(s.state.writes, 0);
});

test('a hung planner is cut off by the deadline and the run fails cleanly', async t => {
  const hangingPlanner = { id: 'hang-planner-v1', async decide() { return new Promise<never>(() => undefined); } };
  const s = await scenario(t, { planner: hangingPlanner, runtimeOptions: { timeoutMs: 80 } });
  await s.runtime.create(s.mission);
  const view = await s.runtime.run(s.mission.id);
  assert.equal(view.status, 'CONFIRMED_FAILURE');
  assert.ok(view.events.some(event => event.kind === 'planner.error' && event.data.code === 'INVALID_OR_UNAVAILABLE_PLANNER'));
  assert.equal(s.state.writes, 0);
});

test('a hung read exhausts the budget; the audited recover() grant resumes it without repeating a write', async t => {
  let hanging = true;
  const s = await scenario(t, {
    runtimeOptions: { timeoutMs: 60 },
    overrideRead: def => ({
      ...def,
      async execute() { if (hanging) return new Promise(() => undefined); return { id: 'target', value: 'pending', source: 'fixture://records/target' }; },
    }),
  });
  await s.runtime.create(s.mission);
  const unavailable = await s.runtime.run(s.mission.id);
  assert.equal(unavailable.status, 'TOOL_UNAVAILABLE');
  assert.ok(unavailable.events.filter(event => event.kind === 'tool.error').length >= 3);
  await assert.rejects(s.runtime.recover('unknown-run'), /identifier|does not/);
  hanging = false;
  const view = await s.runtime.recover(s.mission.id);
  assert.ok(view.events.some(event => event.kind === 'runtime.recovery'));
  assert.ok(view.events.some(event => event.kind === 'tool.result' && event.data.effect === 'read'));
  assert.equal(s.state.writes, 0);
});

test('a changed tool revision invalidates an already-granted approval and the write never runs', async t => {
  const s = await scenario(t);
  await s.runtime.create(s.mission);
  const paused = await s.runtime.run(s.mission.id);
  await s.runtime.approve(s.mission.id, paused.pending!.digest, 'operator', true);
  // A deploy swaps the adapter implementation while an older run waits on approval.
  const deployed = new ToolRegistry();
  deployed.register({
    name: 'records.write', description: 'Update exactly one synthetic record', effect: 'write', autonomy: 2,
    environment: 'sandbox', reversible: true, blastRadius: 'One synthetic record',
    idempotency: 'provider-key', verificationMethod: 'Read exact record and idempotency marker',
    input: z.strictObject({ id: z.string(), value: z.string() }), output: z.strictObject({ accepted: z.boolean() }),
    async execute(input) { return { accepted: Boolean(await Promise.resolve(input.value)) }; },
    async verify() { return { status: 'confirmed', source: 'fixture://records/target', observation: { accepted: true } }; },
  });
  deployed.register({
    name: 'records.read', description: 'Read a synthetic record', effect: 'read', autonomy: 0,
    environment: 'sandbox', reversible: true, blastRadius: 'None', idempotency: 'read-only', verificationMethod: 'Direct record read',
    input: z.strictObject({ id: z.string() }), output: z.strictObject({ id: z.string(), value: z.string(), source: z.string() }),
    async execute(input) { return { id: input.id, value: 'pending', source: 'fixture://records/target' }; },
  });
  const resumed = new Runtime(s.store, deployed, s.planner, s.evaluator);
  const view = await resumed.run(s.mission.id);
  assert.equal(view.status, 'DENIED_BY_POLICY');
  assert.match(view.events.at(-1)!.data.reason as string, /changed after planning/);
  assert.equal(s.state.writes, 0);
});

test('reconstructArgaState rebuilds a crashed journal and replay does not mint a second refund', async t => {
  const dir = await root(t);
  const demo = createArgaMission(join(dir, 'live'), 'main-run');
  let view = await demo.runtime.create(demo.mission);
  view = await demo.runtime.run('main-run');
  let guard = 0;
  while (view.status === 'WAITING_FOR_APPROVAL' && guard++ < 20) {
    view = await demo.runtime.approve('main-run', view.pending!.digest, 'operator', true);
    view = await demo.runtime.run('main-run');
  }
  assert.equal(view.status, 'CONFIRMED_SUCCESS');
  const live = demo.runtime;
  const store = new TraceStore(join(dir, 'live'));
  const events = await store.read('main-run');
  const rebuilt = reconstructArgaState(events);
  assert.equal(rebuilt.refunds.size, 1);
  assert.equal(rebuilt.incident.status, 'resolved');
  assert.equal(rebuilt.charges.get('CHG-89')?.refunded, false);
  const originalRefundId = [...rebuilt.refunds.values()][0]!.refundId;
  const replay = createReplayRunner(join(dir, 'live'));
  const comparison = await replay.replay('main-run');
  assert.equal(comparison.reconstructed.refunds.length, 1);
  assert.equal(comparison.reconstructed.refunds[0]!.refundId, originalRefundId);
  assert.equal(comparison.candidate.status, 'CONFIRMED_SUCCESS');
  assert.equal(comparison.candidate.score, 1);
  assert.deepEqual(comparison.diffs.filter(diff => diff.matched), comparison.diffs);
});

test('counterfactual replay against the same rebuilt state exposes what the v1 design never evaluated', async t => {
  const dir = await root(t);
  const demo = createArgaMission(join(dir, 'live'), 'baseline-run');
  let view = await demo.runtime.create(demo.mission);
  view = await demo.runtime.run('baseline-run');
  let guard = 0;
  while (view.status === 'WAITING_FOR_APPROVAL' && guard++ < 20) {
    view = await demo.runtime.approve('baseline-run', view.pending!.digest, 'operator', true);
    view = await demo.runtime.run('baseline-run');
  }
  assert.equal(view.status, 'CONFIRMED_SUCCESS');
  const replay = createReplayRunner(join(dir, 'live'));
  const comparison = await replay.counterfactual('baseline-run',
    { planner: createLegacyArgaPlanner(demo.state), evaluator: createLegacyArgaEvaluator() }, 'v1-cf');
  assert.equal(comparison.baseline.score, 1);
  const v2Only = new Set(['support.incident-grounded', 'billing.duplicate-proven', 'billing.unrelated-preserved']);
  for (const id of v2Only) {
    const diff = comparison.diffs.find(item => item.id === id)!;
    assert.equal(diff.baseline, true);
    assert.equal(diff.candidate, null);
  }
  assert.equal(comparison.reconstructed.refunds.length, 1);
  assert.equal(comparison.reconstructed.refunds[0]!.chargeId, 'CHG-88');
});