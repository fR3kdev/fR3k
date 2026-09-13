import { actionSchema, missionSchema, type Evaluation, type Observation, type RunStatus, type RunView, type TraceEvent } from './types.js';

export const terminal = new Set<RunStatus>(['CONFIRMED_SUCCESS', 'CONFIRMED_FAILURE', 'DENIED_BY_POLICY']);

/** State is projected from the durable journal; no independently stale checkpoint file. */
export function project(events: TraceEvent[]): RunView {
  if (events[0]?.kind !== 'run.created') throw new Error('Run does not exist');
  const mission = missionSchema.parse(events[0].data.mission);
  const status = (events.filter(event => event.kind === 'run.status').at(-1)?.data.status ?? 'RUNNING') as RunStatus;
  const completed = new Set(events.filter(event => event.kind === 'step.completed').map(event => event.data.step));
  const pending = events.filter(event => event.kind === 'plan.action' && !completed.has(event.data.step)).at(-1);
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
