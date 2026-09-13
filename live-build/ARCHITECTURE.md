# Live Build Architecture

## Design target

A compact runtime that can execute the same control loop in very different business environments without hiding the domain logic inside a giant system prompt.

```text
                         ┌─────────────────────┐
                         │   MISSION / EVENT   │
                         └──────────┬──────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR / STATE MACHINE              │
│ observe → ground → plan → policy → act → verify → evaluate │
└───────────────┬──────────────────┬───────────────────────────┘
                │                  │
                ▼                  ▼
       ┌────────────────┐   ┌────────────────┐
       │ POLICY ENGINE  │   │ MEMORY / RAG   │
       │ risk + approval│   │ prior evidence │
       └───────┬────────┘   └───────┬────────┘
               └────────────┬────────┘
                            ▼
                   ┌─────────────────┐
                   │   TOOL ROUTER   │
                   │ typed contracts │
                   └────────┬────────┘
                            │
          ┌─────────────────┼────────────────────┐
          ▼                 ▼                    ▼
      GitHub          Google Workspace       Domain tools
   issue / state      Drive / Sheets /       APIs / MCP /
      evidence        Gmail / Calendar       sandboxes
          │                 │                    │
          └─────────────────┼────────────────────┘
                            ▼
                  ┌────────────────────┐
                  │ OBSERVE AFTER WRITE│
                  │ read back reality  │
                  └─────────┬──────────┘
                            ▼
                  ┌────────────────────┐
                  │ INDEPENDENT EVAL   │
                  │ invariants + score │
                  └─────────┬──────────┘
                            ▼
                  ┌────────────────────┐
                  │ TRACE / EVIDENCE   │
                  │ append-only record │
                  └────────────────────┘
```

## Planned implementation shape

```text
src/
  core/
    orchestrator.ts
    state-machine.ts
    planner.ts
    types.ts
  tools/
    registry.ts
    contracts.ts
    idempotency.ts
  policy/
    engine.ts
    autonomy.ts
  memory/
    store.ts
    retrieval.ts
  trace/
    events.ts
    jsonl.ts
  eval/
    evaluator.ts
    assertions.ts
  replay/
    runner.ts
    compare.ts
  connectors/
    github/
    google-drive/
    google-sheets/
    gmail/
    google-calendar/
  worlds/
    lemma/
    comma/
    arga/
    userlens/
```

TypeScript owns orchestration and contracts. Python is reserved for analysis/evaluation where its ecosystem is materially better, exposed through a small process or API boundary rather than creating two competing runtimes.

## Hard requirements

### Grounded state
Important claims must point back to observations or source records. Model memory is never accepted as authoritative external state.

### Typed tools
Each tool declares:

- input schema
- output schema
- side effects
- autonomy class
- reversibility
- idempotency strategy
- verification read / invariant

### Policy before action
Consequential writes cannot rely on the LLM merely saying an action is safe.

### Read-after-write
HTTP `200`, queued, or tool success is not proof. The resulting state must be inspected.

### Append-only trace
Plan steps, tool calls, observations, policy decisions, approvals, side effects, verification reads, and evaluator results are recorded.

### Independent evaluation
The same component that proposes an action should not be the only component deciding whether it succeeded.

### Replayable runs
Captured or synthetic inputs allow rerunning missions across model, policy, memory, and agent-version changes.

## Evidence states

Every important observation/result can carry one of:

```text
VERIFIED
PARTIALLY_VERIFIED
INFERRED
UNKNOWN
CONTRADICTED
SIMULATION_ONLY
NOT_TESTED
```

A simulated fixture never silently becomes `VERIFIED` production evidence.

## Example trace event

```json
{
  "run_id": "run_7f3k",
  "seq": 12,
  "kind": "tool.result",
  "world": "demo",
  "goal_id": "goal_04",
  "step_id": "step_03",
  "tool": "gmail.create_draft",
  "autonomy": 2,
  "input_digest": "sha256:...",
  "output_digest": "sha256:...",
  "side_effect": "draft-created",
  "verification": "gmail.get_draft",
  "status": "VERIFIED"
}
```

## Failure semantics

A write can end in more than success/failure:

- `CONFIRMED_SUCCESS`
- `CONFIRMED_FAILURE`
- `DENIED_BY_POLICY`
- `WAITING_FOR_APPROVAL`
- `UNCERTAIN_SIDE_EFFECT`
- `TOOL_UNAVAILABLE`

`UNCERTAIN_SIDE_EFFECT` is important. If a network failure occurs after a write may have been accepted, the runtime must verify state before retrying to avoid duplicate actions.

## Evaluator responsibilities

The evaluator checks both **final state** and **trajectory**:

- was the goal achieved?
- did the correct external record change?
- were forbidden actions avoided?
- were approvals respected?
- are claims backed by evidence?
- did the agent make unnecessary calls?
- did it recover safely from failures?

## Replay comparison

A replay should make differences obvious:

| Dimension | Baseline | Candidate |
|---|---:|---:|
| Goal success | fail | pass |
| Evaluator score | 0.41 | 0.94 |
| Tool calls | 12 | 8 |
| Policy violations | 1 | 0 |
| Unverified writes | 2 | 0 |
| Cost | … | … |
| Latency | … | … |

The product story is not “the model thought harder.” It is **the system behaved better and we can show the evidence**.
