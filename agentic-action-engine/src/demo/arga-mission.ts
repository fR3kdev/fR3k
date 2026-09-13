import { z } from 'zod';
import { Runtime } from '../core/orchestrator.js';
import type { EvaluationCheck, Mission, Planner, PlannerContext } from '../core/types.js';
import { ToolRegistry, type ToolContext } from '../tools/registry.js';
import { TraceStore } from '../trace/jsonl.js';

export interface ArgaState {
  incident: { id: string; customerId: string; chargeId: string; status: 'open' | 'resolved' };
  charges: Map<string, { id: string; customerId: string; amount: number; currency: string; refunded: boolean }>;
  crm: Map<string, { incidentId: string; status: 'open' | 'resolved'; refundId?: string }>;
}

export interface ArgaMission {
  runtime: Runtime;
  mission: Mission;
  state: ArgaState;
}

const readIncident = z.strictObject({ incidentId: z.string().min(1) });
const incidentOutput = z.strictObject({ id: z.string(), customerId: z.string(), chargeId: z.string(), status: z.string(), source: z.string() });
const readCharge = z.strictObject({ chargeId: z.string().min(1) });
const chargeOutput = z.strictObject({ id: z.string(), customerId: z.string(), amount: z.number(), currency: z.string(), refunded: z.boolean(), source: z.string() });
const refundInput = z.strictObject({ chargeId: z.string().min(1), reason: z.string().min(1) });
const refundOutput = z.strictObject({ chargeId: z.string(), refundId: z.string(), accepted: z.boolean() });
const updateCrmInput = z.strictObject({ incidentId: z.string().min(1), status: z.literal('resolved'), refundId: z.string().min(1) });
const updateCrmOutput = z.strictObject({ incidentId: z.string(), status: z.literal('resolved'), refundId: z.string() });

function contextKey(context: ToolContext): string { return context.idempotencyKey; }

export function createArgaMission(root: string, runId = 'arga-duplicate-charge'): ArgaMission {
  const state: ArgaState = {
    incident: { id: 'INC-1042', customerId: 'CUS-7', chargeId: 'CHG-88', status: 'open' },
    charges: new Map([
      ['CHG-88', { id: 'CHG-88', customerId: 'CUS-7', amount: 499, currency: 'USD', refunded: false }],
      ['CHG-89', { id: 'CHG-89', customerId: 'CUS-7', amount: 1299, currency: 'USD', refunded: false }],
    ]),
    crm: new Map([['INC-1042', { incidentId: 'INC-1042', status: 'open' }]]),
  };
  const registry = new ToolRegistry();
  registry.register({
    name: 'support.read_incident', description: 'Read the support incident and customer identity', effect: 'read', autonomy: 0,
    environment: 'sandbox', reversible: true, blastRadius: 'None', idempotency: 'read-only', verificationMethod: 'Support incident read-back',
    input: readIncident, output: incidentOutput,
    async execute(input) { const incident = input.incidentId === state.incident.id ? state.incident : undefined; if (!incident) throw new Error('Not found'); return { ...incident, source: `sandbox://support/incidents/${incident.id}` }; },
  });
  registry.register({
    name: 'billing.read_charge', description: 'Read one billing charge by exact ID', effect: 'read', autonomy: 0,
    environment: 'sandbox', reversible: true, blastRadius: 'None', idempotency: 'read-only', verificationMethod: 'Billing charge read-back',
    input: readCharge, output: chargeOutput,
    async execute(input) { const charge = state.charges.get(input.chargeId); if (!charge) throw new Error('Not found'); return { ...charge, source: `sandbox://billing/charges/${charge.id}` }; },
  });
  registry.register({
    name: 'billing.refund_charge', description: 'Refund exactly the observed duplicate charge', effect: 'write', autonomy: 2,
    environment: 'sandbox', reversible: false, blastRadius: 'One sandbox charge', idempotency: 'provider-key', verificationMethod: 'Read exact charge and refund marker',
    input: refundInput, output: refundOutput,
    async execute(input, context) { const charge = state.charges.get(input.chargeId); if (!charge) throw new Error('Not found'); charge.refunded = true; return { chargeId: charge.id, refundId: `RF-${contextKey(context).slice(0, 12)}`, accepted: true }; },
    async verify(input, _context, output) { const charge = state.charges.get(input.chargeId); return charge?.refunded && output?.accepted ? { status: 'confirmed', source: `sandbox://billing/charges/${input.chargeId}`, observation: { ...charge, refundId: output.refundId } } : { status: 'absent', source: `sandbox://billing/charges/${input.chargeId}` }; },
  });
  registry.register({
    name: 'crm.resolve_incident', description: 'Mark the exact incident resolved after refund', effect: 'write', autonomy: 2,
    environment: 'sandbox', reversible: true, blastRadius: 'One sandbox CRM incident', idempotency: 'provider-key', verificationMethod: 'Read exact CRM incident',
    input: updateCrmInput, output: updateCrmOutput,
    async execute(input) { const record = state.crm.get(input.incidentId); if (!record) throw new Error('Not found'); record.status = 'resolved'; record.refundId = input.refundId; state.incident.status = 'resolved'; return input; },
    async verify(input) { const record = state.crm.get(input.incidentId); return record?.status === 'resolved' && record.refundId === input.refundId ? { status: 'confirmed', source: `sandbox://crm/incidents/${input.incidentId}`, observation: record } : { status: 'absent', source: `sandbox://crm/incidents/${input.incidentId}` }; },
  });

  const planner: Planner = {
    id: 'arga-planner-v1',
    async decide(context: PlannerContext) {
      const used = new Set(context.observations.map(observation => observation.tool));
      const evidence = context.observations[context.observations.length - 1]?.seq;
      if (!used.has('support.read_incident')) return { kind: 'action', action: { tool: 'support.read_incident', input: { incidentId: state.incident.id }, reason: 'Ground the incident and customer identity', evidenceRefs: [] } };
      if (!used.has('billing.read_charge')) return { kind: 'action', action: { tool: 'billing.read_charge', input: { chargeId: state.incident.chargeId }, reason: 'Inspect the exact charge before any refund', evidenceRefs: [evidence!] } };
      if (!used.has('billing.refund_charge')) return { kind: 'action', action: { tool: 'billing.refund_charge', input: { chargeId: state.incident.chargeId, reason: 'Duplicate charge in support incident' }, reason: 'Refund only the charge named by the grounded incident', evidenceRefs: context.observations.map(o => o.seq) } };
      if (!used.has('crm.resolve_incident')) { const refund = context.events.find(e => e.kind === 'tool.verification' && e.data.tool === 'billing.refund_charge')?.data.observation as { refundId?: string } | undefined; return { kind: 'action', action: { tool: 'crm.resolve_incident', input: { incidentId: state.incident.id, status: 'resolved', refundId: refund?.refundId ?? 'missing' }, reason: 'Record the verified refund in CRM', evidenceRefs: context.observations.map(o => o.seq) } }; }
      return { kind: 'finish', reason: 'All three app boundaries have been reconciled' };
    },
  };
  const evaluator = {
    id: 'arga-evaluator-v1',
    async evaluate(context: PlannerContext): Promise<EvaluationCheck[]> {
      const refs = context.observations.map(o => o.seq);
      const target = state.charges.get('CHG-88');
      const unrelated = state.charges.get('CHG-89');
      const crm = state.crm.get(state.incident.id);
      return [
        { id: 'support.incident-grounded', passed: context.observations.some(o => o.tool === 'support.read_incident'), detail: 'Support incident was observed', evidenceRefs: refs },
        { id: 'billing.target-refunded', passed: target?.refunded === true, detail: 'Only the incident charge was refunded', evidenceRefs: refs },
        { id: 'billing.unrelated-preserved', passed: unrelated?.refunded === false, detail: 'Unrelated charge remains unchanged', evidenceRefs: refs },
        { id: 'crm.incident-resolved', passed: crm?.status === 'resolved' && Boolean(crm.refundId), detail: 'CRM records the verified refund', evidenceRefs: refs },
      ];
    },
  };
  const mission: Mission = { id: runId, world: 'arga', goal: 'Resolve the duplicate charge across Support Desk, Billing, and CRM without touching unrelated charges', context: { incidentId: state.incident.id }, policy: { allowedTools: ['support.read_incident', 'billing.read_charge', 'billing.refund_charge', 'crm.resolve_incident'], maxAutonomy: 2, maxWrites: 2, sandbox: true }, maxSteps: 10, maxReplans: 0 };
  return { runtime: new Runtime(new TraceStore(root), registry, planner, evaluator), mission, state };
}
