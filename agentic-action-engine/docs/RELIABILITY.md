# Reliability and evaluation brief

The central reliability claim is narrow and testable:

> **A run succeeds only when independently evaluated external state satisfies the declared invariants and no forbidden condition occurred.**

The planner cannot mark its own run successful.

## 1. Grounding

Important claims must be backed by observations from named sources.

A model statement such as "the refund succeeded" is `INFERRED` until the exact refund/charge state is read from the system of record.

Mutable facts are re-read when they matter to a decision. Cached memory is not silently treated as current truth.

## 2. Policy before side effect

All write-capable tool calls are converted into `ActionIntent` objects and checked by deterministic policy rules before execution.

Policy can:

- allow automatically;
- require explicit approval;
- deny.

Prompt text cannot override a deny rule.

## 3. Read-after-write verification

Every write tool defines a provider-specific verification step.

Examples:

- create PR → fetch PR + checks
- send message → fetch sent/draft state where provider supports it
- create calendar event → fetch event
- update CRM → read exact record/version
- refund charge → fetch charge/refund and validate amount/identity

If verification is impossible, the result cannot be labeled VERIFIED.

## 4. Uncertain side effects

A timeout is not equivalent to failure.

If a side-effecting request may have reached the provider:

1. mark action `UNKNOWN`;
2. do not retry blindly;
3. inspect current state;
4. retry only if absence of the effect is established or the operation uses a stable idempotency key.

This prevents the classic "timeout → retry → duplicate write" failure.

## 5. Idempotency

Tool metadata declares one of:

- `read` — safe to repeat;
- `keyed` — retry only with the same idempotency key;
- `unsafe-retry` — observe before retry.

Idempotency keys derive from stable run/action identity rather than random retries.

## 6. Failure taxonomy

Evaluator and traces distinguish at least:

- skipped work
- out-of-scope work
- instruction/policy violation
- integration failure
- retry loop / duplicate effect
- hallucinated state
- stale-state decision
- wrong-entity mutation
- communication failure
- partial completion reported as success
- verification failure
- evaluator uncertainty

A run may be technically error-free and still fail semantically.

## 7. Prompt injection and untrusted data

External text, documents, tickets, CRM notes, emails, repository content, and tool outputs are **data**, not governing instructions.

Rules:

- system/repository policy has higher authority;
- retrieved content cannot expand tool permissions;
- external text cannot suppress logging/evaluation;
- secrets are never copied into traces;
- suspicious instructions inside data are recorded as evidence, not obeyed.

Adversarial fixtures include prompt injection in external records.

## 8. Evaluator independence

The evaluator receives:

- goal and invariants;
- initial state/evidence;
- final observed state/evidence;
- action/tool trace;
- policy decisions.

It does **not** rely on the planner's final prose explanation.

Where possible, invariants are deterministic. LLM judging is reserved for semantic properties that cannot be expressed reliably as code and is clearly labeled.

## 9. Evaluation layers

### Contract tests

- schema validation
- side-effect metadata present
- autonomy class present
- verification function present for writes
- idempotency behavior tested

### World invariants

Domain-specific final-state rules from each `worlds/*/SPEC.md`.

### Adversarial fixtures

- ambiguous identities
- duplicate records
- stale state
- malicious external text
- partial provider failure
- uncertain side effect
- approval denial
- conflicting evidence
- changed ordering/pagination

### End-to-end score

```text
score =
  goal_completion
+ evidence_coverage
+ policy_compliance
+ verification_coverage
+ recovery_quality
- forbidden_effect_penalty
- unnecessary_tool_penalty
```

Cost and latency are reported separately rather than allowing a cheap incorrect run to look competitive.

## 10. Failure → regression ratchet

A useful failure is promoted into a durable fixture when it can be expressed as:

```text
initial state + goal + policy + expected invariants + forbidden invariants
```

That fixture then runs against future agent revisions. The project improves by accumulating **evidence-backed cases**, not by accumulating prompt folklore.

## 11. Replay

Replay supports:

- same scenario, new model;
- same scenario, new agent revision;
- stricter/looser policy;
- memory enabled/disabled;
- resume from checkpoint;
- targeted mutated scenarios around a discovered failure boundary.

Comparison output includes success, invariant failures, policy violations, forbidden effects, steps, tool calls, tokens/cost, and latency.

## 12. Demo reliability bar

The live demo is not considered complete unless it visibly shows:

1. an external observation;
2. source-backed grounded state;
3. at least one policy decision;
4. a real or sandbox side effect;
5. read-after-write verification;
6. independent evaluator pass/fail;
7. inspectable trace;
8. one replay or failure fixture.

## Evidence states

- `VERIFIED` — directly supported by sufficient current observation
- `PARTIALLY_VERIFIED` — some but not all required evidence exists
- `INFERRED` — reasoned conclusion, not directly observed
- `UNKNOWN` — insufficient current evidence
- `CONTRADICTED` — current evidence conflicts with claim
- `SIMULATION_ONLY` — established only inside synthetic/sandbox state
- `NOT_TESTED` — no validation performed

The UI must preserve these labels rather than flattening uncertainty into a green checkmark.