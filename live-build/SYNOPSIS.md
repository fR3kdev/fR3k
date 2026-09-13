# fR3k Live Build — Project Synopsis

## What we are building

We are building one reusable AI agent engine that carries out work across several apps, checks that the work succeeded, and records the evidence. This is the competition project for the Multi-App AI Agent Hackathon.

The engine accepts a mission, reads relevant information, proposes a plan, checks whether its actions are permitted, uses external tools, and inspects the resulting state. An independent evaluator checks the outcome. A trace records the run, and replay allows comparisons between different agent revisions, models, or policies.

The intended loop is:

**Observe → understand the situation → plan → check permission → act → read back the result → evaluate → replan or finish → record evidence.**

## What the files mean

| File | Purpose |
|---|---|
| [README.md](README.md) | The introduction: project purpose, use cases, shared concepts, and intended demo. |
| [PLAN.md](PLAN.md) | The product plan: problems to solve, workflows, safety boundaries, and what success should look like. |
| [ARCHITECTURE.md](ARCHITECTURE.md) | The engineering design: orchestration, tool contracts, permissions, memory, verification, traces, and replay. |
| [STATUS.md](STATUS.md) | The progress board: what exists, what is being built, what remains untested, and the completion criteria. |
| [BUILD_LOG.md](BUILD_LOG.md) | The history: what changed, why it changed, supporting evidence, and the next step. |

This synopsis is a plain-language guide to those documents. The status board remains the place to check current progress.

## One engine, four use cases

| World | Intended job | Evidence of success |
|---|---|---|
| **Lemma** | Investigate production AI-agent failures and prepare repairs. | The original scenario fails, the repaired version passes, and a regression test captures the difference. |
| **Comma Capital** | Diagnose a founder's business bottleneck and match them with suitable operators or contacts. | A grounded diagnosis, an explained ranking, approved outreach, and a recorded outcome. |
| **Arga Labs** | Reproduce enterprise-agent failures in a sandbox and turn them into repeatable tests. | A reproduced failure, replay comparisons, and a regression gate that detects the problem. |
| **Userlens** | Choose customer-adoption interventions from observed product usage and measure their effect. | Outcomes compared with a baseline or control group, informing later intervention choices. |

These use cases share the execution machinery. Each supplies its own data, tools, rules, memory, and success checks. The implemented core runtime uses TypeScript; Python is reserved for analysis or evaluation where it adds value.

## The verified live mission

The judged workflow is **YouTube → GitHub → ntfy → GitHub evidence**:

1. Read the exact YouTube stream state.
2. Read the canonical GitHub incident issue.
3. Propose an operator notification and require exact approval.
4. Publish through ntfy and read back the matching receipt.
5. Require a second exact approval, append evidence to GitHub, and read the comment back.
6. Independently evaluate the outcome and retain the execution trace.

Run `live-incident-1789331116305` completed on 2026-09-14 with `CONFIRMED_SUCCESS`, score **1.00**, and **7/7 checks passed**. The [evidence record](evidence/LIVE_MISSION_2026-09-14.md) also documents delayed ntfy receipt visibility and verifier-only reconciliation without a duplicate notification. The earlier Gmail/calendar route is rejected; see [HACKATHON_DIRECTIVE.md](HACKATHON_DIRECTIVE.md).

## Current state and repository context

At submission baseline `f488f55`, the published engine includes typed tools, policy and exact approvals, hash-chained traces, independent evaluation, durable outcome memory, Arga replay, eight adversarial variants, and the live three-app mission. The integration suite passes **80 tests**; the historical mission/video snapshot reports **77** before subsequent hardening tests.

The local dashboard controls the Arga sandbox and is browser-verified there. Live-provider dashboard control, measured confidence/cost/latency, and a verified model-backed planner run remain open. The shipped demos use deterministic planners; the bounded model-provider interface requires explicit host wiring. Lemma, Comma Capital and Userlens remain planned domain extensions. See [STATUS.md](STATUS.md) and [COMPLETION.md](COMPLETION.md) for scope and evidence.

Start with the [runtime guide](../agentic-action-engine/README.md) for installation and commands, or the [submission bundle](../submission/README.md) for the video and brief.

The wider repository is a public code collection. Its [Qwen benchmark kit](../qwen-35b-on-4gb/README.md) and [cost router](../router.py) are separate code drops. The [root README](../README.md) explains that broader context.
