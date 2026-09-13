# Senior developer handoff manifest

Prepared 2026-09-14. This is a historical implementation snapshot, not the active execution plan. **Before doing any work, follow [HACKATHON_DIRECTIVE.md](HACKATHON_DIRECTIVE.md).** Current Git state must be observed directly; the checkout/commit notes below are preserved only as handoff history.

## 1. Authoritative checkout and preservation

| Item | Current value |
|---|---|
| Primary repository checkout | `/home/fr3k/fr3k-public-build` |
| GitHub repository | `fR3kdev/fR3k` |
| Branch | `main` |
| Checked-out commit | `255311835883f83d92461f2c60103c8a57e94e3b` |
| Implementation location | `agentic-action-engine/` inside the primary checkout |
| Implementation Git state | Entire directory is currently untracked; no implementation commit or push has been made |
| Other worktree | `/home/fr3k/fr3k-live-build-synopsis`, branch `docs/live-build-synopsis`; earlier documentation work only |
| Separate development agents | None were started by this session; two assignment briefs were written |

The primary checkout contains the current implementation and synopsis. Do not start from the older synopsis worktree or assume GitHub contains the local runtime. Do not run `git clean`, reset this checkout, or copy only committed files: doing so can discard or omit the implementation.

At handoff, tracked modifications are `.gitignore`, `live-build/README.md`, `live-build/STATUS.md` and `live-build/BUILD_LOG.md`. Untracked work includes the runtime directory, synopsis, completion ledger, both development briefs and this manifest. `package.json` and `tsconfig.json` existed as local scaffolding before implementation began; the package manifest was extended with Zod and a lockfile was added.

The runtime snapshot comprises 13 files: all `agentic-action-engine/src/**/*.ts`, all `agentic-action-engine/tests/**/*.ts`, plus its `package.json`, `package-lock.json` and `tsconfig.json`. Its SHA-256 at handoff is:

```text
965627ec5e5ea3d82babdd7377b2d4776b4b3d74c3c56242016505abb65c418c
```

To reproduce: sort those repository-relative paths lexicographically; hash the concatenation of each UTF-8 path, a NUL byte, its raw file bytes, and another NUL byte. Dependencies, run artifacts and documentation are excluded.

## 2. Intended product and completion scope

Build one reusable agent engine that observes external state, plans, checks policy, acts, reads the result back, independently evaluates success and leaves replayable evidence. The Gmail/Google reference mission was rejected and is superseded. The actual hackathon mission must use at least three necessary external apps selected from verified capabilities and recorded in the active directive before implementation.

The full domain scope is:

- **Lemma:** production agent failure → reproducible regression → reviewable repair → failing baseline/passing candidate evidence.
- **Comma Capital:** grounded founder bottleneck → explained helper ranking → approved introduction → acceptance/follow-through and outcome memory.
- **Arga Labs:** duplicate-charge sandbox workflow across dependent systems, with the eight documented adversarial variants and regression gates.
- **Userlens:** observed product usage → bounded intervention/cohort → treatment/control comparison → outcome-driven memory or policy update.

The final product also needs a local dashboard, memory/retrieval, replay/checkpoints, reliability fixtures, reproducible commands, CI and evidence distinguishing simulations from live behavior. A hardcoded passing fixture does not fulfill the live-agent requirement.

Read [PLAN.md](PLAN.md) for full requirements, [ARCHITECTURE.md](ARCHITECTURE.md) for the original design, [COMPLETION.md](COMPLETION.md) for the ledger, and [SYNOPSIS.md](SYNOPSIS.md) for the plain-language explanation. Existing Qwen benchmarks and the root cost router are separate code drops, not a substitute for this project.

## 3. Implementation inventory

All paths below are relative to `agentic-action-engine/`.

| File | Implemented behavior | Important limit |
|---|---|---|
| `src/core/types.ts` | Strict mission/action schemas, planner/evaluator interfaces, trace and run-view types | No production planner or domain schemas yet |
| `src/core/orchestrator.ts` | Create/inspect/run/approve, tool dispatch, approval binding, retry/reconciliation, evaluation and bounded replanning | Requires reliability review; known gaps below |
| `src/core/state-machine.ts` | Projects run state and observations from journal events | Some crash-boundary semantics remain incomplete |
| `src/tools/registry.ts` | Typed tool registration, input/output validation, metadata, verifier contract and sanitized fault classes | Adapter correctness and side-effect declarations remain trusted code |
| `src/policy/engine.ts` | Tool allowlist, prohibited tools, sandbox restriction, autonomy and write budget checks | No domain-specific authorization or resource constraints yet |
| `src/trace/jsonl.ts` | Per-run exclusive lock file, append/fsync, sequence/hash validation and private file modes | Dead-process lock recovery and incomplete-tail recovery are absent |
| `src/eval/evaluator.ts` | Combines domain checks with write-policy, verification and reference checks | Evidence validation needs tightening; not proof of causal correctness |
| `src/memory/store.ts` | In-memory, append-only-ID entries and baseline lexical retrieval | No durable memory storage or automatic outcome recording |
| `tests/runtime-support.ts` | Synthetic record tools, planner and evaluator used by tests | In-process fixture state, not external apps |
| `tests/runtime.behavior.test.ts` | 28 behavior tests | No killed-process, live-provider, dashboard or full-world tests |

The public runtime surface currently includes:

```ts
new Runtime(store, registry, planner, evaluator, memory?, options?)
runtime.create(mission)
runtime.inspect(runId)
runtime.run(runId)
runtime.approve(runId, actionDigest, actor, allow)
```

Approval is an operator method, not an agent tool. The host must authenticate the operator; the runtime's `actor` string alone is not authentication. Preserve this boundary when adding a CLI or server.

## 4. Verification evidence and its limits

The latest actual verification before handoff passed:

- `npm test` in `agentic-action-engine/`: **28 passed, 0 failed, 0 skipped**.
- `npm run typecheck` in the same directory: passed.
- `git diff --check`: passed.
- Relative Markdown link checks for `live-build/`: passed.

Tests cover approval pause/resume, fresh Runtime instances, wrong/cross-run digests, denial, expiry, lost write responses, uncertain reconciliation, bounded provider-key retries, reconcile-only behavior, malformed output, wrong-record effects, transient reads, allowlists, sandbox restrictions, budgets, injected approval fields, fabricated evidence, malformed inputs, independent failure verdicts, bounded replanning, concurrent writer rejection, corrupt journals, invalid run IDs and planner-context isolation.

These tests were run before the stop request. At handoff, files and Git state were inspected; the implementation was not restarted or modified. Tests that construct a new Runtime in the same process do not prove OS-process crash recovery. The fixture planner is deterministic and no LLM was exercised.

Environment previously observed: Node `v22.22.3`, npm `10.9.8`, Python `3.13.5`. Zod is pinned to `4.6.4`; the lockfile records resolved development dependencies.

There is currently **no runnable demo**: `npm run demo` points to `src/cli.ts`, which does not exist. There is no build script, agent CI workflow, live connector, dashboard, replay runner or full domain implementation. The existing GitHub Actions workflow validates only the separate Qwen kit.

## 5. Known issues to address before treating the core as reliable

These are source-inspection findings, not claims of exhaustive review:

1. **Crashed owners leave permanent run locks.** `TraceStore.withRun` uses an exclusive `.lock` file and removes it only in `finally`. A killed process leaves the run locked. Implement race-safe recovery backed by evidence that the owner is dead; do not delete locks merely because a timeout elapsed. Test real child-process termination and recovery.
2. **A denial can be lost as run state at a crash boundary.** `approve(false)` appends `approval.denied` and then a separate terminal status. Projection reads status events, not the denial itself. A crash between those writes can leave a denied action appearing pending. Make denial authoritative during projection/execution and test the event boundary.
3. **Approval expiry is checked before the attempt loop, not before each retry.** A slow first attempt/verification can outlive approval before a second provider-key write. Recheck immediately before every write attempt and make the trace/evaluator semantics agree.
4. **Timeouts depend on cooperative implementations.** The runtime passes `AbortSignal.timeout`, but does not itself bound a planner, evaluator or tool that ignores the signal. Address hangs without allowing a timed-out write to overlap a duplicate attempt.
5. **Grounding checks accept overly broad event kinds.** `evaluateTrajectory` currently permits references to any `tool.result` or `tool.verification`, including unconfirmed write results and inconclusive verification. Require appropriate observed evidence; arbitrary valid sequence numbers do not prove a domain invariant.
6. **Pending-action digests do not bind implementation revisions.** They cover tool contracts, metadata, mission policy and input, but not a tool code revision. Plan how changed adapter behavior invalidates or safely reconciles a pending approval.
7. **Partial journal tails fail closed with no recovery procedure.** This prevents execution on damaged evidence but leaves operational recovery unfinished. Preserve original bytes and auditability when designing repair.
8. **Read retry exhaustion cannot recover through an ordinary resume.** Attempt counts are drawn from the entire step history. Decide and document a bounded operator retry policy; a permanently exhausted `TOOL_UNAVAILABLE` run should not masquerade as resumable.
9. **Independent evaluation is only a scaffold.** Fixture evaluators inspect in-memory state and cite broad observations. Implement domain-specific final-state and forbidden-action checks with matching evidence, including later outcome observations where required.

Do not lower the tests or completion criteria to make these items disappear. Add tests that reproduce the actual failure boundary and then repair it.

## 6. Separate-agent pathways and integration ownership

The two saved assignments are:

1. [DEVELOPMENT_PATHWAY_CONNECTORS.md](DEVELOPMENT_PATHWAY_CONNECTORS.md) — live GitHub, Sheets, Drive and Gmail adapters; owns `src/connectors/**`, `tests/connectors.*.test.ts`, connector fixtures and connector documentation.
2. [DEVELOPMENT_PATHWAY_DASHBOARD.md](DEVELOPMENT_PATHWAY_DASHBOARD.md) — local mission/approval/replay UI; owns `src/dashboard/**`, `tests/dashboard.*.test.ts`, dashboard fixtures and dashboard documentation.

Both briefs define interfaces, tests, security/approval boundaries and isolated snapshot workspaces. Those assignments have not been executed by this session. No connector or dashboard delivery exists in the primary checkout at handoff.

The senior/main developer owns runtime repair, CLI, memory/replay, all four domains, shared manifests, CI, production bridge wiring and combined verification. Checkpoint the current untracked implementation or use the briefs' complete local-snapshot procedure before starting parallel work. A clone of current GitHub main will not contain the contracts. Freeze an agreed baseline and communicate any contract changes to both agents; do not let either agent edit shared files independently.

## 7. External access and authorization

The user supplied an intended Google account privately in the conversation. Its address is deliberately omitted from this public-repository document. No OAuth grant or test Sheet/Drive resource was supplied. No Google app tools or Google credentials were available in this session's environment when inspected. GitHub connector tools were available to this assistant; that does not automatically provide credentials to the future runtime.

No external email was sent, no test Google resources were created, and no app integration was verified. Obtain the intended account's API access and select explicit test resources through an appropriate authentication flow. Never request or commit passwords/tokens. Before a live outbound action, prepare the exact recipient and content and obtain the required approval. Merely knowing an account address is not permission to send.

No other user workloads were halted and no background build/dev server from this implementation is left running. The earlier test and typecheck processes completed.

## 8. Recommended takeover order

1. Preserve and review the current primary checkout, including untracked source, lockfile and documentation. Establish a reproducible integration baseline without secrets or `node_modules`.
2. Reproduce the existing tests/typecheck, then add regressions for the reliability gaps above and repair the core.
3. Assign the two isolated briefs against that agreed baseline; retain shared-contract and merge ownership centrally.
4. Add a runnable mission CLI, durable sandbox fixtures and replay/checkpoint support. Distinguish synthetic evidence from live evidence in commands and output.
5. Implement the four domain scenarios against the same runtime, with the documented adversarial/failure cases and independent evaluators. Add a real model-planner integration with measured usage where available.
6. Integrate the live adapters and dashboard; verify the complete approved three-app mission using the selected test resources. A mock suite is not this acceptance test.
7. Validate clean dependency installation, full tests/typecheck, CLI behavior, browser flows, replay comparisons, CI and documentation. Update the ledger with concrete evidence and every remaining external dependency.
8. Review and publish the intended changes through the user's agreed Git workflow, then inspect the actual remote state and CI. Nothing in the local handoff establishes publication.

Baseline commands for the successor (not run as part of the stop/handoff request):

```bash
cd /home/fr3k/fr3k-public-build
git status --short
cd agentic-action-engine
npm ci
npm test
npm run typecheck
```

Completion remains unproven until every requirement in the plan and ledger has direct evidence. The previous agent has stopped implementation; the senior developer must explicitly take ownership before further development.
