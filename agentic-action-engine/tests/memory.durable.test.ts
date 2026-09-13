import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import type { RunView } from '../src/core/types.js';
import { Runtime } from '../src/core/orchestrator.js';
import { DurableMemoryStore, outcomeFrom } from '../src/memory/durable.js';
import { digest } from '../src/trace/jsonl.js';
import { scenario } from './runtime-support.js';

async function root(t: TestContext) {
  const dir = await mkdtemp(join(tmpdir(), 'fr3k-memory-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

async function complete(runtime: Runtime, runId: string) {
  let view = await runtime.run(runId);
  while (view.status === 'WAITING_FOR_APPROVAL' && view.pending) {
    view = await runtime.approve(runId, view.pending!.digest, 'operator', true);
    view = await runtime.run(runId);
  }
  return view;
}

test('durable outcome memory survives a restarted process and feeds back into later missions', async t => {
  const dir = await root(t);
  const memoryRoot = join(dir, 'memory');
  const durable = await DurableMemoryStore.open(memoryRoot);

  const a = await scenario(t);
  const first = new Runtime(a.store, a.registry, a.planner, a.evaluator, a.memory, {}, durable);
  await first.create({ ...a.mission, id: 'run-a' });
  assert.equal((await complete(first, 'run-a')).status, 'CONFIRMED_SUCCESS');

  const b = await scenario(t);
  const second = new Runtime(b.store, b.registry, b.planner, b.evaluator, b.memory, {}, durable);
  await second.create({ ...b.mission, id: 'run-b' });
  assert.equal((await complete(second, 'run-b')).status, 'CONFIRMED_SUCCESS');

  // A restarted process rebuilds the outcome memory from the journal alone.
  const restarted = await DurableMemoryStore.open(memoryRoot);
  const retrieved = restarted.retrieve('test', 'update target record');
  assert.equal(retrieved.length, 2);
  assert.ok(retrieved.every(entry => entry.source.startsWith('journal://run-')));
  assert.ok(retrieved.every(entry => (entry.outcome as { status: string }).status === 'CONFIRMED_SUCCESS'));
});

test('memory journals are append-only and reject forged or broken chains', async t => {
  const dir = await root(t);
  const memoryRoot = join(dir, 'memory');
  const durable = await DurableMemoryStore.open(memoryRoot);
  const good: Parameters<typeof outcomeFrom>[1] = { id: 'x.outcome', world: 'test', text: 'forensic marker', outcome: { status: 'CONFIRMED_SUCCESS' } };
  await durable.persist(outcomeFrom('journal://x', good));
  await assert.rejects(durable.persist(outcomeFrom('journal://x', { ...good, id: 'x.outcome' })), /append-only/);

  await appendFile(join(memoryRoot, 'memory.jsonl'), '\n{"id":"forged"}');
  await assert.rejects(DurableMemoryStore.open(memoryRoot), Error);

  const tamper = await DurableMemoryStore.open(join(dir, 'memory2'));
  const stamp = { id: 'y.outcome', world: 'test', text: 'y', source: 'journal://y', outcome: { status: 'CONFIRMED_FAILURE' } };
  await tamper.persist(outcomeFrom('journal://y', stamp));
  await appendFile(join(dir, 'memory2', 'memory.jsonl'), `\n${JSON.stringify({ ...stamp, hash: '0'.repeat(64) })}\n`);
  await assert.rejects(DurableMemoryStore.open(join(dir, 'memory2')), /hash mismatch/);
});

test('outcome memory is the seed context for the planner on the next run', async t => {
  const dir = await root(t);
  const memoryRoot = join(dir, 'memory');
  const durable = await DurableMemoryStore.open(memoryRoot);
  const s = await scenario(t);

  const priorOutcome = outcomeFrom('journal://prev', { id: 'prev.outcome', world: s.mission.world, text: 'record was fully refunded', outcome: { status: 'CONFIRMED_FAILURE' } });
  await durable.persist(priorOutcome);

  const runtime = new Runtime(s.store, s.registry, s.planner, s.evaluator, s.memory, {}, durable);
  await runtime.create({ ...s.mission, id: 'run-seeded', world: s.mission.world });
  const view: RunView = await complete(runtime, 'run-seeded');
  assert.equal(view.status, 'CONFIRMED_SUCCESS');
  assert.equal(runtime.durableMemory?.snapshot().length ?? 0, 2);
  const seeds = runtime.durableMemory?.retrieve(s.mission.world, 'record') ?? [];
  assert.ok(seeds.some(entry => entry.source === 'journal://prev'));
});