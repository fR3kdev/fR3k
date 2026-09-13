# Arga world — failure forge + counterfactual regression

Arga provides production-shaped stateful twins, seeded scenarios, isolated execution, evidence, and evaluation. This world sits on top of that primitive: turn a discovered failure into a deterministic scenario, mutate the failure boundary, replay candidate agents/policies, and export a regression gate.

**Full build contract:** [`SPEC.md`](SPEC.md)

Core loop:

`failure → reproducible scenario → invariant violation → regression fixture → targeted mutations → candidate replay → counterfactual comparison → CI gate`

Key rule: grade final state **and** trajectory. An agent that says success after mutating the wrong record fails even when every API call returned 200.

Public product reference: https://www.argalabs.com/