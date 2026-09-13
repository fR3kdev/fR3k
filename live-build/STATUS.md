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
| Typed agent runtime | 🟨 PARTIALLY_VERIFIED | local implementation; 28 synthetic runtime tests and typecheck pass; live integration pending |
| Policy / autonomy engine | 🟨 PARTIALLY_VERIFIED | allowlist, sandbox, budget, approval binding, denial and expiry tests pass locally |
| Append-only execution trace | 🟨 PARTIALLY_VERIFIED | fsynced JSONL, sequence/hash checks and concurrent-writer tests; full crash recovery pending |
| Independent evaluator | 🟨 PARTIALLY_VERIFIED | local final-state, trajectory, evidence and bounded-replanning tests pass |
| Replay / counterfactual runner | ⏳ BUILDING | contract defined, implementation pending |
| GitHub connector | ⏳ BUILDING | live repo operations work; contest runtime adapter pending |
| App capability inventory | ⏳ BUILDING | choose 3+ necessary apps from verified access |
| Gmail / Calendar route | ❌ REJECTED | do not authenticate or implement |
| Live dashboard | ⬜ NOT TESTED | planned after runtime core |
| End-to-end 3+ app mission | ⬜ NOT TESTED | must be proven before demo |

## Build priority

The [completion ledger](COMPLETION.md) records current test evidence and remaining integration gates. Local runtime tests are in [`runtime.behavior.test.ts`](../agentic-action-engine/tests/runtime.behavior.test.ts). The isolated [connector](DEVELOPMENT_PATHWAY_CONNECTORS.md) and [dashboard](DEVELOPMENT_PATHWAY_DASHBOARD.md) briefs are ready for separate development agents.

### P0 — make one mission work end to end

- [ ] core types
- [ ] state machine
- [ ] typed tool registry
- [ ] autonomy / policy gate
- [ ] trace writer
- [ ] evaluator
- [ ] GitHub adapter
- [ ] Google Workspace adapter(s)
- [ ] approval checkpoint
- [ ] read-after-write verification
- [ ] one passing multi-app scenario

### P1 — prove reliability

- [ ] deliberate failure fixture
- [ ] retry / idempotency test
- [ ] uncertain-side-effect handling
- [ ] prompt-injection fixture
- [ ] policy denial fixture
- [ ] replay baseline vs candidate
- [ ] evaluator score comparison

### P2 — make it look lethal on stream

- [ ] mission panel
- [ ] current plan panel
- [ ] live trace
- [ ] tool-call cards
- [ ] autonomy badge
- [ ] approval control
- [ ] evaluator result
- [ ] replay comparison
- [ ] cost / latency counters

### P3 — expand the worlds

- [ ] Lemma scenario
- [ ] Comma Capital scenario
- [ ] Arga Labs scenario
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
