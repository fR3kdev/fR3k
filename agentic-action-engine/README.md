# FR3K Agentic Action Engine

> **One runtime. Four worlds. Actions that can prove they worked.**

A public TypeScript/Python agent platform for the 2026 Multi-App AI Agent Hackathon. It is built around a simple rule: **an agent does not get credit for saying it completed a task. It must leave observable external state and evidence that an independent evaluator can verify.**

## The control loop

`OBSERVE → GROUND STATE → PLAN → POLICY CHECK → ACT → READ BACK → EVALUATE → REPLAN / VERIFY → EVIDENCE`

Not a chat wrapper. Not a chain-of-thought theater. The interesting object is the state transition.

## Four company worlds

| World | Core problem | FR3K capability |
|---|---|---|
| **Lemma AI** | production agents fail semantically while tools/logs look healthy | incident → representative traces → minimal repair → regression → PR → replay/eval |
| **Comma Capital** | founder/network knowledge is scattered and outcomes are rarely captured structurally | founder need → bottleneck diagnosis → helper ranking → approved intro → measured intervention memory |
| **Arga Labs** | agents need production-shaped worlds where failure can be reproduced safely | failure → deterministic sandbox scenario → targeted mutations → counterfactual replay → CI regression gate |
| **Userlens** | customer behavior can suggest next actions, but interventions need measurable learning | behavior → treatment policy → bounded action → outcome/guardrails → uplift → policy update |

See [`docs/COMPANY_FIT.md`](docs/COMPANY_FIT.md) for the grounding and each `worlds/*/SPEC.md` for the full build contract.

## The judged reference demo

The contest asks for one useful, multi-step agent connected to at least three external apps. The primary demo is therefore **one reliability/action loop**, not four unrelated demos:

1. a mission/failure enters through **GitHub** or a domain event;
2. the agent reads grounded state from **Google Drive/Sheets or domain APIs**;
3. it prepares an action in **Gmail/Slack** behind a visible approval gate;
4. accepted follow-through can create **Google Calendar** state;
5. it re-reads every write, evaluates invariants, and stores the evidence trace.

The four worlds are configurations of that engine and prove it generalizes.

## Non-negotiable runtime primitives

- **Entity** — what is being acted on.
- **Observation** — source-backed fact with evidence state.
- **State** — reducer output from observations, never free-floating model memory.
- **Goal** — explicit success and forbidden conditions.
- **ActionIntent** — typed proposed side effect before execution.
- **PolicyDecision** — allow / require approval / deny, with reason.
- **Tool** — typed capability with side-effect and idempotency metadata.
- **Verification** — read-after-write or invariant check.
- **Evaluator** — independent grader of final state and trajectory.
- **Trace** — append-only event stream.
- **Replay** — rerun from a checkpoint with a different model/policy/memory/agent revision.

## Autonomy classes

| Level | Meaning | Typical example |
|---:|---|---|
| 0 | observe only | production API/trace access |
| 1 | recommend | valuation/policy/change suggestion |
| 2 | explicit approval | send external message, merge/deploy |
| 3 | bounded reversible action | create branch, draft, sandbox write |
| 4 | autonomous inside safe boundary | analysis, replay, sandbox execution |
| X | prohibited | unbounded destructive action / bypass controls |

Every write-capable tool declares blast radius, reversibility, idempotency strategy, and verification method.

## Evidence states

`VERIFIED · PARTIALLY_VERIFIED · INFERRED · UNKNOWN · CONTRADICTED · SIMULATION_ONLY · NOT_TESTED`

These states are carried through the UI and trace. A queued action is not silently promoted to VERIFIED.

## Public vs future commercial layer

The public project keeps the pieces needed to understand, run, inspect, and verify the demos: state machine, policies, traces, replay, evaluators, synthetic fixtures, safe connectors, tests, and all four world packs.

Potential paid value belongs above that line: managed multi-tenancy, enterprise SSO/RBAC, licensed datasets/connectors, large replay/eval fleets, proprietary graph enrichment, advanced causal optimisation, retention/compliance operations, and SLA-backed deployment.

Safety and auditability are **not** premium features.

## Read next

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — runtime contracts and state machine
- [`docs/RELIABILITY.md`](docs/RELIABILITY.md) — failure semantics, verification, retries, evals
- [`docs/JUDGING_SCORECARD.md`](docs/JUDGING_SCORECARD.md) — mapping to the official rubric
- [`docs/COMPETITION_BRIEF.md`](docs/COMPETITION_BRIEF.md) — two-minute reference demo
- [`worlds/lemma/SPEC.md`](worlds/lemma/SPEC.md)
- [`worlds/comma/SPEC.md`](worlds/comma/SPEC.md)
- [`worlds/arga/SPEC.md`](worlds/arga/SPEC.md)
- [`worlds/userlens/SPEC.md`](worlds/userlens/SPEC.md)

## Build philosophy

Make every important claim clickable back to evidence. Make every consequential action stoppable. Make every failure reusable as a test. Make the UI show the work, not just the answer.