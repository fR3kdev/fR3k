import { z } from 'zod';
import type { Evaluation, EvaluationCheck, TraceEvent } from '../core/types.js';

const checksSchema = z.array(z.strictObject({
  id: z.string().min(1), passed: z.boolean(), detail: z.string(),
  evidenceRefs: z.array(z.int().positive()),
})).min(1);

/** These checks are owned by the runtime, separate from both planner and domain evaluator. */
export function evaluateTrajectory(events: TraceEvent[], domainChecks: EvaluationCheck[]): Evaluation {
  const parsed = checksSchema.parse(domainChecks);
  const evidence = new Set(events.filter(e => e.kind === 'tool.result' || e.kind === 'tool.verification').map(e => e.seq));
  const verifiedByTool = new Map<string, Set<number>>();
  for (const event of events) {
    if (event.kind === 'tool.verification' && event.data.status === 'confirmed') {
      const tool = String(event.data.tool);
      const set = verifiedByTool.get(tool) ?? new Set<number>();
      set.add(event.seq);
      verifiedByTool.set(tool, set);
    }
  }
  const starts = events.filter(e => e.kind === 'tool.started' && e.data.effect === 'write');
  const allowed = starts.every(start => {
    const policy = events.filter(e => e.seq < start.seq && e.kind === 'policy.decision' && e.data.step === start.data.step).at(-1);
    if (!policy) return false;
    if (policy.data.decision === 'allow') return true;
    return policy.data.decision === 'approve' && events.some(e => e.seq < start.seq && e.kind === 'approval.granted'
      && e.data.step === start.data.step && e.data.digest === start.data.digest
      && typeof e.data.expiresAt === 'number' && e.data.expiresAt > Date.parse(start.time));
  });
  const verified = starts.every(start => events.some(e => e.kind === 'tool.verification'
    && e.seq > start.seq && e.data.step === start.data.step && e.data.status === 'confirmed'));
  const citedRefsValid = parsed.every(check => check.evidenceRefs.every(ref => evidence.has(ref))
    && (!check.passed || check.evidenceRefs.length > 0));
  // Every executed write tool must be accounted for by at least one passing domain
  // check that cites a confirmed read-back for that exact tool. A domain check may
  // otherwise safely cite antecedent reads (e.g. a preservation check), but a final
  // write can never be certified from narrative or pre-read observations alone.
  const writtenTools = new Set(starts.map(start => String(start.data.tool)));
  const writesAccounted = [...writtenTools].every(tool =>
    parsed.some(check => check.passed && check.evidenceRefs.some(ref => verifiedByTool.get(tool)?.has(ref))));
  const grounded = citedRefsValid && writesAccounted;
  const checks: EvaluationCheck[] = [...parsed,
    { id: 'runtime.policy', passed: allowed, detail: 'Every write was permitted before execution', evidenceRefs: starts.map(e => e.seq) },
    { id: 'runtime.verification', passed: verified, detail: 'Every write has a confirming read-back', evidenceRefs: events.filter(e => e.kind === 'tool.verification').map(e => e.seq) },
    { id: 'runtime.grounding', passed: grounded, detail: 'Passing domain checks cite observed evidence; each write is accounted for by a confirmed read-back', evidenceRefs: [...evidence] },
  ];
  return { passed: checks.every(check => check.passed), score: checks.filter(check => check.passed).length / checks.length, checks };
}
