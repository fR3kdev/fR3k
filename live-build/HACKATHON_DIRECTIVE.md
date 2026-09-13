# HACKATHON-ONLY EXECUTION DIRECTIVE

**Status: ACTIVE — highest priority**

## Judged live mission verified — 2026-09-14

The headline judged path is now **YouTube → GitHub → ntfy → GitHub evidence**. This supersedes the earlier statement that live three-app selection was still gated.

Verified run `live-incident-1789331116305` reached `CONFIRMED_SUCCESS` / evaluator `1.00`. YouTube live state and GitHub issue #1 were observed before any write. The ntfy notification and GitHub evidence comment each required an exact operator approval and were independently read back. Evidence comment: https://github.com/fR3kdev/fR3k/issues/1#issuecomment-5655933189.

The Arga Support/Billing/CRM path remains a valuable `SIMULATION_ONLY` reliability fixture, not the headline external-app proof.

The earlier mission and delivery sections below preserve the sequence of decisions. Their capability inventories and uncompleted gates describe those earlier stages, not the current live path.

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

## Historical first mission decision — 2026-09-14

Capability inventory observed before implementation:

| Capability | Evidence | Boundary |
|---|---|---|
| GitHub API / repository access | authenticated `gh auth status`; active `fr3k-d3v` account has `repo` and `workflow` scopes | live reads/writes require a separately configured allowlist and approval |
| Google Workspace | no Google credential environment or OAuth grant observed | not available for live verification; Gmail/Calendar remain rejected |
| Local runtime | `agentic-action-engine/` typechecks and 28 behavior tests pass | synthetic sandbox is not external-app evidence |

The first vertical slice is the **Arga Labs duplicate-charge incident mission**. It uses three necessary app boundaries in a production-shaped local sandbox:

1. Support Desk: read the incident and customer identity.
2. Billing: read the target charge and perform the approved refund.
3. CRM: update the incident status after the refund and verify the exact record.

The mission succeeds only when the runtime observes the incident and charge, pauses before each consequential write, executes after an exact operator approval, reads both write results back, and an independent evaluator checks the final Billing and CRM state plus preservation of an unrelated charge. All sandbox observations are labelled `SIMULATION_ONLY`; this does not claim live external-app completion. Live connector selection remains a separate gate requiring verified credentials, resource allowlists and approved test actions.

## Scope guard

The mission is now recorded. Implementation may proceed on this vertical slice and its tests, while live external-app work remains gated by capability and approval evidence. Do not authenticate Gmail or Calendar or revive the rejected route.

## Completion evidence

A task is complete only when the repository records the commit, tests actually run, live app read/write/read-back evidence where applicable, known limitations and exact demo steps.

## Historical concurrent delivery scope — 2026-09-14

The user requested both development jobs concurrently, integrated to `main`.
The shared baseline is `ab2be86`. Jobs use isolated Git worktrees because the runtime is now committed.

- Connectors: implement the observed GitHub capability only (`github.read_issue` and `github.write_evidence`), with injected credentials, repository allowlists, exact read-back and reconciliation tests. This is supporting infrastructure; no live three-app workflow or external write is authorized by this implementation assignment.
- Dashboard: implement the local mission and exact-action approval interface, then connect it to the existing Arga runtime. The host supplies operator identity; approval and resume remain separate operations.
- Main integration: run combined tests, typecheck and sandbox demo, add runtime CI, review and publish both deliveries to `main`.

Acceptance is contract-tested GitHub adapters plus a browser-verified dashboard operating the real sandbox runtime. Live external-app verification, checkpoint replay and process-crash recovery remain separate gates. Gmail and Calendar remain excluded.
