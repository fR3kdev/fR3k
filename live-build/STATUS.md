# Live Build Status

> **Truth over theatre.** This page separates what exists from what is planned.

## Current state

| Area | State | Evidence |
|---|---|---|
| Public fR3k code-drop repo | ✅ VERIFIED | root README + runnable Qwen/router assets |
| YouTube live stream link | ✅ VERIFIED | linked from root + `live-build/` |
| Qwen 35B-A3B / 4 GB VRAM giveaway | ✅ VERIFIED | configs, harness, recorded results in repo |
| Four-world competition plan | ✅ VERIFIED | [`PLAN.md`](PLAN.md) |
| Shared runtime architecture | ✅ VERIFIED | [`ARCHITECTURE.md`](ARCHITECTURE.md) |
| Public build log | ✅ VERIFIED | [`BUILD_LOG.md`](BUILD_LOG.md) |
| Typed agent runtime | ✅ VERIFIED | 55 tests + typecheck pass locally; live integration pending |
| Policy / autonomy engine | ✅ VERIFIED | allowlist, sandbox, budget, exact approval binding, expiry, authoritative denial, revision-bound digests; tests pass locally |
| Append-only execution trace | ✅ VERIFIED | fsynced JSONL, sequence/hash integrity, stale-lock recovery, audited `repairTail`, crash replay from journal; tests pass locally |
| Independent evaluator | ✅ VERIFIED | final-state/trajectory/evidence checks plus write read-back grounding; tests pass locally |
| Replay / counterfactual runner | ✅ VERIFIED | `replay-bridge.ts` rebuilds state from the journal and diffs baseline vs candidate; tests + live `npm run demo` |
| Arga three-app sandbox mission | ✅ VERIFIED | Support Desk → Billing → CRM with ledger-proven duplicity, durable refund records, exact binding, unrelated-preservation; score 1.00; all evidence `SIMULATION_ONLY` |
| GitHub connector | 🟨 PARTIALLY_VERIFIED | issue read and evidence comment adapters; 14 contract tests pass; live runtime verification pending |
| App capability inventory | 🟨 PARTIALLY_VERIFIED | GitHub access observed; Google access unavailable; live 3-app selection remains gated |
| Gmail / Calendar route | ❌ REJECTED | do not authenticate or implement |
| Live dashboard | 🟨 PARTIALLY_VERIFIED | loopback UI wired to actual Arga runtime; API and Chromium checks pass; external-app evidence pending |
| End-to-end 3+ app mission | ⬜ NOT TESTED | must be proven before demo |
| Model-driven planner | ⬜ NOT TESTED | current `arga-planner-v2` is deterministic, not LLM-backed |

## Build priority

The [completion ledger](COMPLETION.md) records current test evidence and remaining integration gates. Local runtime tests are in [`runtime.behavior.test.ts`](../agentic-action-engine/tests/runtime.behavior.test.ts) and [`reliability.test.ts`](../agentic-action-engine/tests/reliability.test.ts). The two jobs ran concurrently from baseline `ab2be86`; the active GitHub-only scope is in [the directive](HACKATHON_DIRECTIVE.md). Connector details are in [CONNECTORS.md](../agentic-action-engine/docs/CONNECTORS.md).

### P0 — make one mission work end to end

- [x] core types
- [x] state machine
- [x] typed tool registry
- [x] autonomy / policy gate
- [x] trace writer
- [x] evaluator
- [x] GitHub adapter (contract-tested; live runtime gate pending)
- [ ] Google Workspace adapter(s)
- [x] approval checkpoint
- [x] read-after-write verification
- [x] one passing sandbox multi-app scenario (not live external evidence)

### P1 — prove reliability

- [x] deliberate failure fixture (hung planner / hung read / deployed-revision swap)
- [x] retry / idempotency test
- [x] uncertain-side-effect handling
- [x] prompt-injection fixture
- [x] policy denial fixture
- [x] crash recovery: stale-lock recovery, audited `repairTail`, denial-authoritative projection
- [x] deadline enforcement (`HangError` from `timed()`)
- [x] replay baseline vs candidate
- [x] evaluator score comparison
- [x] journal-state reconstruction (`reconstructArgaState` + idempotent refund)

### P2 — make it look lethal on stream

- [ ] mission panel
- [ ] current plan panel
- [ ] live trace
- [ ] tool-call cards
- [ ] autonomy badge
- [ ] approval control
- [ ] evaluator result
- [x] replay comparison (CLI prints crash replay + counterfactual diffs)
- [ ] cost / latency counters

### P3 — expand the worlds

- [ ] Lemma scenario
- [ ] Comma Capital scenario
- [x] Arga Labs scenario (ledger-proofed v2)
- [ ] Userlens scenario

## Demo definition of done

The project is **not** done because an LLM produces a good-looking answer.

For the judged mission, done means:

1. a mission enters the runtime;
2. the agent reads grounded state from an external app;
3. it retrieves relevant context from another source;
4. it proposes a consequential action;
5. policy requires approval when appropriate;
6. approved action executes through a third app;
7. resulting external state is read back;
8. evaluator independently checks success;
9. trace shows the full trajectory;
10. replay can compare another model/policy/agent revision.

## Evidence labels used in this build

`VERIFIED · PARTIALLY_VERIFIED · INFERRED · UNKNOWN · CONTRADICTED · SIMULATION_ONLY · NOT_TESTED`

No green tick without evidence.
