import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createArgaMission } from '../src/demo/arga-mission.js';

test('Arga mission crosses three sandbox apps with exact approvals and read-back evidence', async t => {
  const root = await mkdtemp(join(tmpdir(), 'fr3k-arga-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const demo = createArgaMission(root, 'arga-test');
  let view = await demo.runtime.create(demo.mission);

  view = await demo.runtime.run('arga-test');
  assert.equal(view.status, 'WAITING_FOR_APPROVAL');
  assert.equal(view.pending?.action.tool, 'billing.refund_charge');
  assert.equal(demo.state.charges.get('CHG-88')?.refunded, false);

  view = await demo.runtime.approve('arga-test', view.pending!.digest, 'test-operator', true);
  view = await demo.runtime.run('arga-test');
  assert.equal(view.status, 'WAITING_FOR_APPROVAL');
  assert.equal(view.pending?.action.tool, 'crm.resolve_incident');
  assert.equal(demo.state.charges.get('CHG-88')?.refunded, true);
  assert.equal(demo.state.charges.get('CHG-89')?.refunded, false);

  view = await demo.runtime.approve('arga-test', view.pending!.digest, 'test-operator', true);
  view = await demo.runtime.run('arga-test');
  assert.equal(view.status, 'CONFIRMED_SUCCESS');
  assert.equal(view.evaluation?.passed, true);
  assert.deepEqual(view.evaluation?.checks.map(check => check.passed), [true, true, true, true, true, true, true]);
  assert.ok(view.events.some(event => event.kind === 'approval.granted'));
  assert.equal(new Set(view.events.filter(event => event.kind === 'tool.result').map(event => event.data.label)).size, 1);
  assert.equal(view.events.find(event => event.kind === 'tool.result')?.data.label, 'SIMULATION_ONLY');
});
