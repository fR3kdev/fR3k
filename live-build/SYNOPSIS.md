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

These use cases share the execution machinery. Each supplies its own data, tools, rules, memory, and success checks. The planned core runtime uses TypeScript; Python is reserved for analysis or evaluation where it adds value.

## The first working milestone

The first target is one complete mission across **at least three necessary external apps**, selected from verified authenticated capabilities. The former Gmail/calendar route was rejected; see [HACKATHON_DIRECTIVE.md](HACKATHON_DIRECTIVE.md).

The final app roles will be recorded only after the capability inventory and demo decision. Each selected app must contribute an observable, verifiable step to the same useful workflow.

### Example intended workflow

This example describes planned behavior, not a demonstrated working integration:

1. A GitHub issue describes a founder's sales bottleneck.
2. The agent reads company context and potential helpers from Sheets or Drive.
3. It explains the bottleneck, ranks suitable helpers, and prepares an introduction.
4. A policy checkpoint requires human approval before sending.
5. After approval, the agent sends through Gmail and reads back the sent message to verify the action.
6. The evaluator checks the mission's criteria, and the trace records the decisions, approval, action, and result.

Verifying a sent introduction proves the communication action occurred. Acceptance and improvement in the founder's business require later observations; sending alone does not prove those outcomes.

The first milestone is complete when the mission runs across the apps, respects approval, verifies external state, produces an independent verdict, and leaves a trace that supports replay comparison. Expansion to all four use cases follows this foundation.

## Current state and repository context

As of **2026-09-14**, the published `live-build/` workspace contains the project documentation. Its status board marks the runtime, policy engine, trace, evaluator, replay, and GitHub runtime adapter as **BUILDING**. Google integrations, the dashboard, and the complete three-app mission are **NOT TESTED**. These labels do not establish that a working agent has been demonstrated.

The next implementation priorities are the core runtime, typed tools, permission checks, trace recording, evaluation, and one verified external-app workflow. Reliability scenarios and replay comparisons follow, then the dashboard and additional domain scenarios. See [STATUS.md](STATUS.md) for the detailed checklist.

The wider repository is a public code collection. Its [Qwen benchmark kit](../qwen-35b-on-4gb/README.md) and [cost router](../router.py) are separate existing code drops; they are not evidence that the live-build agent engine is implemented. The [root README](../README.md) explains that broader context.
