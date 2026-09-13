# Reliability and Evaluation Brief

The judging target is not "the model sounded smart". It is "the system completed the intended multi-app task and can prove it."

## Reliability rules

- No destructive or externally visible action without its declared policy gate.
- Every write-capable tool has a verification read or invariant check.
- Network/tool failures are explicit state, never silently converted into success.
- Retries are allowed only for operations known to be idempotent or protected by idempotency keys.
- Agent output is treated as a proposal until grounded by tool observations.
- Prompt-injection text inside external data is data, never authority.
- Secrets never enter traces.
- Replay uses scrubbed/captured outputs or synthetic fixtures.

## Evaluation layers

### 1. Tool contract tests
Validate schemas, permission metadata, idempotency behaviour, and read-after-write verification.

### 2. World assertions
Each world defines domain invariants and expected final state.

### 3. Adversarial fixtures
Examples include ambiguous records, duplicate entities, stale state, malicious notes, partial failures, approval denial, and conflicting evidence.

### 4. End-to-end scenario score
A run is graded on:

- goal completion,
- correct external state,
- evidence completeness,
- policy compliance,
- unnecessary tool calls,
- recovery from injected failure,
- latency/cost metadata where available.

## Minimum live-demo proof

A demo should visibly show:

1. goal/event arrives;
2. agent reads state from at least one external app;
3. agent retrieves context from another source;
4. agent proposes or performs a bounded action;
5. approval is enforced when required;
6. agent re-reads resulting state;
7. evaluator passes/fails independently;
8. trace can be replayed or inspected.

## Regression loop

A failed run becomes a durable scenario fixture when the failure can be expressed as state + goal + expected invariants. This gives the project a ratchet: failures become future tests instead of anecdotes.
