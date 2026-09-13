import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createArgaMission } from './demo/arga-mission.js';
import { createLegacyArgaEvaluator, createLegacyArgaPlanner, createReplayRunner } from './demo/replay-bridge.js';

const root = await mkdtemp(join(tmpdir(), 'fr3k-arga-demo-'));
try {
  const demo = createArgaMission(root);
  let view = await demo.runtime.create(demo.mission);
  console.log('MISSION  Arga Labs duplicate-charge incident');
  console.log('APPS     Support Desk -> Billing -> CRM (sandbox)');
  console.log('EVIDENCE SIMULATION_ONLY - no external records are changed');
  for (let cycle = 0; cycle < 8 && view.status !== 'CONFIRMED_SUCCESS'; cycle++) {
    view = await demo.runtime.run(demo.mission.id);
    console.log(`STATE    ${view.status} | events=${view.events.length} observations=${view.observations.length}`);
    if (view.status === 'WAITING_FOR_APPROVAL' && view.pending) {
      console.log(`APPROVAL exact action=${view.pending.action.tool} digest=${view.pending.digest}`);
      view = await demo.runtime.approve(demo.mission.id, view.pending.digest, 'demo-operator', true);
      console.log('APPROVAL granted by demo-operator; resume is explicit');
    }
  }
  view = await demo.runtime.inspect(demo.mission.id);
  console.log(`RESULT   ${view.status}`);
  console.log(`EVAL     ${view.evaluation ? `${view.evaluation.score.toFixed(2)} (${view.evaluation.checks.map(c => `${c.id}=${c.passed ? 'pass' : 'fail'}`).join(', ')})` : 'not run'}`);

  // Crash replay: state is rebuilt only from the durable journal and the same
  // planner/evaluator re-run it in isolation.
  const replay = createReplayRunner(root);
  const recovery = await replay.replay(demo.mission.id);
  console.log('REPLAY   rebuilt committed journal after a simulated process crash');
  console.log(`REPLAY   reconstructed writes=${recovery.reconstructed.writes.join(',') || 'none'} refunds=${recovery.reconstructed.refunds.length} incident=${recovery.reconstructed.incidentStatus}`);
  console.log(`REPLAY   candidate=${recovery.candidate.status} score=${recovery.candidate.score?.toFixed(2) ?? 'n/a'}`);
  if (recovery.diffs.filter(diff => !diff.matched).length) {
    console.log(`REPLAY   regressions=${recovery.diffs.filter(diff => !diff.matched).map(diff => diff.id).join(',')}`);
    process.exitCode = 1;
  }

  // Counterfactual: the same rebuilt state re-run with the pre-hardening v1
  // planner/evaluator exposes exactly which proofs the old design never evaluated.
  const counterfactual = await replay.counterfactual(demo.mission.id,
    { planner: createLegacyArgaPlanner(demo.state), evaluator: createLegacyArgaEvaluator() }, 'v1-counterfactual');
  console.log('COUNTER  v1 design against the rebuilt state');
  const dropped = counterfactual.diffs.filter(diff => diff.baseline === true && diff.candidate === null);
  const preserved = counterfactual.diffs.filter(diff => diff.baseline === true && diff.candidate === true);
  console.log(`COUNTER  v1 still certifies: ${preserved.map(diff => diff.id).join(', ') || 'none'}`);
  console.log(`COUNTER  v1 never evaluates: ${dropped.map(diff => diff.id).join(', ') || 'none'}`);
  if (view.status !== 'CONFIRMED_SUCCESS' || recovery.candidate.status !== 'CONFIRMED_SUCCESS') process.exitCode = 1;
} finally {
  await rm(root, { recursive: true, force: true });
}