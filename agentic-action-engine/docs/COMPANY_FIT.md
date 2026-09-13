# Company fit: four worlds, one engine

This document keeps the demos anchored to what the four companies actually do today, rather than inventing a generic AI story around their names.

## Lemma AI — production semantic reliability

Public product: https://www.uselemma.ai/

Lemma monitors production AI-agent traces for silent semantic failures, groups recurring issues, diagnoses root causes, alerts teams, and converts failures into online evaluations. The FR3K opportunity is not to rebuild Lemma. It is to show the **action layer after detection**:

`production incident → retrieve representative traces → reconstruct violated requirement → propose fix → open PR → replay failing cases → create regression/eval → verify → report evidence`

The demo should make Lemma more operational: once a failure is surfaced, an agent can carry a bounded repair all the way through engineering systems while preserving human approval for consequential changes.

## Comma Capital — founder support as an institutional-memory problem

Public firm: https://comma.vc/

Comma is an early-stage investor and hackathon co-host. The proposed world is intentionally framed as a **new portfolio-support capability**, not as a claim about Comma's current internal tooling.

The opportunity is to turn founder requests, portfolio context, relationship knowledge, prior interventions, and outcomes into a compounding decision system:

`founder need → diagnose bottleneck → search network + analogous cases → rank helpers → approve intro → schedule follow-up → measure result → update institutional memory`

The moat is not generated email. It is the structured history of who helped whom, with what problem, under which conditions, and what happened next.

## Arga Labs — production-shaped agent validation

Public product: https://www.argalabs.com/

Arga provides stateful twins of APIs/CLIs/MCPs, seeded scenarios, isolated sandboxes, run evidence, and evaluation. The FR3K world should therefore sit **on top of Arga's environment primitive** rather than pretending to replace it:

`real failure → materialize scenario → run agent in twins → inject faults/edge cases → grade final state + trajectory → generate regression → compare candidate fix → gate deployment`

The differentiator is automated failure-to-regression conversion and counterfactual replay across policies/models.

## Userlens — closed-loop adoption policy

Public product: https://userlens.io/

Userlens/Lumi combines customer state with product behavior to identify who needs guidance and what that guidance should accomplish. The FR3K opportunity is the next loop: make interventions **measurable and learnable**.

`account state + behavior → intervention candidates → risk/exposure policy → treatment assignment → action → observed outcome → uplift estimate → policy update`

This turns next-best-action guidance into an experimentation and learning system while protecting customers from unbounded automated messaging.

## Why these worlds belong together

They are four manifestations of the same control problem:

| World | Observe | Decide | Act | Verify / learn |
|---|---|---|---|---|
| Lemma | production traces | failure + repair hypothesis | engineering workflow | replay + online eval |
| Comma | founder/company/network state | best intervention/helper | outreach + scheduling | founder outcome |
| Arga | sandbox/service state | safe task trajectory | API/MCP actions | exact state assertions |
| Userlens | customer/product signals | intervention policy | guidance/outreach | adoption/uplift |

The shared engine exists to make those decisions observable, policy-bounded, reversible where possible, and independently evaluated.