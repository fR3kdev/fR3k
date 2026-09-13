# System & Reliability Brief

## System

fR3k is a typed agentic decision-and-action runtime built around one loop:

`OBSERVE → MODEL STATE → PLAN → POLICY CHECK → ACT → OBSERVE AGAIN → EVALUATE → VERIFY → EVIDENCE`

For the judged live mission, three real external apps are necessary rather than decorative:

1. **YouTube** supplies current public stream state and exact video identity.
2. **GitHub** supplies canonical incident/work state and receives the final evidence receipt.
3. **ntfy** is the external operator-notification channel whose write must be read back exactly.

Tools have strict schemas plus metadata for effect, autonomy, environment, reversibility, blast radius, idempotency and verification. Consequential writes require an exact approval digest that binds the action, tool revision, policy and evidence references.

## Reliability design

The runtime does not treat an HTTP 2xx or an agent claim as proof. A write is successful only after independent read-after-write verification. Writes use provider-key or reconcile-only semantics, and ambiguous writes are never blindly repeated.

The append-only JSONL trace is fsynced and hash chained. The runtime includes bounded retries, deadline enforcement, stale-lock recovery, torn-tail repair, crash replay, policy denial, exact approval expiry, implementation-revision binding and evaluator grounding.

## Failure that happened in the real demo

The first live ntfy write was accepted, but the verifier polled before the provider exposed the event. The runtime saw no receipt and **refused to resend the notification**. A later verifier-only reconciliation found receipt `yNc6zkrpzqhg` exactly once and continued the same run without executing the write again.

That race became a regression test. The verifier now performs bounded read-back polling before declaring a receipt absent. This is the core reliability claim in concrete form: uncertainty stops execution instead of multiplying side effects.

## Verified result

Live run `live-incident-1789331116305` finished **`CONFIRMED_SUCCESS`** with evaluator score **1.00**. All seven checks passed: exact YouTube stream, canonical GitHub issue, ntfy receipt, GitHub evidence receipt, runtime policy, runtime verification and runtime grounding.

The integrated suite now passes **80/80 tests** on current `main`, including lost responses, duplicate markers, wrong identity, policy denial, crash recovery, replay and adversarial cases.
