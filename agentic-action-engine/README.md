# FR3K Agentic Action Engine

A public, evidence-first runtime for **agents that inspect state, reason, take bounded actions across multiple external apps, and verify the result**.

This repository is being prepared for the 2026 Multi-App AI Agent Hackathon. The contest build window is intentionally respected: this initial commit contains the public architecture, demo contracts, reliability criteria, and four domain worlds, but **no contest implementation code**.

## What gets built after the starting gun

One reusable agent runtime, four domain worlds:

- **Lemma** — investment-thesis monitoring and valuation impact.
- **Comma Capital** — portfolio support and operator matching.
- **Arga Labs** — sandboxed enterprise task execution, evaluation, replay, and regression generation.
- **Userlens** — customer-adoption interventions with measurable treatment effects.

The core loop is:

`OBSERVE → MODEL STATE → PLAN → POLICY CHECK → ACT → OBSERVE AGAIN → EVALUATE → REPLAN/VERIFY → EVIDENCE`

This is not a chatbot demo. A successful run must leave behind a machine-readable trace showing what the agent believed, which tool it selected, what changed, whether the change was allowed, and how the result was verified.

## Contest reference path

The first live end-to-end path will use at least three real external apps. The reference target is:

1. **GitHub** — mission intake, durable task/evidence record.
2. **Google Sheets / Drive** — structured domain state and source artifacts.
3. **Gmail** — approval-gated outbound communication.
4. **Google Calendar** — follow-through when an intervention is accepted.

Domain-specific adapters can later add Stripe, HubSpot, market-data/filing feeds, product analytics, Slack, and MCP servers without changing the runtime.

## Runtime primitives

- `Entity` — the thing the agent is reasoning about.
- `State` — grounded facts currently known.
- `Goal` — explicit success criteria.
- `Event` — a change that can trigger work.
- `Tool` — a typed, permissioned external capability.
- `Memory` — prior observations, actions, and outcomes.
- `Policy` — autonomy and risk constraints.
- `Evaluator` — checks whether the action actually worked.
- `Trace` — append-only evidence of decisions and side effects.
- `Replay` — rerun from a checkpoint with another model/policy/memory configuration.

## Autonomy classes

| Level | Meaning | Example |
|---|---|---|
| 0 | Observe only | Read a filing or CRM record |
| 1 | Recommend | Propose a DCF change |
| 2 | Human approval required | Send an operator-intro request |
| 3 | Bounded autonomy | Send to a tiny approved cohort |
| 4 | Autonomous in sandbox | Execute/reset/replay synthetic enterprise tasks |
| X | Prohibited | Trading securities or unbounded destructive actions |

Every tool call declares an autonomy class, reversibility, blast radius, and verification method.

## Open-source promise

The public repo will contain everything required to understand and reproduce the hackathon demos: runtime contracts, state machine, policy checks, traces, replay, synthetic fixtures, baseline evaluators, connector interfaces, tests, and the four world packs.

Commercial work, if it exists later, belongs **above** that line: hosted multi-tenant operations, enterprise auth/admin, production-grade licensed-data connectors, large-scale replay/eval farms, advanced proprietary graph enrichment, and higher-end causal optimisation. Safety, auditability, and the core demos stay public.

See `docs/ARCHITECTURE.md`, `docs/RELIABILITY.md`, `docs/OPEN_CORE_BOUNDARY.md`, and each `worlds/*/README.md`.
