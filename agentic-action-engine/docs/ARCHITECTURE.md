# Architecture

## Design target

A small runtime that can execute the same control loop in four very different business environments without hiding domain logic inside prompts.

```text
Goal / Event
    |
    v
+-------------------------+
| Orchestrator            |
| state machine + planner |
+------------+------------+
             |
    +--------+--------+
    |                 |
    v                 v
Policy Engine      Memory / Retrieval
    |                 |
    +--------+--------+
             v
         Tool Router
             |
   +---------+----------+----------------+
   |                    |                |
   v                    v                v
GitHub              Google Workspace   Domain adapters
(issue/evidence)    Drive/Sheets/       Stripe/HubSpot/
                    Gmail/Calendar      market data/etc.
   \                    |                /
    +-------------------+---------------+
                        v
                 Observation/Event
                        |
                        v
                    Evaluator
                        |
             pass / fail / replan
                        |
                        v
                 Evidence Trace
```

## Hard requirements

1. **Grounded state**: important claims point to source observations, not model memory.
2. **Typed tools**: explicit schemas, idempotency keys where possible, and declared side effects.
3. **Policy before action**: risky actions cannot rely on prompt wording alone.
4. **Reversible by default**: prefer drafts, simulations, staging, and checkpointed writes.
5. **Observe after write**: a returned 200/queued status is not success; inspect resulting state.
6. **Append-only trace**: each plan step, tool call, observation, policy decision, and evaluator result is recorded.
7. **Replayable runs**: deterministic fixtures plus captured tool outputs allow comparison across models/policies.
8. **Evaluation is first-class**: every world defines success/failure independent of the agent narrative.

## Shared TypeScript runtime

Planned modules after the contest build begins:

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

Python is reserved for analysis/evaluation modules where the ecosystem is materially better, exposed behind a small process/API boundary rather than creating two competing orchestration stacks.

## Run evidence schema

Each trace event will carry at least:

```json
{
  "run_id": "...",
  "seq": 12,
  "time": "...",
  "kind": "tool.result",
  "world": "comma",
  "goal_id": "...",
  "step_id": "...",
  "tool": "gmail.create_draft",
  "autonomy": 2,
  "input_digest": "sha256:...",
  "output_digest": "sha256:...",
  "side_effect": "draft-created",
  "verification": "gmail.get_draft",
  "status": "VERIFIED"
}
```

Evidence states are explicit: `VERIFIED`, `PARTIALLY_VERIFIED`, `INFERRED`, `UNKNOWN`, `CONTRADICTED`, `SIMULATION_ONLY`, `NOT_TESTED`.
