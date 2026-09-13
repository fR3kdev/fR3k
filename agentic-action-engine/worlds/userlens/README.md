# Userlens world — intervention policy that learns

Userlens/Lumi already combines account state with product behavior to decide who needs guidance and why. This world extends that into a measurable policy loop: choose a bounded treatment, execute it, observe the downstream behavior, estimate incremental effect, and update future decisions only when the evidence is strong enough.

**Full build contract:** [`SPEC.md`](SPEC.md)

Core loop:

`account state + behavior → treatment candidates → policy/guardrails → bounded action → outcome → uplift estimate → policy update`

Key rule: personalized copy is not the product. The system must show whether the intervention changed behavior without violating consent, support, exposure, or retention guardrails.

Public product reference: https://userlens.io/