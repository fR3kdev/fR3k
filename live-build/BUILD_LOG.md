# Public Build Log

This is the watcher-facing record of what changed during the live build.

It is intentionally plain: timestamp / change / evidence / next move.

---

## 2026-09-14 — gap-fill: durable outcomes, bounded model planner, adversarial variants, live GitHub attach

- `src/memory/durable.ts` — `DurableMemoryStore`: append-only, fsynced, per-line SHA-256 hash-chained `memory.jsonl`; `open()` rejects any hash/ID mismatch so a fork or truncation fails closed; `persist()` is not observable until the line is on disk. The runtime now records the `outcome` of every terminal run the moment it happens, and a restarted process reconstructs it from the journal alone and seeds the next mission.
- `src/model/` — bounded model-driven planner: a `ModelPlannerProvider` only ever sees a trimmed, schema-valid `BoundedPlannerPrompt` snapshot (never the trusted ledger). `guardProviderDecision` rejects tools outside the mission policy, evidence refs that do not exist, over-budget refs, writes without observed evidence, and finishes with no evidence. `createFetchModelProvider` is the OpenAI-compatible wire path, and credentials **fail closed** (`missingModelCredentials`) — no key, no model run, no false claim.
- `src/demo/arga-variants.ts` — all eight PLAN.md adversarial variants as reproducible regression assets: prompt injection in support notes, partial refund, wrong currency, duplicate customer identities, insufficient authorization, stale CRM state, transient tool failure, ambiguous charge labels. Each mutates the canonical incident, runs the hardened agent, and asserts invariants; the partial-refund variant **caught a real bug** (the replay-safe refund reuse adopted a ¥150 partial refund as if it were the full ¥499) which is now fixed and covered.
- `src/live/github.ts` — live attach: token resolved from `GH_TOKEN`/`GITHUB_TOKEN` or `gh auth token` (fail-closed), read-only GitHub REST tools registered under environment `live`, writes never registered, policy pinned to `sandbox: false, maxWrites: 0`. `npm run demo-live` reached `CONFIRMED_SUCCESS` against `fR3kdev/fR3k` — repo info, recent commits and open issues all `VERIFIED`, score **1.00**.
- Verification: `npm test` = **70 passed**, typecheck passed, `npm run demo` exits 0 (outcome-reconstruction line + 8-variant adversarial panel all PASS), `npm run demo-live` exits 0. Arga sandbox and replay evidence remain `SIMULATION_ONLY`; the live GitHub read attach is the one live external path.

### Next

Publish from `main` after CI confirmation; then keep the live read-only attach as the demo anchor and (if a second live app becomes available) extend the same read-path evidence pattern before any operator-gated write.

---

## 2026-09-14 — gap-fill: crash recovery, replay, and hardened Arga evidence

- Hardened `src/trace/jsonl.ts`: stale-lock recovery for provably dead owner PIDs (live owners stay busy), and an audited `repairTail(runId)` that snapshots the original bytes, truncates only the uncommitted journal tail, and refuses to touch a corrupted committed prefix.
- Runtime (`src/core/orchestrator.ts`): `timed()` deadline that raises `HangError` for planner/tool/evaluator hangs; approval validity rechecked immediately before every write attempt; `recover()` grants an audited, bounded read budget after a `TOOL_UNAVAILABLE`; approval digests now bind the tool implementation `revision` so a deploy under a pending action invalidates it.
- `src/core/state-machine.ts`: an `approval.denied` is authoritative even when the process died before the terminal status append.
- `src/eval/evaluator.ts`: a final-state claim about a run that performed writes must cite a confirmed read-back for each written tool.
- Arga mission (`src/demo/arga-mission.ts`): v2 planner/evaluator prove duplicity from the raw payment ledger, persist durable refund records, bind exact customer/amount/currency, read back the unrelated CHG-89, and `reconstructArgaState` rebuilds app state from the journal; refunds are replay-safe (no second refund after recovery).
- Added `src/demo/replay-bridge.ts`: crash replay re-runs the same planner/evaluator against rebuilt state; counterfactual runs an alternative design and diffs which checks each evaluated. `src/cli.ts` now prints live result, replay, and counterfactual.
- Verification: `npm test` = **55 passed**, typecheck passed, `npm run demo` exits 0 with replay candidate `CONFIRMED_SUCCESS` (score 1.00, zero regressions) and the v1 counterfactual that never evaluates duplicate-proven / unrelated-preserved / incident-grounded. Still `SIMULATION_ONLY`; no live external apps were touched.

### Next

Resolve the live three-app gate, add the model-driven planner, durable outcome memory and the full adversarial variant set, then publish from `main` after CI confirmation.

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

## 2026-09-14 — Concurrent connector/dashboard delivery and developer handover

- Ran two isolated jobs from `ab2be86`; integrated GitHub-only adapters as `9d46a36` and dashboard as `a220838`.
- Integrated actual Arga runtime bridge, manual dashboard launcher, sidebar status refresh and Node 22 runtime CI as `81f034e`.
- Combined suite: 46 passed; typecheck and sandbox demo passed. Chromium fixture and actual-runtime acceptance passed, including exact approval/separate resume, denial, comparisons and mobile layout.
- Added `DEVELOPER_HANDOVER.md` with contracts, paths, commits, evidence, known runtime/Arga limitations and ordered remaining work.
- Live external-app verification remains pending. No live comments or other external messages were sent. Local verification servers are stopped at handoff.

## 2026-09-14 — live three-app mission crossed the line

- Integrated the live incident mission onto the hardened runtime baseline.
- Real YouTube connector observed `xKOL36Yjs0U` live with exact title/identity.
- Real GitHub connector grounded issue #1.
- Exact operator approval authorized one ntfy notification; provider returned receipt `yNc6zkrpzqhg`.
- Immediate read-back exposed ntfy eventual-consistency lag. Runtime failed closed and did **not** duplicate the write.
- Verifier-only operator recovery later confirmed the same external receipt, then the runtime requested a second exact approval for the GitHub evidence comment.
- GitHub comment `5655933189` was posted and read back exactly.
- Final state: `CONFIRMED_SUCCESS`; evaluator `1.00`; all 7 checks passed.
- Added bounded ntfy read-back polling regression; integrated suite now 77/77 with typecheck green.
- Durable evidence: [`evidence/LIVE_MISSION_2026-09-14.md`](evidence/LIVE_MISSION_2026-09-14.md).
