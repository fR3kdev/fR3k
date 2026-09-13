# Competition Build Contract

The official challenge is to build one useful, multi-step AI agent that connects to at least three external apps and demonstrate that it works.

This repository will use one shared runtime and one reference multi-app workflow, with four domain configurations. The live contest entry should remain understandable as **one agent**, not four unrelated products.

## Reference workflow

**Mission enters via GitHub** → agent loads structured state/source docs from **Google Drive/Sheets** → selects an intervention → creates an approval-gated **Gmail** action → when accepted, optionally schedules follow-through in **Google Calendar** → re-reads app state → writes evidence and evaluator result back to GitHub.

## Demo UX

The UI should expose:

- mission,
- current plan,
- current state/evidence,
- tool calls,
- autonomy level,
- approval checkpoint,
- live trace,
- evaluator verdict,
- replay/counterfactual controls.

## Two-minute demo arc

1. 0:00–0:20 — show the goal and four-app architecture.
2. 0:20–0:55 — live agent observes state and diagnoses the case.
3. 0:55–1:20 — policy blocks outbound action until approval.
4. 1:20–1:40 — approved action executes and is verified by read-after-write.
5. 1:40–2:00 — show evaluator + trace + replay comparison.
