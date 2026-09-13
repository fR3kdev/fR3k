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
  const grounded = parsed.every(check => check.evidenceRefs.every(ref => evidence.has(ref))
    && (!check.passed || check.evidenceRefs.length > 0));
  const checks: EvaluationCheck[] = [...parsed,
    { id: 'runtime.policy', passed: allowed, detail: 'Every write was permitted before execution', evidenceRefs: starts.map(e => e.seq) },
    { id: 'runtime.verification', passed: verified, detail: 'Every write has a confirming read-back', evidenceRefs: events.filter(e => e.kind === 'tool.verification').map(e => e.seq) },
    { id: 'runtime.grounding', passed: grounded, detail: 'Passing domain checks cite observed evidence', evidenceRefs: [...evidence] },
  ];
  return { passed: checks.every(check => check.passed), score: checks.filter(check => check.passed).length / checks.length, checks };
}
