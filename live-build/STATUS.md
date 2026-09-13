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
| Typed agent runtime | ✅ VERIFIED | **80 tests + typecheck pass** at submission baseline `f488f55`; real three-app mission verified |
| Durable outcome memory | ✅ VERIFIED | append-only, fsynced, hash-chained `memory.jsonl`; outcome persisted on terminal runs and reconstructed by a fresh process; tests + `npm run demo` |
| Model-driven planner | 🟨 PARTIALLY_VERIFIED | bounded provider architecture + injection/drift guard + fail-closed credentials; live provider wiring and a model-backed run remain unverified; shipped demos use deterministic planners |
| Adversarial variant set | ✅ VERIFIED | 8 PLAN.md variants as reproducible regression assets; one real bug found and fixed; `npm run demo` panel |
| Policy / autonomy engine | ✅ VERIFIED | allowlist, sandbox, budget, exact approval binding, expiry, authoritative denial, revision-bound digests; tests pass locally |
| Append-only execution trace | ✅ VERIFIED | fsynced JSONL, sequence/hash integrity, stale-lock recovery, audited `repairTail`, crash replay from journal; tests pass locally |
| Independent evaluator | ✅ VERIFIED | final-state/trajectory/evidence checks plus write read-back grounding; tests pass locally |
| Replay / counterfactual runner | ✅ VERIFIED | `replay-bridge.ts` rebuilds state from the journal and diffs baseline vs candidate; tests + sandbox `npm run demo` |
| Arga three-app sandbox mission | ✅ VERIFIED | Support Desk → Billing → CRM with ledger-proven duplicity, durable refund records, exact binding, unrelated-preservation; score 1.00; all evidence `SIMULATION_ONLY` |
| GitHub connector | ✅ VERIFIED | allowlisted issue read + approval-gated evidence comment; exact comment read-back verified on live mission |
| App capability inventory | ✅ VERIFIED | judged path uses real YouTube + GitHub + ntfy; Google is intentionally not required |
| Gmail / Calendar route | ❌ REJECTED | do not authenticate or implement |
| Local operator dashboard | 🟨 PARTIALLY_VERIFIED | loopback UI wired to actual Arga runtime; API and Chromium checks pass; live-provider dashboard control unverified; CLI external-app evidence is recorded separately |
| End-to-end 3+ app write mission | ✅ VERIFIED | YouTube → GitHub → ntfy → GitHub evidence; two exact approvals; read-back on both writes; evaluator **1.00** |
| Live GitHub read attach | ✅ VERIFIED | `demo-live` reached `CONFIRMED_SUCCESS`, score 1.00, all observations `VERIFIED` |

## Build priority

The [completion ledger](COMPLETION.md) records current test evidence and remaining integration gates. Local runtime tests are in [`runtime.behavior.test.ts`](../agentic-action-engine/tests/runtime.behavior.test.ts) and [`reliability.test.ts`](../agentic-action-engine/tests/reliability.test.ts). The current YouTube → GitHub → ntfy mission is recorded in [the directive](HACKATHON_DIRECTIVE.md); the earlier GitHub-only delivery is historical. Connector details are in [CONNECTORS.md](../agentic-action-engine/docs/CONNECTORS.md).

### P0 — make one mission work end to end

- [x] core types
- [x] state machine
- [x] typed tool registry
- [x] autonomy / policy gate
- [x] trace writer
- [x] evaluator
- [x] GitHub adapter (live issue read + approval-gated evidence write/read-back verified)
- [x] three real app adapters selected and verified (YouTube + GitHub + ntfy); Google not required
- [x] approval checkpoint
- [x] read-after-write verification
- [x] one passing sandbox multi-app scenario plus one verified live three-app mission
- [x] durable outcome memory (append-only journal, reconstruct across restart, seeds later missions)
- [x] model-driven planner boundary (bounded provider + guard + fail-closed credentials; live key gated)
- [x] adversarial variant set (all 8 PLAN.md variants as regression assets)

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

### P2 — presentation and dashboard

The checked UI items below exist in the Arga sandbox dashboard. Wiring and verifying the dashboard against live providers remains separate work.

- [x] mission panel
- [x] current plan panel
- [x] live trace
- [x] tool-call cards
- [x] autonomy / policy display (policy JSON and write budget)
- [x] approval control
- [x] evaluator result
- [x] replay comparison (CLI prints crash replay + counterfactual diffs)
- [ ] live-provider dashboard integration
- [ ] dashboard checkpoint replay controls
- [ ] confidence / cost / latency instrumentation

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

Items 1–9 have recorded live-mission evidence. Replay comparison is verified separately in the Arga sandbox; live-provider or live-model counterfactual replay has not been demonstrated.

## Evidence labels used in this build

`VERIFIED · PARTIALLY_VERIFIED · INFERRED · UNKNOWN · CONTRADICTED · SIMULATION_ONLY · NOT_TESTED`

No green tick without evidence.
