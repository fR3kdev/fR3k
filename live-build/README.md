# fR3k Live Build

[![LIVE](https://img.shields.io/badge/🔴_LIVE-YOUTUBE-ff1744?style=for-the-badge)](https://youtube.com/live/xKOL36Yjs0U?feature=share)
![Status](https://img.shields.io/badge/STATUS-BUILDING-5BE7FF?style=for-the-badge&labelColor=08101f)
![Mode](https://img.shields.io/badge/MODE-BUILD_IN_PUBLIC-9C5CFF?style=for-the-badge&labelColor=08101f)

> **This folder is the visible workbench for the Multi-App AI Agent Hackathon.**
>
> The root of the repo is the public fR3k code drop. This folder is where the competition build, reasoning, architecture, milestones, evidence, and evolving implementation plan are exposed live.

> **ACTIVE DIRECTIVE:** All execution is now hackathon-only. Read [HACKATHON_DIRECTIVE.md](HACKATHON_DIRECTIVE.md) before starting or delegating work.

For a plain-language explanation of the files and project, read [the project synopsis](SYNOPSIS.md).

The former Gmail/Google connector brief is superseded. The current judged path uses YouTube, GitHub and ntfy, as recorded in the directive; GitHub-only work was an earlier delivery scope. The [mission dashboard brief](DEVELOPMENT_PATHWAY_DASHBOARD.md) remains usable only when it directly advances the judged demo. The [completion ledger](COMPLETION.md) tracks verified state.

Read the [current developer handover](DEVELOPER_HANDOVER.md) for delivered commits, reproduction commands, verification evidence and the remaining implementation work. The [earlier handoff manifest](HANDOFF_MANIFEST.md) is historical.

## What I’m building

One reusable **Agentic Decision & Action Engine** that can operate across four very different business worlds without turning into four unrelated chatbot demos.

Core loop:

`OBSERVE → MODEL STATE → PLAN → POLICY CHECK → ACT → OBSERVE AGAIN → EVALUATE → REPLAN / VERIFY → EVIDENCE`

The point is not to produce clever text. The point is to change state across real tools, verify the change, and leave receipts.

The judged live slice is now **YouTube → GitHub → ntfy → GitHub evidence**. `npm run demo:live` reads the real stream and canonical issue, gates both external writes behind exact operator approval, performs read-after-write verification, and leaves a hash-chained trace. The verified run reached **`CONFIRMED_SUCCESS` with evaluator score 1.00**. Arga Support Desk → Billing → CRM remains the hardened `SIMULATION_ONLY` regression fixture behind `npm run demo`.

For prerequisites, credentials and the distinction between `demo-live` and `demo:live`, see the [runtime guide](../agentic-action-engine/README.md).

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

Arga is implemented as a sandbox; Lemma, Comma Capital and Userlens remain planned extensions. Full version: [`PLAN.md`](PLAN.md)

## Shared runtime

The shared runtime provides the foundation for these worlds:

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

The judged demo now has one coherent workflow across **three real external apps**: YouTube supplies live incident state, GitHub supplies canonical task/evidence state, and ntfy supplies the operator notification channel. GitHub then receives the verified evidence receipt. The earlier Gmail/calendar route remains rejected. See the [live evidence record](evidence/LIVE_MISSION_2026-09-14.md) and [active directive](HACKATHON_DIRECTIVE.md).

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

**YouTube Live:** https://youtube.com/live/xKOL36Yjs0U?feature=share

This folder is intentionally public. The idea is that people can watch the system evolve instead of only seeing a polished demo at the end.
