# Competition build contract

Official challenge: build **one useful, multi-step AI agent**, connect it to at least **three external apps**, and show how you know it works.

Official judging weights:

- 30% technical execution
- 25% reliability & evaluation
- 20% usefulness
- 15% originality
- 10% demo clarity

The entry should therefore optimize for a single memorable end-to-end loop, then use the four company worlds as evidence that the architecture generalizes.

## Primary live demo: verified action loop

The reference mission should visibly cross at least three external systems and include one consequential action behind a human gate.

Recommended path:

1. **GitHub** receives the mission/incident and holds durable evidence.
2. **Google Drive/Sheets or a domain API** supplies source-of-truth state.
3. Agent diagnoses the state and proposes a bounded intervention.
4. **Gmail/Slack** receives a draft/action request.
5. Policy requires approval before send.
6. On approval, the write executes.
7. **Google Calendar** optionally records accepted follow-through.
8. Agent re-reads each write from the provider.
9. Independent evaluator checks success and forbidden conditions.
10. Trace/replay panel proves what happened.

## Demo contract

The viewer must be able to answer these questions without trusting narration:

- What was the goal?
- What did the agent observe?
- Which observations support its diagnosis?
- What plan is it following now?
- Which tool is it calling?
- Is that action read-only, reversible, approval-gated, or prohibited?
- What external state changed?
- How was the write verified?
- What exact invariant made the evaluator pass/fail?
- Can the same case be replayed under another agent/policy/model?

## Two-minute arc

**0:00–0:15 — The claim**  
"Most agent demos stop when the model says done. This one proves the external state changed correctly."

**0:15–0:35 — Observe**  
Mission arrives. Agent reads source state from multiple apps. Evidence drawer shows provenance.

**0:35–0:55 — Decide**  
Agent diagnoses the problem, retrieves relevant memory/cases, and generates a short plan.

**0:55–1:15 — Policy gate**  
A consequential outbound action appears as `REQUIRE_APPROVAL`; viewer clicks approve.

**1:15–1:35 — Act + verify**  
Action executes. Agent performs read-after-write and updates evidence state to VERIFIED only after the provider confirms the new state.

**1:35–1:50 — Independent eval**  
Evaluator checks final-state invariants and forbidden effects. The planner cannot mark its own homework.

**1:50–2:00 — Replay**  
Counterfactual panel compares another policy/model/agent revision with success, steps, calls, cost, latency, and violations.

## What not to show

- a long chat conversation
- hidden automation with no visible state transition
- four separate demos that dilute the main story
- fake success based only on an LLM response
- a giant autonomous blast radius
- dense architecture slides during the two-minute demo

## What the four worlds contribute

- **Lemma:** strongest semantic-failure/repair story.
- **Arga:** strongest deterministic failure/replay/evaluation story.
- **Comma:** clearest business-network usefulness story.
- **Userlens:** clearest measurable product-outcome story.

The live contest demo can pick the cleanest path while the repository demonstrates the broader platform.

## Submission checklist

- [ ] working repository
- [ ] one runnable end-to-end path
- [ ] >=3 external apps in that path
- [ ] visible trace
- [ ] approval gate
- [ ] read-after-write verification
- [ ] independent evaluator
- [ ] at least one adversarial/failure fixture
- [ ] replay/counterfactual comparison
- [ ] short reliability brief
- [ ] two-minute demo recording
- [ ] setup instructions that work from a clean checkout
- [ ] secrets excluded from repo/traces

## One-line pitch

**FR3K is an action engine for agents that refuses to confuse "the model said it worked" with "the world is now in the correct state."**