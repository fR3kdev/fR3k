import { actionSchema, missionSchema, type Evaluation, type Observation, type RunStatus, type RunView, type TraceEvent } from './types.js';

export const terminal = new Set<RunStatus>(['CONFIRMED_SUCCESS', 'CONFIRMED_FAILURE', 'DENIED_BY_POLICY']);

/** State is projected from the durable journal; no independently stale checkpoint file. */
export function project(events: TraceEvent[]): RunView {
  if (events[0]?.kind !== 'run.created') throw new Error('Run does not exist');
  const mission = missionSchema.parse(events[0].data.mission);
  let status = (events.filter(event => event.kind === 'run.status').at(-1)?.data.status ?? 'RUNNING') as RunStatus;
  const completed = new Set(events.filter(event => event.kind === 'step.completed').map(event => event.data.step));
  const pending = events.filter(event => event.kind === 'plan.action' && !completed.has(event.data.step)).at(-1);
  // Denial is authoritative even if the process died between the approval.denied
  // and the run.status appends. A denied pending action can never become
  // executable by resuming, and the status event alone does not overrule it.
  const denied = events.filter(event => event.kind === 'approval.denied').at(-1);
  if (denied && pending && denied.data.step === pending.data.step) status = 'DENIED_BY_POLICY';
  const observations: Observation[] = events.filter(event =>
    event.kind === 'tool.result' && event.data.effect === 'read'
    || event.kind === 'tool.verification' && event.data.status === 'confirmed',
  ).map(event => ({
    seq: event.seq, tool: String(event.data.tool), value: event.data.observation!,
    label: event.data.label === 'SIMULATION_ONLY' ? 'SIMULATION_ONLY' : 'VERIFIED',
  }));
  const evaluation = events.filter(event => event.kind === 'evaluation.result').at(-1)?.data.evaluation;
  return {
    mission, status, events, observations,
    ...(pending ? { pending: { step: String(pending.data.step), action: actionSchema.parse(pending.data.action), digest: String(pending.data.digest) } } : {}),
    ...(evaluation ? { evaluation: evaluation as unknown as Evaluation } : {}),
  };
}
