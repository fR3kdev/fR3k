# Live Build Plan

## Premise

Build **one serious agent runtime**, then prove it generalises across four different business worlds.

Specialist focus:

- Python / TypeScript
- LLM agents
- tool calling + MCP
- RAG
- event-driven workflows
- state machines
- vector / graph stores
- evaluation harnesses
- API integrations
- browser automation where appropriate

Hard requirement: avoid chatbot demos. The agent must **inspect state, reason, act, verify outcomes, and leave evidence**.

---

# Shared Agentic Decision & Action Engine

## Core primitives

`ENTITY · STATE · GOAL · EVENT · TOOLS · MEMORY · POLICY · EVALUATOR · TRACE`

## Runtime loop

`OBSERVE → MODEL STATE → PLAN → POLICY CHECK → ACT → OBSERVE AGAIN → EVALUATE → REPLAN / VERIFY → EVIDENCE`

## Why one engine

The challenge is more interesting if the same runtime can solve radically different tasks by swapping domain schemas, policies, tools, evaluators, and memory rather than rebuilding the orchestration layer four times.

---

# World 1 — Lemma

## Problem

Production AI agents can fail **semantically** while infrastructure still looks healthy. A tool call can succeed and the overall job can still be wrong.

## Mission

Turn a production failure into a reproducible, evidence-backed repair loop.

## Flow

1. ingest an incident / failed trace
2. retrieve representative nearby traces
3. identify the smallest failure pattern
4. generate a candidate repair
5. materialise the failure as a regression fixture
6. replay the baseline
7. replay the candidate
8. compare evaluator results
9. prepare a reviewable patch / PR
10. preserve evidence linking failure → repair → test

## Safety

- production inspection is read-only
- code change is reviewable
- no automatic merge/deploy
- evaluation result must be independent of the agent narrative

## Killer demo

Show the exact same failing scenario twice:

- **baseline:** fails
- **candidate:** passes

Then expose the trace delta and evaluator evidence proving why.

---

# World 2 — Comma Capital

## Problem

Founder problems, operator knowledge, relationships, prior interventions, conflicts, and outcomes are often scattered across people and tools.

## Mission

Convert a founder/company problem into a grounded bottleneck diagnosis, ranked operator/network intervention, approval-gated outreach, and measurable follow-through.

## Flow

1. inspect company state + founder problem statement
2. separate symptom from bottleneck
3. query a synthetic operator / relationship graph
4. retrieve analogous prior interventions
5. rank helpers with transparent scoring
6. expose why each candidate ranked
7. draft the intro / outreach
8. require approval before external send
9. track acceptance + follow-up
10. record outcome back into intervention memory

## Ranking inputs

- domain fit
- stage fit
- prior outcome quality
- relationship distance
- conflict flags
- operator overuse / load
- urgency fit

## Killer demo

The model does **not** jump directly to “here are three people.”

It first shows:

`founder statement → diagnosed bottleneck → evidence → ranked network intervention`

Then approval unlocks the external action.

---

# World 3 — Arga Labs

## Problem

Agents need realistic environments where difficult multi-app failures can be reproduced safely, mutated, replayed, and converted into deterministic regression gates.

## Mission

Take an enterprise-agent failure, rebuild it in a production-shaped sandbox, generate targeted variants, replay agent revisions, and promote the failure into a durable regression suite.

## Canonical scenario

> Resolve a duplicate customer charge, notify the account owner, update CRM state, and document the incident.

## Flow

1. load sandbox transaction / CRM / support state
2. identify exact customer + target charge
3. check authorization threshold
4. require approval when policy says so
5. execute only against sandbox adapters
6. read the target record back
7. update dependent systems
8. independently evaluate final state
9. mutate the scenario
10. replay baseline vs candidate agent
11. promote the failure into CI/regression coverage

## Adversarial variants

- prompt injection inside support notes
- partial refund
- wrong currency
- duplicate customer identities
- insufficient authorization
- stale CRM state
- transient tool failure
- ambiguous charge labels

## Killer demo

A failure is not merely shown. It becomes a **reusable test asset**.

`failure → sandbox twin → replay → evaluator → regression gate`

---

# World 4 — Userlens

## Problem

Product usage can reveal unmet workflows, but a useful adoption agent must learn **which intervention changes behaviour**, not merely generate a personalised email.

## Mission

Observe product behaviour, choose a bounded intervention, assign treatment/control, measure downstream behaviour, and update the intervention policy from outcomes.

## Flow

1. inspect account + usage state
2. infer unmet workflow from behavioural evidence
3. retrieve similar historical cases
4. generate candidate interventions
5. apply exposure / risk policy
6. assign control / generic / personalised treatment
7. trigger communication or product action
8. observe downstream behaviour
9. estimate treatment effect
10. update intervention memory / policy

## Guardrails

- bounded cohort size
- exposure limits
- no silent escalation
- observable baseline/control
- outcome measured after action

## Killer demo

Show that the agent selected an intervention **because of observed behaviour**, then show whether the behaviour changed compared with baseline/control.

---

# Autonomy Model

| Class | Behaviour |
|---:|---|
| 0 | observe only |
| 1 | recommend |
| 2 | human approval |
| 3 | bounded autonomy |
| 4 | autonomous inside safe sandbox |
| X | prohibited |

Every tool call should carry:

```text
autonomy_class
reversible
blast_radius
idempotency_strategy
verification_method
```

Consequential external actions must never be unlocked solely by prompt wording.

---

# Replay / Counterfactual Layer

One of the strongest parts of the platform is the ability to rerun a mission under different conditions.

Examples:

- GPT-5.6 vs another model
- current policy vs stricter policy
- memory vs no memory
- baseline agent vs candidate revision
- replay from step N
- approval granted vs denied

Compare:

- goal success
- evaluator score
- number of steps
- tool calls
- cost
- latency
- policy violations
- confidence
- unnecessary actions

The objective is to make this an **agent platform**, not a one-off agent.

---

# Open-Core Boundary

## Public

The hackathon implementation should expose enough to reproduce the demos:

- runtime + state machine
- typed tool registry
- autonomy / policy engine
- trace + evidence format
- approval checkpoints
- baseline memory / retrieval
- replay
- synthetic world fixtures
- baseline evaluators
- adversarial cases
- connector interfaces
- tests
- local dashboard / demo UI

## Potential future paid layer

Only things dominated by scale, proprietary data, or enterprise operations belong above the open line:

- hosted multi-tenant control plane
- SSO / RBAC / enterprise admin
- licensed data connectors
- high-volume eval/replay fleets
- proprietary graph enrichment
- advanced causal/uplift optimisation
- retention/compliance operations
- SLA-backed support

Safety checks, traces, baseline evals, and local replay stay public.

---

# Reference Multi-App Demo

The judged reference path should be **one coherent workflow across 3+ apps**:

`GitHub → Google Drive / Sheets → Gmail → optional Google Calendar`

### Roles

**GitHub**
- mission intake
- durable evidence record
- task state

**Drive / Sheets**
- structured state
- source documents
- domain fixtures

**Gmail**
- approval-gated outbound action

**Calendar**
- verifiable follow-through

The four worlds sit above this common execution/evidence layer.

---

# Demo UI

The live interface should prioritise state and evidence, not a giant chat window.

Show:

- MISSION
- CURRENT PLAN
- CURRENT STATE
- EVIDENCE
- TOOLS USED
- MEMORY RETRIEVED
- CONFIDENCE
- AUTONOMY LEVEL
- APPROVAL GATE
- LIVE TRACE
- EVALUATOR RESULT
- REPLAY / COUNTERFACTUAL

If a viewer cannot tell what the agent is doing, why it is allowed, and whether it actually worked, the UI has failed.
