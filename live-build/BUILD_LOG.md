# Public Build Log

This is the watcher-facing record of what changed during the live build.

It is intentionally plain: timestamp / change / evidence / next move.

---

## 2026-09-14 — local runtime foundation and isolated development briefs

- Saved the plain-language [synopsis](SYNOPSIS.md) in the primary checkout and linked it from the README.
- Added typed tool contracts, strict runtime schemas, policy checks, exact-action approvals, a durable JSONL journal, baseline memory retrieval, independent evaluation and bounded replanning under `agentic-action-engine/src/`.
- Added 28 behavioral tests covering approval/restart, denial/expiry, uncertain writes, provider-key retries, schema/evidence failures, budget limits, journal corruption and concurrent writers. All 28 pass locally; TypeScript checking also passes.
- Saved separate [connector](DEVELOPMENT_PATHWAY_CONNECTORS.md) and [dashboard](DEVELOPMENT_PATHWAY_DASHBOARD.md) development assignments with disjoint ownership, snapshot isolation, interfaces, tests and handoff gates.
- These changes are local and not published. Synthetic runtime tests do not establish a live three-app mission. Live adapters, process-crash recovery, replay, dashboard and full domain scenarios remain outstanding; see the [completion ledger](COMPLETION.md).

### Next

Finish durable recovery and runnable mission/replay entry points, then integrate the isolated connector and dashboard deliveries with the four domain scenarios and validate the full workflow.

---

## 2026-09-14 — public build workspace created

### Changed

- restored the root repository to its intended role as the **fR3k public code drop**;
- kept the Qwen 35B-A3B / 4 GB VRAM giveaway as the headline artifact;
- added the cyberpunk repo hero;
- separated the hackathon build into `live-build/`;
- published the four-world plan inside the live-build workspace;
- published the shared runtime architecture;
- added a status board that distinguishes verified work from planned work.

### Why

The root repo should stay useful to anyone landing on it.

The competition build needs a different surface: one that can expose the evolving mission, architecture, evidence, failures, and decisions without turning the repo landing page into a strategy document.

### Current architectural thesis

One engine, four worlds:

`OBSERVE → MODEL STATE → PLAN → POLICY CHECK → ACT → OBSERVE AGAIN → EVALUATE → REPLAN / VERIFY → EVIDENCE`

### Current execution target

Prove one mission across at least three external apps before expanding the four domain worlds.

Target path:

`GitHub → Google Drive / Sheets → Gmail → optional Calendar`

### Next

1. implement core runtime contracts;
2. add append-only trace;
3. implement policy/autonomy gate;
4. wire one external connector path;
5. create one deliberately failing scenario;
6. prove evaluator + replay on that failure;
7. surface it all in a live dashboard.

---

## 2026-09-14 — Arga Labs three-app sandbox vertical slice

- Recorded the capability inventory and mission decision in [`HACKATHON_DIRECTIVE.md`](HACKATHON_DIRECTIVE.md).
- Added `agentic-action-engine/src/demo/arga-mission.ts`: Support Desk incident read, Billing charge read/refund, and CRM resolution tools through the real `Runtime` and `ToolRegistry`.
- Added `src/cli.ts`; `npm run demo` exercises the mission, pauses at both exact approval gates, performs read-after-write verification, and prints an independent evaluator score of `1.00`.
- Added `tests/arga-mission.test.ts`; the test proves the unrelated charge is preserved and all tool evidence is labelled `SIMULATION_ONLY`.
- Verification: `npm test` = 29 passed, `npm run typecheck` = passed, `npm run demo` = exit 0. This is a local sandbox proof, not live external-app evidence.

### Next

Implement replay/counterfactual support and the local dashboard, then pursue a separately approved live-app capability path. Do not treat the sandbox mission as completion of the external three-app gate.

---

## Logging rule

Future entries should record concrete changes, not hype.

Good entry:

> `policy.engine.ts` now blocks outbound writes above autonomy level 1 without an approval token. Unit test covers allow / require-approval / deny.

Bad entry:

> Agent safety is complete.

If there is no test, state observation, trace, commit, or reproducible artifact behind a claim, label it accordingly.
