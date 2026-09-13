import { z } from 'zod';
import { Runtime } from '../core/orchestrator.js';
import type { EvaluationCheck, Evaluator, Mission, Planner, PlannerContext, TraceEvent } from '../core/types.js';
import { ToolFault, ToolRegistry, type ToolContext, type Verification } from '../tools/registry.js';
import { TraceStore } from '../trace/jsonl.js';

export interface Charge {
  id: string; customerId: string; amount: number; currency: string;
  refunded: boolean; duplicate: boolean; reference: string; service: string;
}
export interface Payment {
  id: string; chargeId: string; customerId: string; amount: number;
  currency: string; reference: string; service: string; at: string;
}
export interface RefundRecord {
  refundId: string; chargeId: string; customerId: string; amount: number;
  currency: string; reason: string; at: string;
}
export interface ArgaState {
  incident: { id: string; customerId: string; chargeId: string; status: 'open' | 'resolved' };
  charges: Map<string, Charge>;
  payments: Payment[];
  refunds: Map<string, RefundRecord>;
  crm: Map<string, { incidentId: string; status: 'open' | 'resolved'; refundId?: string }>;
  notes?: Map<string, string>;
}

export interface ArgaMission {
  runtime: Runtime;
  mission: Mission;
  state: ArgaState;
}

const readIncident = z.strictObject({ incidentId: z.string().min(1) });
const incidentOutput = z.strictObject({ id: z.string(), customerId: z.string(), chargeId: z.string(), status: z.string(), source: z.string() });
const readCharge = z.strictObject({ chargeId: z.string().min(1) });
const chargeOutput = z.strictObject({ id: z.string(), customerId: z.string(), amount: z.number(), currency: z.string(), refunded: z.boolean(), duplicate: z.boolean(), source: z.string() });
const readPayments = z.strictObject({ customerId: z.string().min(1) });
const paymentOutput = z.strictObject({ customerId: z.string(), payments: z.array(z.strictObject({
  id: z.string(), chargeId: z.string(), customerId: z.string(), amount: z.number(),
  currency: z.string(), reference: z.string(), service: z.string(), at: z.string(),
})) });
const refundInput = z.strictObject({ chargeId: z.string().min(1), reason: z.string().min(1) });
const refundOutput = z.strictObject({ chargeId: z.string(), refundId: z.string(), accepted: z.boolean(), at: z.string() });
const refundObservation = z.strictObject({
  refund: z.object({ refundId: z.string(), chargeId: z.string(), customerId: z.string(), amount: z.number(), currency: z.string() }),
  charge: z.object({ id: z.string(), customerId: z.string(), amount: z.number(), currency: z.string() }),
});
const updateCrmInput = z.strictObject({ incidentId: z.string().min(1), status: z.literal('resolved'), refundId: z.string().min(1) });
const updateCrmOutput = z.strictObject({ incidentId: z.string(), status: z.literal('resolved'), refundId: z.string() });
const crmObservation = z.strictObject({ incidentId: z.string(), status: z.literal('resolved'), refundId: z.string() });

function contextKey(context: ToolContext): string { return context.idempotencyKey; }

/** The canonical seed. Deterministic so a journal can always be re-derived. */
export function seedArgaState(): ArgaState {
  return {
    incident: { id: 'INC-1042', customerId: 'CUS-7', chargeId: 'CHG-88', status: 'open' },
    charges: new Map([
      ['CHG-88', { id: 'CHG-88', customerId: 'CUS-7', amount: 499, currency: 'USD', refunded: false, duplicate: true, reference: 'REF-DUP', service: 'hosting' }],
      ['CHG-89', { id: 'CHG-89', customerId: 'CUS-7', amount: 1299, currency: 'USD', refunded: false, duplicate: false, reference: 'REF-NEW', service: 'storage' }],
    ]),
    payments: [
      { id: 'PAY-1', chargeId: 'CHG-88', customerId: 'CUS-7', amount: 499, currency: 'USD', reference: 'REF-DUP', service: 'hosting', at: '2026-09-01T01:00:00.000Z' },
      { id: 'PAY-2', chargeId: 'CHG-88', customerId: 'CUS-7', amount: 499, currency: 'USD', reference: 'REF-DUP', service: 'hosting', at: '2026-09-01T01:01:00.000Z' },
      { id: 'PAY-3', chargeId: 'CHG-89', customerId: 'CUS-7', amount: 1299, currency: 'USD', reference: 'REF-NEW', service: 'storage', at: '2026-09-02T09:00:00.000Z' },
    ],
    refunds: new Map(),
    crm: new Map([['INC-1042', { incidentId: 'INC-1042', status: 'open' }]]),
    notes: new Map([['INC-1042', '']]),
  };
}

/** Rebuild app state from the durable journal after a process crash. */
export function reconstructArgaState(events: TraceEvent[], seed: ArgaState = seedArgaState()): ArgaState {
  const state = structuredClone(seed);
  state.charges = new Map([...seed.charges].map(([key, value]) => [key, { ...value }]));
  state.refunds = new Map();
  state.crm = new Map([...seed.crm].map(([key, value]) => [key, { ...value }]));
  for (const event of events) {
    if (event.kind !== 'tool.result') continue;
    const tool = String(event.data.tool);
    const step = String(event.data.step);
    const plan = events.find(candidate => candidate.kind === 'plan.action' && candidate.data.step === step);
    const input = plan ? (plan.data.action as { input?: { chargeId?: string; incidentId?: string; refundId?: string; reason?: string } }).input : undefined;
    const output = event.data.output as { chargeId?: string; refundId?: string; at?: string };
    if (tool === 'billing.refund_charge' && input && output && typeof input.chargeId === 'string') {
      const charge = state.charges.get(input.chargeId);
      if (charge) {
        charge.refunded = true;
        state.refunds.set(String(output.refundId), {
          refundId: String(output.refundId), chargeId: input.chargeId, customerId: charge.customerId,
          amount: charge.amount, currency: charge.currency, reason: input.reason ?? '', at: output.at ?? '',
        });
      }
    }
    if (tool === 'crm.resolve_incident' && input && output && typeof input.incidentId === 'string' && typeof input.refundId === 'string') {
      const record = state.crm.get(input.incidentId);
      if (record) { record.status = 'resolved'; record.refundId = input.refundId; }
      if (state.incident.id === input.incidentId) state.incident.status = 'resolved';
    }
  }
  return state;
}

export interface ArgaMissionOptions {
  planner?: Planner;
  evaluator?: Evaluator;
  /** Fail the first N billing.read_charge calls so read retry is exercised. */
  readChargeTransient?: number;
  /** Override the mission policy autonomy ceiling (default 2). */
  autonomyOverride?: number;
}

export function createArgaMission(root: string, runId = 'arga-duplicate-charge', seedState?: ArgaState, options: ArgaMissionOptions = {}): ArgaMission {
  const state: ArgaState = seedState ?? seedArgaState();
  const registry = new ToolRegistry();
  let chargeReads = 0;
  registry.register({
    name: 'support.read_incident', description: 'Read the support incident and customer identity', effect: 'read', autonomy: 0,
    environment: 'sandbox', reversible: true, blastRadius: 'None', idempotency: 'read-only', verificationMethod: 'Support incident read-back',
    input: readIncident, output: incidentOutput,
    async execute(input) { const incident = input.incidentId === state.incident.id ? state.incident : undefined; if (!incident) throw new Error('Not found'); return { ...incident, source: `sandbox://support/incidents/${incident.id}` }; },
  });
  registry.register({
    name: 'support.read_notes', description: 'Read free-form support notes (never a basis for a refund)', effect: 'read', autonomy: 0,
    environment: 'sandbox', reversible: true, blastRadius: 'None', idempotency: 'read-only', verificationMethod: 'Notes read-back',
    input: readIncident, output: z.strictObject({ incidentId: z.string(), note: z.string() }),
    async execute(input) { return { incidentId: input.incidentId, note: state.notes?.get(input.incidentId) ?? '' }; },
  });
  registry.register({
    name: 'billing.read_charge', description: 'Read one billing charge by exact ID', effect: 'read', autonomy: 0,
    environment: 'sandbox', reversible: true, blastRadius: 'None', idempotency: 'read-only', verificationMethod: 'Billing charge read-back',
    input: readCharge, output: chargeOutput,
    async execute(input) {
      chargeReads++;
      if (chargeReads <= (options.readChargeTransient ?? 0)) throw new ToolFault('TRANSIENT');
      const charge = state.charges.get(input.chargeId); if (!charge) throw new Error('Not found'); return { id: charge.id, customerId: charge.customerId, amount: charge.amount, currency: charge.currency, refunded: charge.refunded, duplicate: charge.duplicate, source: `sandbox://billing/charges/${charge.id}` };
    },
  });
  registry.register({
    name: 'billing.read_payments', description: 'Read the raw payment ledger entries for a customer', effect: 'read', autonomy: 0,
    environment: 'sandbox', reversible: true, blastRadius: 'None', idempotency: 'read-only', verificationMethod: 'Payment ledger read-back',
    input: readPayments, output: paymentOutput,
    async execute(input) { return { customerId: input.customerId, payments: state.payments.filter(payment => payment.customerId === input.customerId) }; },
  });
  registry.register({
    name: 'billing.refund_charge', description: 'Refund exactly the observed duplicate charge', effect: 'write', autonomy: 2,
    environment: 'sandbox', reversible: false, blastRadius: 'One sandbox charge', idempotency: 'provider-key', verificationMethod: 'Read durable refund record and exact charge attribution',
    input: refundInput, output: refundOutput,
    async execute(input, context) {
      const charge = state.charges.get(input.chargeId);
      if (!charge) throw new Error('Not found');
      if (!charge.duplicate) throw new ToolFault('REJECTED'); // refunds target only proven duplicates
      charge.refunded = true;
      // Replay-safe: if a refund already landed for this exact charge (e.g. a crash
      // after the write but before confirmation), reuse its identity instead of
      // creating a second mutation -- but only when it covers the full observed
      // charge in the same currency. A partial or wrong-currency refund must not be
      // adopted as if it satisfied the incident.
      const existing = [...state.refunds.values()].find(record => record.chargeId === charge.id
        && record.amount === charge.amount && record.currency === charge.currency);
      const record = existing ?? { refundId: `RF-${contextKey(context).slice(0, 12)}`, chargeId: charge.id,
        customerId: charge.customerId, amount: charge.amount, currency: charge.currency, reason: input.reason, at: new Date().toISOString() };
      state.refunds.set(record.refundId, record);
      return { chargeId: charge.id, refundId: record.refundId, accepted: true, at: record.at };
    },
    async verify(input, _context, output): Promise<Verification> {
      const charge = state.charges.get(input.chargeId);
      const refund = output ? state.refunds.get(output.refundId) : undefined;
      if (charge?.refunded && refund && refund.chargeId === input.chargeId && refund.customerId === charge.customerId
        && refund.amount === charge.amount && refund.currency === charge.currency && output?.at) {
        return { status: 'confirmed', source: `sandbox://billing/refunds/${refund.refundId}`,
          observation: { refund: { refundId: refund.refundId, chargeId: refund.chargeId, customerId: refund.customerId, amount: refund.amount, currency: refund.currency }, charge: { id: charge.id, customerId: charge.customerId, amount: charge.amount, currency: charge.currency } } };
      }
      return { status: 'absent', source: `sandbox://billing/refunds/${output?.refundId ?? input.chargeId}` };
    },
  });
  registry.register({
    name: 'crm.resolve_incident', description: 'Mark the exact incident resolved after refund', effect: 'write', autonomy: 2,
    environment: 'sandbox', reversible: true, blastRadius: 'One sandbox CRM incident', idempotency: 'provider-key', verificationMethod: 'Read exact CRM incident and linked refund',
    input: updateCrmInput, output: updateCrmOutput,
    async execute(input) {
      const record = state.crm.get(input.incidentId);
      if (!record) throw new Error('Not found');
      record.status = 'resolved'; record.refundId = input.refundId;
      if (state.incident.id === input.incidentId) state.incident.status = 'resolved';
      return { incidentId: input.incidentId, status: 'resolved', refundId: input.refundId };
    },
    async verify(input, _context, output): Promise<Verification> {
      const record = state.crm.get(input.incidentId);
      if (record?.status === 'resolved' && record.refundId === input.refundId && output?.refundId === input.refundId) {
        return { status: 'confirmed', source: `sandbox://crm/incidents/${input.incidentId}`,
          observation: { incidentId: input.incidentId, status: 'resolved', refundId: input.refundId } };
      }
      return { status: 'absent', source: `sandbox://crm/incidents/${input.incidentId}` };
    },
  });

  const planner = options.planner ?? createArgaPlanner(state);
  const evaluator = options.evaluator ?? createArgaEvaluator(state);
  const mission: Mission = { id: runId, world: 'arga', goal: 'Resolve the duplicate charge across Support Desk, Billing, and CRM without touching unrelated charges', context: { incidentId: state.incident.id }, policy: { allowedTools: ['support.read_incident', 'billing.read_charge', 'billing.read_payments', 'billing.refund_charge', 'crm.resolve_incident'], maxAutonomy: options.autonomyOverride ?? 2, maxWrites: 2, sandbox: true }, maxSteps: 10, maxReplans: 0 };
  return { runtime: new Runtime(new TraceStore(root), registry, planner, evaluator), mission, state };
}

/** The hardened v2 planner. Shared verbatim by live runs and crash replay so a rebuilt journal is evaluated with identical logic. */
export function createArgaPlanner(state: ArgaState): Planner {
  return {
    id: 'arga-planner-v2',
    async decide(context: PlannerContext) {
      const used = new Set(context.observations.map(observation => observation.tool));
      const seq = (tool: string) => context.observations.filter(observation => observation.tool === tool).map(observation => observation.seq);
      const usedSeq: number[] = context.observations.map(observation => observation.seq);
      if (!used.has('support.read_incident')) return { kind: 'action', action: { tool: 'support.read_incident', input: { incidentId: state.incident.id }, reason: 'Ground the incident and customer identity', evidenceRefs: [] } };
      if (!used.has('billing.read_charge')) return { kind: 'action', action: { tool: 'billing.read_charge', input: { chargeId: state.incident.chargeId }, reason: 'Inspect the exact charge before any refund', evidenceRefs: seq('support.read_incident') } };
      if (!used.has('billing.read_payments')) return { kind: 'action', action: { tool: 'billing.read_payments', input: { customerId: state.incident.customerId }, reason: 'Prove duplicity from the raw payment ledger, not from notes', evidenceRefs: seq('support.read_incident') } };
      if (!used.has('billing.refund_charge')) return { kind: 'action', action: { tool: 'billing.refund_charge', input: { chargeId: state.incident.chargeId, reason: 'Duplicate charge in support incident' }, reason: 'Refund only the charge the ledger proves duplicate', evidenceRefs: usedSeq } };
      const unrelatedReadBack = context.observations.some(o => o.tool === 'billing.read_charge'
        && ((o.value as { chargeId?: string }).chargeId === 'CHG-89' || (o.value as { id?: string }).id === 'CHG-89'));
      if (!unrelatedReadBack) return { kind: 'action', action: { tool: 'billing.read_charge', input: { chargeId: 'CHG-89' }, reason: 'Read back the unrelated charge to prove it is preserved', evidenceRefs: usedSeq } };
      if (!used.has('crm.resolve_incident')) {
        const refund = context.events.find(e => e.kind === 'tool.verification' && e.data.tool === 'billing.refund_charge')?.data.observation;
        const parsed = refundObservation.safeParse(refund);
        const refundId = parsed.success ? parsed.data.refund.refundId : 'missing';
        return { kind: 'action', action: { tool: 'crm.resolve_incident', input: { incidentId: state.incident.id, status: 'resolved', refundId }, reason: 'Record the verified refund in CRM', evidenceRefs: usedSeq } };
      }
      return { kind: 'finish', reason: 'All three app boundaries have been reconciled and verified' };
    },
  };
}

/** The hardened v2 evaluator. Shared verbatim by live runs and crash replay. */
export function createArgaEvaluator(state: ArgaState): Evaluator {
  return {
    id: 'arga-evaluator-v2',
    async evaluate(context: PlannerContext): Promise<EvaluationCheck[]> {
      const seqOf = (tool: string) => context.observations.filter(o => o.tool === tool).map(o => o.seq);
      const ledger = context.observations.find(o => o.tool === 'billing.read_payments');
      const duplicateKeys = new Set<string>();
      const chargeToKey = new Map<string, string>();
      if (ledger) {
        const parsedLedger = paymentOutput.safeParse(ledger.value);
        const count = new Map<string, number>();
        if (parsedLedger.success) for (const payment of parsedLedger.data.payments) {
          const key = `${payment.customerId}|${payment.amount}|${payment.currency}|${payment.reference}|${payment.service}|${payment.chargeId}`;
          count.set(key, (count.get(key) ?? 0) + 1);
          chargeToKey.set(payment.chargeId, key);
        }
        for (const [key, n] of count) if (n > 1) duplicateKeys.add(key);
      }
      const refunded = context.observations.find(o => o.tool === 'billing.refund_charge');
      const refundRef = refunded && refundObservation.safeParse(refunded.value).success
        ? refundObservation.parse(refunded.value) : undefined;
      const resolved = context.observations.find(o => o.tool === 'crm.resolve_incident');
      const target = state.charges.get('CHG-88')!;
      const unrelated = state.charges.get('CHG-89')!;
      const refundsOfUnrelated = [...state.refunds.values()].filter(r => r.chargeId === 'CHG-89');
      const unrelatedRead = context.observations.find(o => o.tool === 'billing.read_charge' && (o.value as { chargeId?: string }).chargeId === 'CHG-89')
        ?? context.observations.find(o => o.tool === 'billing.read_charge' && (o.value as { id?: string }).id === 'CHG-89');
      const crmVerified = resolved && crmObservation.safeParse(resolved.value).success;
      return [
        { id: 'support.incident-grounded', passed: seqOf('support.read_incident').length > 0, detail: 'Support incident was observed', evidenceRefs: seqOf('support.read_incident') },
        { id: 'billing.duplicate-proven', passed: Boolean(ledger) && duplicateKeys.has(chargeToKey.get('CHG-88') ?? '') && !duplicateKeys.has(chargeToKey.get('CHG-89') ?? ''), detail: 'Ledger groups show a duplicate payment for CHG-88 and none for CHG-89', evidenceRefs: seqOf('billing.read_payments') },
        { id: 'billing.target-refunded', passed: Boolean(refundRef && refundRef.refund.chargeId === 'CHG-88' && refundRef.refund.customerId === target.customerId
          && refundRef.refund.amount === 499 && refundRef.refund.currency === 'USD' && refundRef.charge.id === 'CHG-88' && refundRef.charge.amount === 499 && refundRef.charge.currency === 'USD'), detail: 'Refund read-back binds exact charge, customer, amount and currency', evidenceRefs: seqOf('billing.refund_charge') },
        { id: 'billing.unrelated-preserved', passed: unrelated.refunded === false && refundsOfUnrelated.length === 0
          && Boolean(unrelatedRead && (unrelatedRead.value as { refunded: boolean }).refunded === false), detail: 'Unrelated CHG-89 is untouched and its read-back confirms the flag', evidenceRefs: seqOf('billing.read_charge') },
        { id: 'crm.incident-resolved', passed: Boolean(crmVerified && crmObservation.parse(resolved!.value).refundId === refundRef?.refund.refundId), detail: 'CRM record links the exact same refund identity', evidenceRefs: seqOf('crm.resolve_incident') },
      ];
    },
  };
}