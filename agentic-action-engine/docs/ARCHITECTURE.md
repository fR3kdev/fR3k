# Architecture

## Design target

A compact agent runtime that can operate across multiple external apps while keeping **state, authority, side effects, and proof** explicit.

The planner may be probabilistic. The safety boundary and success criteria are not.

```text
Event / Goal
    |
    v
Observation adapters ──> Evidence store
    |                        |
    v                        v
State reducer ─────────> Grounded state
    |                        |
    v                        v
Planner / policy proposal   Memory retrieval
    |                        |
    +-----------+------------+
                v
         ActionIntent[]
                |
                v
          Policy engine
       allow / approve / deny
                |
                v
           Tool router
                |
     +----------+-----------+
     |          |           |
     v          v           v
  GitHub     Workspace    Domain APIs
     |          |           |
     +----------+-----------+
                v
        External state change
                |
                v
       Verification read(s)
                |
                v
         Independent eval
          pass/fail/replan
                |
                v
          Append-only trace
```

## Core contracts

### Observation

```ts
type EvidenceState =
  | "VERIFIED"
  | "PARTIALLY_VERIFIED"
  | "INFERRED"
  | "UNKNOWN"
  | "CONTRADICTED"
  | "SIMULATION_ONLY"
  | "NOT_TESTED"

type Observation<T = unknown> = {
  id: string
  source: { app: string; locator: string; observedAt: string }
  value: T
  digest: string
  evidenceState: EvidenceState
}
```

### Goal

```ts
type Goal = {
  id: string
  objective: string
  success: Invariant[]
  forbidden: Invariant[]
  deadline?: string
  maxCostUsd?: number
  maxToolCalls?: number
}
```

### Tool contract

```ts
type ToolContract<I, O> = {
  name: string
  inputSchema: Schema<I>
  outputSchema: Schema<O>
  sideEffect: "none" | "reversible" | "external" | "destructive"
  autonomy: 0 | 1 | 2 | 3 | 4 | "X"
  idempotency: "read" | "keyed" | "unsafe-retry"
  blastRadius: string
  verify: (input: I, output: O) => Promise<VerificationResult>
}
```

### Action intent

The model never calls a side-effecting implementation directly. It emits an intent that is checked first.

```ts
type ActionIntent = {
  id: string
  tool: string
  args: unknown
  reason: string
  evidenceRefs: string[]
  expectedChange: StateDelta
  rollback?: string
}
```

### Policy decision

```ts
type PolicyDecision = {
  actionId: string
  verdict: "ALLOW" | "REQUIRE_APPROVAL" | "DENY"
  ruleIds: string[]
  reason: string
}
```

## State machine

```text
RECEIVED
  -> OBSERVING
  -> GROUNDED
  -> PLANNING
  -> POLICY_CHECK
       -> BLOCKED
       -> AWAITING_APPROVAL
       -> EXECUTING
  -> VERIFYING
  -> EVALUATING
       -> REPLAN
       -> FAILED
       -> SUCCEEDED
```

A run can only enter `SUCCEEDED` from the evaluator, never from the planner or tool executor.

## Verification semantics

A tool response is an observation about the request, not necessarily proof of the real-world result.

Examples:

- `POST /refund -> 200` means the API accepted/responded; success requires re-reading the exact charge/refund state.
- `gmail.send -> queued` is not proof of delivery.
- `calendar.create -> id` is followed by `calendar.get(id)`.
- `github.open_pr -> number` is followed by PR/check-state retrieval.

Every world defines what evidence is enough to promote a claim to `VERIFIED`.

## Retry semantics

Automatic retry is allowed only when one of these is true:

1. operation is read-only;
2. operation is protected by a stable idempotency key;
3. verification proves no side effect occurred.

A timeout after an uncertain write enters `UNKNOWN_SIDE_EFFECT` behavior: observe current state before attempting anything else.

## Memory

Memory stores observations and prior outcomes, not truth by declaration.

Namespaces:

- `episodic/run/*` — previous traces/outcomes
- `semantic/entity/*` — durable entity facts with provenance
- `case/*` — reusable intervention/failure fixtures
- `policy/*` — versioned autonomy rules

Retrieval results are treated as evidence candidates until revalidated when current mutable state matters.

## Replay

Replay key:

```text
scenario + captured observations + agent revision + model + policy + memory mode + seed
```

Supported comparisons:

- model A vs model B
- agent revision N vs N+1
- policy strict vs permissive
- memory on vs off
- resume from checkpoint

Metrics:

- success/invariant score
- policy violations
- forbidden effects
- tool calls
- tokens/cost
- latency
- evidence coverage

## Trace event schema

```json
{
  "run_id": "run_01J...",
  "seq": 12,
  "time": "2026-09-14T02:45:00+10:00",
  "kind": "tool.result",
  "world": "arga",
  "goal_id": "refund_duplicate",
  "step_id": "verify_refund",
  "tool": "stripe.get_refund",
  "autonomy": 4,
  "input_digest": "sha256:...",
  "output_digest": "sha256:...",
  "evidence_refs": ["obs_29"],
  "status": "VERIFIED"
}
```

Sensitive fields are redacted before trace persistence. Digests allow evidence correlation without dumping secrets.

## Connector boundary

Connectors expose typed operations and translate provider-specific responses into observations. Domain logic stays outside connectors.

Planned layout:

```text
src/
  core/
    orchestrator.ts
    state-machine.ts
    reducer.ts
    planner.ts
    types.ts
  policy/
    engine.ts
    rules.ts
    approvals.ts
  tools/
    registry.ts
    contracts.ts
    idempotency.ts
  evidence/
    store.ts
    digest.ts
    provenance.ts
  trace/
    events.ts
    jsonl.ts
  eval/
    evaluator.ts
    invariants.ts
    scoring.ts
  replay/
    runner.ts
    compare.ts
  memory/
    store.ts
    retrieval.ts
  connectors/
    github/
    google-drive/
    google-sheets/
    gmail/
    google-calendar/
    slack/
  worlds/
    lemma/
    comma/
    arga/
    userlens/
```

Python is used only where its analysis/evaluation ecosystem is materially better. TypeScript remains the orchestration/control-plane source of truth.

## UI contract

The live interface must surface:

- mission + success/forbidden conditions
- current grounded state
- plan with active step
- evidence drawer
- tool calls and results
- autonomy/policy decision
- approval checkpoint
- evaluator verdict
- trace timeline
- replay/counterfactual comparison

The UI must make it impossible to confuse `INFERRED`, `SIMULATION_ONLY`, or `UNKNOWN` with verified external state.