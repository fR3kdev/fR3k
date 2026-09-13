# HACKATHON-ONLY EXECUTION DIRECTIVE

**Status: ACTIVE — highest priority**

## Immediate instruction

All GPD/Hermes development work unrelated to the Multi-App AI Agent Hackathon is paused. Preserve existing branches, working trees, logs and evidence; do not discard or overwrite unrelated work.

The only active engineering objective is to produce the strongest working, verifiable hackathon submission from this repository.

## Rejected direction

The previously proposed `GitHub → Google Drive / Sheets → Gmail → Calendar` workflow is **not the product plan**.

- Do not authenticate Gmail or Google Calendar.
- Do not build email/calendar adapters.
- Do not use generic connector count as the product premise.
- Existing documents describing that route are historical/superseded unless updated to point here.

## Current build target

Build and demonstrate one coherent agent that:

1. uses at least three external apps because each is necessary to the workflow;
2. solves a clear user problem instead of acting as a connector demo;
3. observes current state, reasons, acts, verifies the result and records evidence;
4. has a sharp live demonstration with visible state, decisions, actions and proof;
5. reuses the tested runtime already present under `agentic-action-engine/`.

## Execution order

1. Stop or checkpoint unrelated GPD/Hermes jobs safely.
2. Pull `main` and inspect this directive before accepting new work.
3. Inventory authenticated apps and working code already available.
4. Choose the strongest three-app workflow from observed capability and the hackathon brief.
5. Write the chosen mission and acceptance tests into this file or a linked issue before implementation.
6. Implement the thinnest end-to-end vertical slice.
7. Verify the real workflow, capture evidence and prepare the live demo.
8. Only then improve polish, secondary scenarios or reusable abstractions.

## Scope guard

Until the chosen mission is recorded, work is limited to preserving current state, validating the runtime, inventorying usable integrations and removing the rejected Gmail/calendar path. Do not invent another product direction without recording the decision and evidence.

## Completion evidence

A task is complete only when the repository records the commit, tests actually run, live app read/write/read-back evidence where applicable, known limitations and exact demo steps.
