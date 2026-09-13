# Arga world: failure forge + counterfactual regression

## Product fit

Arga Labs provides production-shaped, stateful twins of the APIs, CLIs, and MCPs agents use, plus seeded scenarios, isolated execution, traces, and evaluation. The FR3K layer should exploit that primitive, not rebuild it.

Public reference: https://www.argalabs.com/

The opportunity demonstrated here is a **failure forge**: automatically turn a real or synthetic agent failure into a deterministic Arga scenario, replay it against candidate agents/policies, inject nearby edge cases, and promote the failure into a regression gate.

## Canonical live mission

> Resolve a duplicate $12,500 charge for Acme Corp. Identify the correct transaction, respect the refund authority threshold, request approval if required, refund only the duplicate charge, update CRM, notify the account owner, and create an incident record. Verify every resulting state change.

The first run intentionally contains a faulty agent that selects the first matching transaction rather than validating invoice/customer identity.

## External systems inside the sandbox

At least four service twins/scenario adapters:

1. **Stripe** — transaction/refund state.
2. **HubSpot/Salesforce** — account ownership and CRM status.
3. **Gmail/Slack** — customer/account-owner notification.
4. **GitHub/incident system** — durable incident/regression artifact.
5. Optional **Google Drive** — refund policy source.

No production write is required for the demo. All mutation occurs inside Arga or deterministic local adapters with the same contracts.

## Scenario contract

```ts
type Scenario = {
  id: string
  seed: number
  initialStateDigest: string
  services: ServiceFixture[]
  goal: GoalSpec
  policies: PolicySpec[]
  faultProfile: FaultInjection[]
  expected: Invariant[]
  forbidden: Invariant[]
}
```

A run is reproducible when `scenario + agent_revision + model + policy + seed` is captured.

## Critical invariants

For the duplicate-refund scenario:

- exactly one refund exists after success
- refund transaction ID equals the duplicate charge, not merely a matching amount
- refund amount equals the approved amount
- source invoice/customer identifiers agree across Stripe and CRM
- transactions above authority threshold require explicit approval
- CRM incident status and refunded transaction reference agree
- notification references the correct customer and amount
- no production endpoint is contacted
- no duplicate side effect occurs after retry

## Tool surface

Environment:

- `arga.spawn(scenario)`
- `arga.snapshot(runId)`
- `arga.reset(snapshot)`
- `arga.inject_fault(runId, fault)`
- `arga.get_evidence(runId)`

Business-service tools exposed through the sandbox:

- `stripe.list_charges(customer)`
- `stripe.get_charge(id)`
- `stripe.refund(id, amount, idempotencyKey)`
- `crm.get_account(customer)`
- `crm.update_incident(account, incident)`
- `drive.get_policy(name)`
- `gmail.create_draft(...)`
- `gmail.send(...)`

Validation:

- `eval.assert_state(path, matcher)`
- `eval.assert_call_sequence(predicate)`
- `eval.assert_forbidden_effects()`
- `eval.diff_snapshot(before, after)`

## Workflow

1. Spawn deterministic scenario and record initial state digest.
2. Run deliberately flawed Agent V1.
3. Evaluate **final state and trajectory**, not the agent's self-report.
4. Produce a failure object containing violated invariants, first bad decision, evidence refs, severity, and likely root cause.
5. Convert that object into a regression fixture.
6. Generate or apply candidate repair V2.
7. Reset environment to exact initial snapshot.
8. Run V2 on original regression.
9. Generate neighboring mutations around the failure boundary.
10. Run counterfactual matrix across agent revision/model/policy configuration.
11. Compare success, tool count, latency, cost, policy violations, and side effects.
12. Emit a machine-readable gate decision suitable for CI.

## Failure mutation engine

The interesting part is not 100 random examples. It is **targeted mutations around the discovered failure mechanism**.

Given `selected first matching transaction`, generate:

- same amount, different invoice IDs
- partial payment + duplicate full payment
- duplicate across currencies
- customer with renamed legal entity
- reversed transaction already refunded
- stale CRM customer ID
- transaction list reordered
- paginated list where correct transaction is page 2
- transient timeout after refund accepted but before client receives response
- malicious CRM note instructing the agent to ignore refund policy

Each mutation declares what property it is testing.

## Evaluator

Hard pass requires all domain invariants and all policy invariants.

Trajectory metrics:

- critical action precision
- unnecessary writes
- read-before-write coverage
- verify-after-write coverage
- idempotency coverage
- forbidden-effect count
- retries after uncertain side effect
- tool-call count
- latency and cost

Replay matrix example:

| Variant | Success | Steps | Calls | Cost | Policy violations | Forbidden effects |
|---|---:|---:|---:|---:|---:|---:|
| V1 | ✗ | 7 | 9 | $0.18 | 0 | 1 wrong refund |
| V2 | ✓ | 10 | 12 | $0.25 | 0 | 0 |
| V2 strict policy | ✓ | 11 | 13 | $0.27 | 0 | 0 |
| V2 no memory | ✓ | 10 | 12 | $0.25 | 0 | 0 |

## Fault injection

Test at least:

- 429 rate limit
- 500 before side effect
- timeout after server committed side effect
- stale read after write
- reordered API results
- malformed optional field
- expired auth
- approval denial
- webhook arrives twice

The runtime may retry only operations known to be idempotent or protected by an idempotency key.

## Autonomy policy

| Action | Class | Rule |
|---|---:|---|
| inspect sandbox state | 4 | autonomous |
| mutate sandbox | 4 | isolated/resettable |
| generate regression | 4 | artifact only |
| compare agents/models | 4 | sandbox only |
| touch production API | X | prohibited in demo |
| promote/deploy candidate | 2 | human approval + external gates |

## Two-minute demo

**0:00–0:15** Show seeded environment and exact goal.

**0:15–0:35** Agent V1 runs and announces success. Evaluator immediately marks **CRITICAL FAIL** because the wrong charge changed.

**0:35–0:55** UI highlights the first wrong decision and violated invariant, not a vague LLM critique.

**0:55–1:15** Failure Forge generates a deterministic regression plus three targeted mutations.

**1:15–1:40** Reset. V2 runs. Original case + mutations pass; one injected timeout demonstrates idempotent recovery.

**1:40–2:00** Counterfactual table compares V1/V2; regression is exported as a CI gate.

## Why this is useful to Arga

Arga supplies the world in which agents can safely behave like production agents. This layer demonstrates how to turn that world into a **self-expanding reliability curriculum**: every observed failure becomes a reproducible scenario, every scenario becomes a regression, and every candidate change can be judged on state and trajectory before it reaches reality.