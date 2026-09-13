# Judging scorecard

Official rubric: technical execution 30%, reliability & evaluation 25%, usefulness 20%, originality 15%, demo clarity 10%.

This file is a build-time checklist, not marketing copy. A feature only earns credit when it is demonstrable.

## 30% — Technical execution

Target evidence:

- one runnable multi-step agent path
- >=3 real external apps in the path
- typed connector/tool contracts
- explicit state machine
- persistent trace
- policy engine before side effects
- approval checkpoint
- read-after-write verification
- resumable run/replay
- clean local setup

Stretch evidence:

- deterministic sandbox adapter
- model-provider abstraction
- checkpoint replay
- fault injection
- world plug-in interface

Failure mode to avoid: lots of architecture with no live state transition.

## 25% — Reliability & evaluation

Target evidence:

- success defined as invariants, not model prose
- evaluator separate from planner
- at least one intentionally failing fixture
- at least one adversarial case
- uncertain-side-effect handling
- idempotency strategy
- forbidden-action enforcement
- evidence-state labels
- regression generated from a failure

Stretch evidence:

- baseline fails / candidate passes
- mutated neighboring cases
- counterfactual model/policy comparison
- CI gate artifact

Failure mode to avoid: "the logs look right" without verifying external state.

## 20% — Usefulness

Target evidence:

- mission corresponds to real work somebody would pay to reduce
- agent changes useful external state
- action is more valuable than a summary
- human remains in control of relationship/risk-sensitive steps
- output leaves a durable artifact for the next person/run

World-specific proof:

- Lemma: faster incident → verified repair loop
- Comma: faster founder need → relevant human help
- Arga: failure → reusable regression scenario
- Userlens: guidance → measured adoption outcome

Failure mode to avoid: fancy orchestration around a trivial task.

## 15% — Originality

Target evidence:

- explicit distinction between agent narrative and verified world state
- autonomy classes per tool
- failure-to-regression ratchet
- replay/counterfactual view
- one runtime expressed through four genuinely different worlds

Strongest originality angle:

> The product is not an agent that takes actions. It is an engine that makes **action, authority, verification, and learning** first-class objects.

Failure mode to avoid: calling a standard tool-calling chatbot an "operating system."

## 10% — Demo clarity

Target evidence:

- one-line mission visible at all times
- active plan step highlighted
- tool calls readable
- approval gate impossible to miss
- red/green evaluator verdict based on named invariant
- one before/after state change
- replay comparison fits on one screen

Two-minute rule:

If a viewer cannot explain the input, action, guardrail, and proof after two minutes, remove UI/features until they can.

## Minimum winning-shaped build

Prioritize in this order:

1. end-to-end three-app state transition
2. verification and independent eval
3. approval/policy gate
4. clean trace UI
5. one failure + regression replay
6. only then add additional world polish

## Definition of done

A stranger can clone the repo, configure demo credentials or deterministic fixtures, run one command, watch the agent complete a useful mission across multiple apps, inspect exactly what changed, and independently verify why the run passed or failed.