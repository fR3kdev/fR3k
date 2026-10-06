import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import type { RunView } from './core/types.js';
import { openLiveIncident } from './live/incident-host.js';

function render(view: RunView, after: number): number {
  for (const event of view.events.filter(event => event.seq > after)) {
    if (event.kind === 'plan.action') {
      const action = event.data.action as { tool?: string; reason?: string };
      console.log(`PLAN     ${String(action.tool)} :: ${String(action.reason)}`);
    } else if (event.kind === 'tool.started') {
      console.log(`CALL     ${String(event.data.tool)} attempt=${String(event.data.attempt)}`);
    } else if (event.kind === 'tool.result' && event.data.effect === 'read') {
      console.log(`OBSERVE  ${String(event.data.tool)} VERIFIED`);
    } else if (event.kind === 'tool.verification') {
      console.log(`VERIFY   ${String(event.data.tool)} => ${String(event.data.status)}`);
    } else if (event.kind === 'approval.requested') {
      console.log(`GATE     approval required digest=${String(event.data.digest).slice(0, 16)}…`);
    }
  }
  return view.events.length;
}

async function approve(view: RunView): Promise<boolean> {
  if (!view.pending) return false;
  console.log(`ACTION   ${view.pending.action.tool}`);
  console.log(`INPUT    ${JSON.stringify(view.pending.action.input)}`);
  if (process.env.FR3K_APPROVE === '1') return true;
  if (!stdin.isTTY) return false;
  const rl = createInterface({ input: stdin, output: stdout });
  try { return (await rl.question('Approve exact action? [y/N] ')).trim().toLowerCase() === 'y'; }
  finally { rl.close(); }
}

const live = await openLiveIncident();
const { runId, root, actor } = live;
const ntfyTopic = live.target.ntfyTopic;
let view = await live.runtime.inspect(runId);
let rendered = 0;
console.log('MISSION  Live Build Incident Agent');
console.log('APPS     YouTube → GitHub → ntfy → GitHub evidence');
console.log(`RUN      ${runId}`);
console.log(`TRACE    ${join(root, `${runId}.jsonl`)}`);
console.log(`NTFY     ${ntfyTopic}`);

for (let cycle = 0; cycle < 12; cycle++) {
  view = await live.runtime.run(runId);
  rendered = render(view, rendered);
  console.log(`STATE    ${view.status}`);
  if (view.status === 'WAITING_FOR_APPROVAL' && view.pending) {
    const allow = await approve(view);
    view = await live.runtime.approve(runId, view.pending.digest, actor, allow);
    console.log(`APPROVAL ${allow ? 'GRANTED' : 'DENIED'} actor=${actor}`);
    if (!allow) break;
    continue;
  }
  if (['CONFIRMED_SUCCESS', 'CONFIRMED_FAILURE', 'DENIED_BY_POLICY', 'UNCERTAIN_SIDE_EFFECT', 'TOOL_UNAVAILABLE'].includes(view.status)) break;
}

view = await live.runtime.inspect(runId);
render(view, rendered);
console.log(`RESULT   ${view.status}`);
if (view.evaluation) {
  console.log(`EVAL     ${view.evaluation.score.toFixed(2)} ${view.evaluation.checks.map(check => `${check.id}=${check.passed ? 'pass' : 'fail'}`).join(' ')}`);
}
if (view.status !== 'CONFIRMED_SUCCESS') process.exitCode = 1;
