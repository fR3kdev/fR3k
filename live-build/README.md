# fR3k Live Build

[![LIVE](https://img.shields.io/badge/🔴_LIVE-YOUTUBE-ff1744?style=for-the-badge)](https://youtube.com/live/eY0ChQGaEe0?si=ihuGARaRKP5ENoDZ)
![Status](https://img.shields.io/badge/STATUS-BUILDING-5BE7FF?style=for-the-badge&labelColor=08101f)
![Mode](https://img.shields.io/badge/MODE-BUILD_IN_PUBLIC-9C5CFF?style=for-the-badge&labelColor=08101f)

> **This folder is the visible workbench for the Multi-App AI Agent Hackathon.**
>
> The root of the repo is the public fR3k code drop. This folder is where the competition build, reasoning, architecture, milestones, evidence, and evolving implementation plan are exposed live.

> **ACTIVE DIRECTIVE:** All execution is now hackathon-only. Read [HACKATHON_DIRECTIVE.md](HACKATHON_DIRECTIVE.md) before starting or delegating work.

For a plain-language explanation of the files and project, read [the project synopsis](SYNOPSIS.md).

The former Gmail/Google connector brief is superseded; the active GitHub-only scope is recorded in the directive. The [mission dashboard brief](DEVELOPMENT_PATHWAY_DASHBOARD.md) remains usable only when it directly advances the judged demo. The [completion ledger](COMPLETION.md) tracks verified state.

Read the [senior developer handoff manifest](HANDOFF_MANIFEST.md) for the checkout, current code, test evidence and known issues.

## What I’m building

One reusable **Agentic Decision & Action Engine** that can operate across four very different business worlds without turning into four unrelated chatbot demos.

Core loop:

`OBSERVE → MODEL STATE → PLAN → POLICY CHECK → ACT → OBSERVE AGAIN → EVALUATE → REPLAN / VERIFY → EVIDENCE`

The point is not to produce clever text. The point is to change state across real tools, verify the change, and leave receipts.

The first runnable vertical slice is the Arga Labs duplicate-charge mission: Support Desk → Billing → CRM. Run it with `cd agentic-action-engine && npm run demo`. It is a production-shaped local sandbox and every observation is explicitly labelled `SIMULATION_ONLY`; live external-app verification remains pending.

### Run the operator dashboard

```bash
cd agentic-action-engine
npm ci
npm run dashboard
```

Open the printed loopback URL. Select either independent Arga run and choose Resume.
Inspect the exact refund, approve it, then choose Resume separately. Repeat for the CRM update.
Compare runs after approving one and denying the other to inspect their recorded outcomes.
Both runs use the same planner; this is run comparison, not checkpoint replay or a model improvement claim.
The dashboard drives the real runtime with synthetic app state (`SIMULATION_ONLY`).
Each launch creates fresh runs and retains their trace directory; restarting does not recover the in-memory app state.

## Four worlds, one engine

| World | Mission | Proof of value |
|---|---|---|
| **Lemma** | detect semantic production failures and turn them into verified repairs + regressions | baseline fails, candidate passes, trace proves why |
| **Comma Capital** | convert a founder/company bottleneck into a ranked network intervention | diagnosis → helper ranking → approved intro → outcome memory |
| **Arga Labs** | reproduce agent failures in production-shaped sandboxes and turn them into regression gates | failure → sandbox twin → mutations → replay → CI guardrail |
| **Userlens** | choose bounded customer interventions from behavioral evidence and measure whether they worked | behavior → treatment → outcome → uplift/policy update |

Full version: [`PLAN.md`](PLAN.md)

## Shared runtime

The same primitives drive all four worlds:

- **Entity** — thing being reasoned about
- **State** — grounded facts, not model vibes
- **Goal** — explicit success + forbidden conditions
- **Event** — something that triggers work
- **Tool** — typed external capability
- **Memory** — prior observations, actions, and outcomes
- **Policy** — autonomy + risk constraints
- **Evaluator** — checks whether the action actually worked
- **Trace** — append-only evidence
- **Replay** — rerun from checkpoints under another model/policy/memory configuration

See [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Autonomy model

| Level | Meaning |
|---:|---|
| 0 | observe/read only |
| 1 | recommend |
| 2 | human approval required |
| 3 | bounded autonomy |
| 4 | autonomous inside a safe sandbox |
| X | prohibited |

Every write-capable tool should declare:

- autonomy class,
- reversibility,
- blast radius,
- idempotency strategy,
- verification method.

## Reference multi-app path

The judged demo will prove one coherent agent workflow across **at least three necessary external apps**.

The earlier Gmail/calendar route was rejected. App selection must follow a verified capability inventory and a written demo decision; connector availability alone is not a product idea. See the [active hackathon directive](HACKATHON_DIRECTIVE.md).

## Two-minute demo target

**0:00–0:20** — mission + architecture

**0:20–0:55** — agent observes state and diagnoses

**0:55–1:20** — policy gate blocks consequential action until approval

**1:20–1:40** — approved action executes + read-after-write verification

**1:40–2:00** — evaluator verdict + trace + replay comparison

## What viewers should watch for

The build is trying to make these things visible, not hidden behind a chat box:

- mission
- current plan
- tools used
- memory retrieved
- confidence
- autonomy level
- live trace
- verification result
- evaluator verdict
- replay / counterfactual comparison

## Live status

See [`STATUS.md`](STATUS.md) for the current build state and [`BUILD_LOG.md`](BUILD_LOG.md) for the chronological public log.

## Stream

**YouTube Live:** https://youtube.com/live/eY0ChQGaEe0?si=ihuGARaRKP5ENoDZ

This folder is intentionally public. The idea is that people can watch the system evolve instead of only seeing a polished demo at the end.
