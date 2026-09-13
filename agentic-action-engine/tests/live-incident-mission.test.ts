import assert from 'node:assert/strict';
import test from 'node:test';
import { fakeFetch, fixture } from './incident-support.js';

test('live incident mission requires two exact approvals and confirms all three external apps', async t => {
  const demo = await fixture(t, 'live-happy', fakeFetch());
  let view = await demo.runtime.create(demo.mission);
  view = await demo.runtime.run(demo.mission.id);
  assert.equal(view.status, 'WAITING_FOR_APPROVAL');
  assert.equal(view.pending?.action.tool, 'ntfy.publish_status');
  assert.deepEqual(view.observations.map(o => o.tool), ['youtube.read_live_state', 'github.read_issue']);

  view = await demo.runtime.approve(demo.mission.id, view.pending!.digest, 'test-operator', true);
  view = await demo.runtime.run(demo.mission.id);
  assert.equal(view.status, 'WAITING_FOR_APPROVAL');
  assert.equal(view.pending?.action.tool, 'github.write_evidence');
  assert.ok(view.observations.some(o => o.tool === 'ntfy.publish_status'));

  view = await demo.runtime.approve(demo.mission.id, view.pending!.digest, 'test-operator', true);
  view = await demo.runtime.run(demo.mission.id);
  assert.equal(view.status, 'CONFIRMED_SUCCESS');
  assert.equal(view.evaluation?.passed, true);
  assert.equal(view.evaluation?.score, 1);
  assert.deepEqual(view.observations.map(o => o.label), ['VERIFIED', 'VERIFIED', 'VERIFIED', 'VERIFIED']);
  assert.equal(view.events.filter(e => e.kind === 'approval.granted').length, 2);
});

test('wrong GitHub issue identity fails before any external write', async t => {
  const demo = await fixture(t, 'live-wrong-issue', fakeFetch({ wrongIssue: true }));
  await demo.runtime.create(demo.mission);
  const view = await demo.runtime.run(demo.mission.id);
  assert.equal(view.status, 'TOOL_UNAVAILABLE');
  assert.equal(view.events.some(e => e.kind === 'tool.started' && e.data.effect === 'write'), false);
});

test('policy can prohibit live writes even after YouTube and GitHub are grounded', async t => {
  const demo = await fixture(t, 'live-policy-denial', fakeFetch());
  const mission = { ...demo.mission, policy: { ...demo.mission.policy, maxWrites: 0 } };
  await demo.runtime.create(mission);
  const view = await demo.runtime.run(mission.id);
  assert.equal(view.status, 'DENIED_BY_POLICY');
  assert.equal(view.events.some(e => e.kind === 'approval.granted'), false);
  assert.equal(view.events.some(e => e.kind === 'tool.started' && e.data.effect === 'write'), false);
});
