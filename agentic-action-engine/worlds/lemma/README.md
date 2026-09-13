# Lemma world — semantic failure → verified repair

Lemma's real product surface is production monitoring and reliability for AI agents. This world starts from a production semantic failure and carries it through diagnosis, a minimal repair, regression creation, replay, and a reviewable GitHub PR.

**Full build contract:** [`SPEC.md`](SPEC.md)

Core loop:

`incident → representative traces → violated requirement → root cause → minimal patch → baseline fail → candidate pass → PR → approval → online eval`

Key rule: a technically successful trace can still be a semantic failure. The evaluator judges the external state and the requirement that was actually in force, not the agent's final prose.

Public product reference: https://www.uselemma.ai/