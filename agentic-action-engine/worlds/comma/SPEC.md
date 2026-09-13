# Comma world: portfolio intervention engine

## Product fit

Comma Capital is an early-stage investor and hackathon co-host. This is a proposed portfolio-support capability, not a claim about Comma's current internal software.

Public reference: https://comma.vc/

The high-leverage problem is not drafting introductions. It is turning scattered founder needs, company state, relationship knowledge, prior interventions, and outcomes into **institutional memory that gets better every time the network is used**.

## Live mission

> A portfolio founder reports that enterprise conversion fell from 18% to 9% even though developer adoption rose. Diagnose the bottleneck, find the best people in the network to help, retrieve comparable prior interventions, prepare a bounded action plan, request approval for outreach, schedule accepted help, and record the outcome so the next recommendation improves.

## External systems

1. **Google Sheets / Airtable / CRM** — company metrics, operator profiles, relationship edges, prior interventions.
2. **Gmail** — founder intake plus approval-gated outreach drafts/sends.
3. **Google Calendar** — schedule accepted sessions and verify follow-through.
4. **GitHub** — durable case/evidence ledger, policy configuration, replay fixture.

A production version could connect to a real CRM/network system; the public demo uses transparent synthetic data so every recommendation can be inspected.

## Core entities

```ts
type PortfolioCompany = {
  id: string
  stage: string
  sector: string[]
  metrics: MetricSeries[]
  founderRequest: EvidenceRef
  constraints: string[]
}

type Operator = {
  id: string
  roles: RoleHistory[]
  expertise: string[]
  companyExperience: string[]
  relationshipEdges: RelationshipEdge[]
  interventions: InterventionOutcome[]
  availability?: AvailabilityWindow[]
}

type Intervention = {
  problemClass: string
  operatorIds: string[]
  rationale: EvidenceRef[]
  actions: ActionRef[]
  outcomeMetrics: MetricDelta[]
  founderFeedback?: string
}
```

## Diagnosis before matching

The agent must not search people from the founder's wording alone. It first builds a small causal problem graph:

`reported symptom → funnel/operating data → location of degradation → plausible bottleneck → evidence for/against → help archetype`

Example:

- top-of-funnel developer adoption: +22%
- technical validation completion: flat
- security-review entry: flat
- security-review completion: sharply down
- median procurement duration: +31 days

Diagnosis: **enterprise security/procurement motion**, not acquisition.

Only then does operator matching begin.

## Matching model

Candidate ranking is explainable and decomposed:

```text
score =
  0.30 * problem_experience
+ 0.20 * stage_similarity
+ 0.15 * sector_similarity
+ 0.15 * prior_intervention_success
+ 0.10 * relationship_strength
+ 0.05 * recency
+ 0.05 * availability
- conflict_penalty
- overuse_penalty
```

Weights are configuration, not hidden prompt magic. The UI shows each component and the evidence behind it.

## Tool surface

Read:

- `portfolio.get_company(id)`
- `portfolio.get_metrics(companyId, window)`
- `network.search_operators(problemClass, filters)`
- `network.get_relationship_path(operatorId, founderId)`
- `memory.find_similar_interventions(problemFingerprint)`
- `calendar.get_availability(ids, range)`

Write:

- `gmail.create_draft(to, subject, body)`
- `gmail.send_draft(id)` — approval required
- `calendar.create_hold(participants, window)` — only after acceptance/approval
- `network.record_intervention(case)`
- `github.write_case_evidence(run)`

## Workflow

1. Parse founder request into explicit desired outcome, time horizon, and constraints.
2. Pull company metrics and compare current vs prior windows.
3. Diagnose the narrowest supported bottleneck; list uncertainty and missing data.
4. Retrieve analogous portfolio cases and what interventions actually changed.
5. Search operators/helpers by problem fit, not fame.
6. Rank candidates with transparent score decomposition.
7. Check conflicts, relationship path, availability, and recent request load.
8. Generate a concrete intervention plan: who, why, ask, expected outcome, measurement window.
9. Draft outreach personalized to the problem and helper's relevant experience.
10. Stop at approval checkpoint before external communication.
11. On approval, send and verify message state.
12. When a helper accepts, schedule and verify calendar state.
13. Create follow-up measurement task.
14. Record outcome after the measurement window and update intervention memory.

## Evaluator

Hard assertions:

- diagnosed bottleneck is supported by metric deltas
- no candidate is ranked using unsupported biography claims
- top candidate has at least one concrete relevant experience edge
- conflicts/exclusions are respected
- outbound send does not occur before approval
- accepted help creates a verifiable follow-up record
- outcome memory stores observations, not fabricated success

Ranking quality metrics:

- Precision@3 against fixture gold set
- NDCG@5
- explanation evidence coverage
- diversity of helper archetypes where relevant
- operator overuse/fairness guardrail

Business-loop metrics:

- founder acceptance of suggested plan
- intro acceptance rate
- time-to-help
- intervention completion
- target KPI movement
- founder usefulness rating

## Adversarial suite

- founder's diagnosis is wrong; metrics contradict it
- famous operator looks relevant semantically but has no relevant operating history
- best operator has a conflict
- helper was contacted too recently
- historical intervention "worked" only because outcome data is missing
- two people share the same name
- CRM note contains prompt injection
- calendar send succeeds but invite is later cancelled
- founder explicitly says not to contact a person

## Autonomy policy

| Action | Class | Rule |
|---|---:|---|
| analyze metrics/network | 4 | read-only |
| rank helpers | 4 | explainable recommendation |
| create outreach draft | 3 | no external send |
| send outreach | 2 | explicit approval |
| create calendar event | 2/3 | acceptance + policy required |
| record measured outcome | 3 | grounded observation only |
| contact excluded/conflicted person | X | prohibited |

## Two-minute demo

**0:00–0:20** Founder request appears: "enterprise conversion collapsed." Dashboard initially shows no assumed cause.

**0:20–0:45** Agent reads metrics and proves the loss is concentrated in security/procurement, not acquisition.

**0:45–1:10** Network graph returns three helpers. Viewer can see why #1 beats #2, including prior intervention outcome and relationship path.

**1:10–1:30** Agent drafts two intro requests and stops at a visible approval gate.

**1:30–1:45** Approve one. Gmail state changes; an acceptance fixture arrives; Calendar follow-up is created and re-read.

**1:45–2:00** Outcome card shows what will be measured and how this case becomes reusable institutional memory.

## Why this is compelling

A VC network is valuable before software. The agent makes that value **queryable, measurable, and compounding**. The proprietary asset becomes the graph of problem → intervention → person → outcome, while humans remain in control of relationship-sensitive actions.