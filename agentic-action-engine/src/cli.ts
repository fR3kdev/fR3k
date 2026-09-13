import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createArgaMission } from './demo/arga-mission.js';

const root = await mkdtemp(join(tmpdir(), 'fr3k-arga-demo-'));
try {
  const demo = createArgaMission(root);
  let view = await demo.runtime.create(demo.mission);
  console.log('MISSION  Arga Labs duplicate-charge incident');
  console.log('APPS     Support Desk → Billing → CRM (sandbox)');
  console.log('EVIDENCE SIMULATION_ONLY — no external records are changed');
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
  if (view.status !== 'CONFIRMED_SUCCESS') process.exitCode = 1;
} finally {
  await rm(root, { recursive: true, force: true });
}
