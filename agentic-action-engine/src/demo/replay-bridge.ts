import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { identifier, type EvaluationCheck, type Evaluator, type Planner, type PlannerContext } from '../core/types.js';
import { TraceStore } from '../trace/jsonl.js';
import { createArgaMission, createArgaEvaluator, createArgaPlanner, reconstructArgaState, type ArgaState, type RefundRecord } from './arga-mission.js';

/** A reproduced process crash leaves only the durable journal; state is rebuilt from it. */
export interface ReconstructedState {
  writes: string[];
  refunds: RefundRecord[];
  incidentStatus: string;
}

export interface ReplayedResult {
  status: string;
  score: number | null;
  checks: EvaluationCheck[];
}

export interface ReplayDiff {
  id: string;
  baseline: boolean | null;
  candidate: boolean | null;
  matched: boolean;
}

export interface ReplayComparison {
  source: string;
  reconstructed: ReconstructedState;
  baseline: ReplayedResult;
  candidate: ReplayedResult;
  diffs: ReplayDiff[];
}

export interface ReplayRunner {
  /** Rebuild app state from a recorded journal and independently re-run the same mission against it (crash replay). */
  replay(sourceRunId: string): Promise<ReplayComparison>;
  /** Run an alternative planner/evaluator against the reconstructed state and diff its checks (counterfactual). */
  counterfactual(sourceRunId: string, candidate: { planner: Planner; evaluator: Evaluator }, candidateRunId: string): Promise<ReplayComparison>;
}

/** The pre-hardening v1 planner: refunds from the incident note, no ledger proof, no unrelated read-back, no CRM listing. */
export function createLegacyArgaPlanner(state: ArgaState): Planner {
  return {
    id: 'arga-planner-v1',
    async decide(context: PlannerContext) {
      const used = new Set(context.observations.map(observation => observation.tool));
      const usedSeq: number[] = context.observations.map(observation => observation.seq);
      if (!used.has('support.read_incident')) return { kind: 'action', action: { tool: 'support.read_incident', input: { incidentId: state.incident.id }, reason: 'Ground the incident and customer identity', evidenceRefs: [] } };
      if (!used.has('billing.refund_charge')) return { kind: 'action', action: { tool: 'billing.refund_charge', input: { chargeId: state.incident.chargeId, reason: 'Trust the incident note that the charge is duplicate' }, reason: 'Refund the charge named in the incident without verifying the ledger', evidenceRefs: usedSeq } };
      if (!used.has('crm.resolve_incident')) {
        const refund = context.events.find(e => e.kind === 'tool.verification' && e.data.tool === 'billing.refund_charge')?.data.observation;
        const parsed = typeof refund === 'object' && refund && typeof (refund as { refund?: { refundId?: unknown } }).refund?.refundId === 'string'
          ? String((refund as { refund: { refundId: string } }).refund.refundId) : 'missing';
        return { kind: 'action', action: { tool: 'crm.resolve_incident', input: { incidentId: state.incident.id, status: 'resolved', refundId: parsed }, reason: 'Close the incident after the refund', evidenceRefs: usedSeq } };
      }
      return { kind: 'finish', reason: 'Refunded and closed from the note alone' };
    },
  };
}

/** The pre-hardening v1 evaluator: only confirms the target refund and the resolution, without proof of duplicity or preservation. */
export function createLegacyArgaEvaluator(): Evaluator {
  return {
    id: 'arga-evaluator-v1',
    async evaluate(context: PlannerContext) {
      const refunded = context.observations.find(observation => observation.tool === 'billing.refund_charge');
      const resolved = context.observations.find(observation => observation.tool === 'crm.resolve_incident');
      return [
        { id: 'billing.target-refunded', passed: Boolean(refunded), detail: 'A refund observation exists', evidenceRefs: refunded ? [refunded.seq] : [] },
        { id: 'crm.incident-resolved', passed: Boolean(resolved), detail: 'A resolution observation exists', evidenceRefs: resolved ? [resolved.seq] : [] },
      ];
    },
  };
}

function summarize(evaluation: EvaluationCheck[] | undefined, status: string): ReplayedResult {
  if (!evaluation) return { status, score: null, checks: [] };
  return { status, score: evaluation.filter(check => check.passed).length / evaluation.length, checks: evaluation };
}

export function createReplayRunner(root: string): ReplayRunner {
  const live = new TraceStore(root);

  async function load(runId: string): Promise<{ state: ArgaState; checks: EvaluationCheck[]; status: string }> {
    const events = await live.read(runId);
    const evaluationEvent = [...events].reverse().find(event => event.kind === 'evaluation.result');
    const evaluation = evaluationEvent
      ? (evaluationEvent.data.evaluation as unknown as { score: number; passed: boolean; checks: EvaluationCheck[] })
      : undefined;
    const finalStatus = [...events].reverse().find(event => event.kind === 'run.status');
    return {
      state: reconstructArgaState(events),
      checks: evaluation?.checks ?? [],
      status: String(finalStatus?.data.status ?? 'UNKNOWN'),
    };
  }

  function summarizeReconstructed(state: ArgaState): ReconstructedState {
    return {
      writes: state.charges.get('CHG-88')?.refunded ? ['billing.refund_charge'] : [],
      refunds: [...state.refunds.values()],
      incidentStatus: state.incident.status,
    };
  }

  async function executeCandidate(candidateRunId: string, state: ArgaState, pack: { planner: Planner; evaluator: Evaluator }) {
    const dir = await mkdtemp(join(root, 'replay-'));
    const mission = createArgaMission(dir, candidateRunId, state, { planner: pack.planner, evaluator: pack.evaluator });
    let view = await mission.runtime.create(mission.mission);
    if (view.status !== 'RUNNING' && view.status !== 'WAITING_FOR_APPROVAL') return summarize(view.evaluation?.checks, view.status);
    view = await mission.runtime.run(candidateRunId);
    let guard = 0;
    while (view.status === 'WAITING_FOR_APPROVAL' && guard++ < 20) {
      const digest = view.pending?.digest;
      if (!digest) throw new Error('Awaiting approval but no pending digest');
      view = await mission.runtime.approve(candidateRunId, digest, 'replay-operator', true);
      view = await mission.runtime.run(candidateRunId);
    }
    return summarize(view.evaluation?.checks, view.status);
  }

  function diff(baseline: ReplayedResult, candidate: ReplayedResult): ReplayDiff[] {
    const ids = new Set([...baseline.checks.map(check => check.id), ...candidate.checks.map(check => check.id)]);
    return [...ids].map(id => {
      const b = baseline.checks.find(check => check.id === id)?.passed ?? null;
      const c = candidate.checks.find(check => check.id === id)?.passed ?? null;
      return { id, baseline: b, candidate: c, matched: b === c };
    }).sort((a, b) => a.id.localeCompare(b.id));
  }

  async function compare(sourceRunId: string, pack: { planner: Planner; evaluator: Evaluator }, candidateRunId: string): Promise<ReplayComparison> {
    identifier.parse(sourceRunId);
    const { state, checks, status } = await load(sourceRunId);
    const baseline: ReplayedResult = { status, score: checks.length ? checks.filter(check => check.passed).length / checks.length : null, checks };
    const candidate = await executeCandidate(candidateRunId, state, pack);
    return { source: sourceRunId, reconstructed: summarizeReconstructed(state), baseline, candidate, diffs: diff(baseline, candidate) };
  }

  return {
    replay(sourceRunId: string) {
      /* Crash replay runs the exact same planner and evaluator against the rebuilt state. */
      const probe = createArgaMission(root, `${sourceRunId}-probe`);
      return compare(sourceRunId, {
        planner: createArgaPlanner(probe.state),
        evaluator: createArgaEvaluator(probe.state),
      }, `${sourceRunId}-replay`);
    },
    counterfactual(sourceRunId: string, candidate, candidateRunId) {
      return compare(sourceRunId, candidate, candidateRunId);
    },
  };
}