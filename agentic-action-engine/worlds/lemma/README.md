# Lemma World — Autonomous Investment Thesis Monitor

## Goal
Turn a new filing/earnings/news event into a grounded thesis-impact assessment and a reviewable valuation update.

## Flow
1. Load current thesis and assumptions.
2. Retrieve the triggering source document.
3. Extract material evidence with citations.
4. Map evidence to explicit thesis assumptions.
5. Recompute only affected valuation inputs.
6. Compare valuation delta.
7. Produce an evidence-backed journal event.
8. Notify for review when materiality exceeds policy threshold.

## Safety
- Research and calculations may be autonomous.
- Valuation changes are proposed/reviewable.
- Trading is prohibited.

## Demo success
The evaluator verifies that the cited source supports the claimed change, the correct assumption was modified, the valuation delta is reproducible, and no trade occurred.
