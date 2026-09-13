import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createArgaMission } from '../src/demo/arga-mission.js';
import { createRuntimeDashboardBridge } from '../src/demo/dashboard-bridge.js';

test('dashboard bridge runs actual Arga approvals independently and compares recorded evidence', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fr3k-bridge-test-'));
  try {
    const baseline = createArgaMission(root, 'baseline');
    const candidate = createArgaMission(root, 'candidate');
    for (const demo of [baseline, candidate]) await demo.runtime.create(demo.mission);
    const bridge = createRuntimeDashboardBridge(new Map([
      ['baseline', baseline.runtime], ['candidate', candidate.runtime],
    ]));
    assert.equal((await bridge.listRuns()).length, 2);
    await assert.rejects(bridge.inspect('missing'));
    await assert.rejects(bridge.inspect('../baseline'));
    let view = await bridge.resume('baseline');
    assert.equal(view.status, 'WAITING_FOR_APPROVAL');
    await assert.rejects(bridge.approve('baseline', 'stale', 'operator', true));
    await bridge.approve('baseline', view.pending!.digest, 'operator', true);
    assert.equal(baseline.state.charges.get('CHG-88')!.refunded, false);
    view = await bridge.resume('baseline');
    assert.equal(view.pending!.action.tool, 'crm.resolve_incident');
    await bridge.approve('baseline', view.pending!.digest, 'operator', true);
    view = await bridge.resume('baseline');
    assert.equal(view.status, 'CONFIRMED_SUCCESS');
    assert.ok(view.observations.every(observation => observation.label === 'SIMULATION_ONLY'));
    const other = await bridge.resume('candidate');
    await bridge.approve('candidate', other.pending!.digest, 'operator', false);
    assert.equal((await bridge.resume('candidate')).status, 'DENIED_BY_POLICY');
    assert.equal(candidate.state.charges.get('CHG-88')!.refunded, false);
    const comparison = await bridge.compare(['baseline', 'candidate']);
    assert.equal(comparison.runs[0]!.score, 1);
    assert.equal(comparison.runs[0]!.toolCalls, 4);
    assert.equal(comparison.runs[0]!.policyViolations, 0);
    assert.equal(comparison.runs[0]!.unverifiedWrites, 0);
    assert.equal(comparison.runs[1]!.score, null);
    assert.equal(comparison.runs[1]!.policyViolations, null);
    assert.ok(comparison.runs.every(run => run.costUsd === null && run.latencyMs === null));
  } finally { await rm(root, { recursive: true, force: true }); }
});
