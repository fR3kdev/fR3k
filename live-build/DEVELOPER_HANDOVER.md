# Developer handover — fR3k hackathon build

Prepared 2026-09-14, Australia/Brisbane. This is the current handover after the concurrent connector/dashboard jobs **and** the subsequent gap-fill session (crash recovery, replay/counterfactual runner, hardened Arga evidence). Read this document and `HACKATHON_DIRECTIVE.md` before continuing. `HANDOFF_MANIFEST.md` is historical: its uncommitted-runtime and unstarted-agent statements no longer describe this checkout.

## 1. Outcome and immediate objective

The repository now has both a hardened synthetic regression world **and a verified live three-app mission**. The live path is YouTube → GitHub → ntfy → GitHub evidence. Run `live-incident-1789331116305` observed the exact public stream and canonical GitHub issue before any mutation, stopped for exact approval before the ntfy notification, reconciled receipt `yNc6zkrpzqhg`, stopped again for exact approval before the GitHub evidence comment, read that comment back exactly, and finished at **`CONFIRMED_SUCCESS` / evaluator `1.00`**.

The Arga Support/Billing/CRM mission remains the hardened `SIMULATION_ONLY` regression fixture with crash recovery, replay/counterfactual, durable outcome memory, all eight adversarial variants, and the local operator dashboard. The bounded model-planner architecture is implemented and tested, but a live model-backed run remains optional polish rather than a prerequisite for the now-proven three-app integration.

The next developer should preserve the verified live path, keep the approval/read-back boundaries intact, and focus on presentation quality, demo ergonomics, and any remaining model-backed showcase. Do not weaken the evidence labels or replace the live mission with a mock.

## 2. Repository, branches and delivered commits

| Item | Value |
| --- | --- |
| GitHub | https://github.com/fR3kdev/fR3k |
| Primary checkout | `/home/fr3k/fr3k-public-build` |
| Integration branch | `main` |
| Baseline for both jobs | `ab2be86` — existing Arga sandbox mission |
| Connector delivery branch/worktree | `pathway/connectors`, `/home/fr3k/fr3k-connectors-pathway` |
| Connector delivery / main commit | `5c0f077` / `9d46a36` |
| Dashboard delivery branch/worktree | `pathway/dashboard`, `/home/fr3k/fr3k-dashboard-pathway` |
| Dashboard delivery / main commit | `caba00e` / `a220838` |
| Main runtime bridge, launcher, UI status fix and CI | `81f034e` |

The agents committed isolated deliveries; main cherry-picked only those deliveries. Their worktrees were clean at handoff and remain available. Do not cherry-pick them again. Both jobs have finished. No additional development agent needs to be awaited.

The handover/documentation commit follows the implementation commits above. Observe the current tip instead of assuming this document can contain its own final hash:

```bash
cd /home/fr3k/fr3k-public-build
git status --short --branch
git log -6 --oneline
git fetch origin
git rev-list --left-right --count main...origin/main
git worktree list
```

Preserve unrelated local changes and other workloads. Do not reset, clean or overwrite other worktrees. The original user requested the two jobs integrated to main and then this detailed handover; this does not authorize unrelated changes or external messages.

## 3. Scope decisions that must persist

- The rejected Gmail/Calendar direction remains rejected. Do not authenticate or implement those adapters.
- `DEVELOPMENT_PATHWAY_CONNECTORS.md` is superseded historical material. The executed connector assignment was GitHub-only, as recorded in the active directive.
- The judged live mission is YouTube live-state observation → GitHub incident grounding → approved ntfy operator notification → approved GitHub evidence write. Arga duplicate-charge resolution remains the regression/safety fixture.
- GitHub is the canonical incident/evidence bus in the live mission; YouTube and ntfy are necessary because they supply independent live state and operator notification boundaries.
- One approved live ntfy notification and one approved GitHub evidence comment were sent during the verified mission. No email, refund, CRM, or unrelated production mutation occurred.
- Account identifiers, tokens and private traces do not belong in public docs, fixtures or commits. Tool availability in the assistant does not supply a token to the Node runtime.
- Before a live write, prepare the exact target and action, obtain required user authorization, and execute through the policy/approval boundary. Knowing an account or having repository access is not permission to send an arbitrary message.

## 4. What is implemented

| Area | Files under `agentic-action-engine/` | Behavior and boundary |
| --- | --- | --- |
| Runtime | `src/core/orchestrator.ts`, `types.ts`, `state-machine.ts` | Typed mission, planning loop, policy, exact approvals, retries/reconciliation, evaluator and event projection. Existing reliability limitations remain below. |
| Tools | `src/tools/registry.ts` | Zod input/output validation, metadata, ToolFault classifications and verification contract. |
| Policy | `src/policy/engine.ts` | Tool allowlist, sandbox/live separation, autonomy and write budgets. |
| Traces | `src/trace/jsonl.ts` | JSONL, fsync, exclusive lock, sequence and hash checks. Stale-lock recovery (dead PID releases the lock, live PID stays busy) and audited `repairTail` (snapshot-only truncation of the uncommitted tail). |
| Evaluation | `src/eval/evaluator.ts` | Domain checks plus runtime policy, verification and grounding checks; a passing final-state claim about a run with writes must cite a confirmed read-back for each written tool. |
| Memory | `src/memory/store.ts`, `src/memory/durable.ts` | In-memory retrieval plus append-only, fsynced, hash-chained `DurableMemoryStore` that persists the outcome of every terminal run and reconstructs it across a restarted process; outcomes seed later missions. |
| Model planner | `src/model/` | Bounded model-driven planner: provider sees only a trimmed schema-valid snapshot, `guardProviderDecision` enforces tool allowlist, real evidence refs, ref budget, write-grounding and no-evidence-finish; `createFetchModelProvider` (OpenAI-compatible) and fail-closed credentials. |
| Arga | `src/demo/arga-mission.ts` | Five tools across three simulated boundaries; v2 planner/evaluator, raw-payment-ledger duplicate proof, durable refund records, exact customer/amount/currency binding, unrelated-charge read-back, `reconstructArgaState` from the journal, replay-safe refunds. |
| Arga variants | `src/demo/arga-variants.ts` | All eight PLAN.md adversarial variants as reproducible regression assets with invariant assertions; the partial-refund variant exposed and fixed a real refund-adoption bug. |
| Replay | `src/demo/replay-bridge.ts` | Crash replay and counterfactual runner over rebuilt Arga state; emits baseline/candidate check diffs. |
| Live launch | `src/live/github.ts`, `src/cli-live.ts` | Read-only GitHub attach: token from `GH_TOKEN`/`GITHUB_TOKEN` or `gh auth token` (fail closed), REST reads labelled `VERIFIED` through the runtime, writes never registered. |
| Live incident mission | `src/connectors/incident.ts`, `src/demo/live-incident-mission.ts`, `src/live-cli.ts` | Real YouTube + GitHub + ntfy workflow with exact approval before both writes, reconcile-only semantics, read-after-write verification, evaluator score 1.00 on the verified run. |
| CLI demo | `src/cli.ts` | Runs the mission, then prints crash replay and v1 counterfactual; automatically approves sandbox actions as `demo-operator`; never use this as the approval design for live actions. |
| GitHub adapters | `src/connectors/index.ts` | Issue read and evidence comment write, fixed origin, repository allowlist, sanitized faults, exact reconciliation. |
| Dashboard contract | `src/dashboard/bridge.ts` | Injected list, inspect, approve, resume and compare bridge. |
| Dashboard server/UI | `src/dashboard/server.ts`, `assets.ts` | Loopback API, protected mutations, evidence/trace/approval/evaluation/comparison UI. |
| Dashboard fixtures | `src/dashboard/fixture.ts` | Synthetic success/failure/expired/unavailable/uncertain cases, visibly marked fixture mode. |
| Actual runtime bridge | `src/demo/dashboard-bridge.ts` | Delegates to explicitly attached Runtime instances; no independent permission logic or direct tool writes. |
| Actual runtime launcher | `src/demo/dashboard-cli.ts` | Two fresh Arga runs, manual browser approvals, retained temporary traces. |
| CI | `../.github/workflows/agent-runtime-validate.yml` | Node 22, npm ci, typecheck, all tests, sandbox demo on push/PR. Existing Qwen CI is separate. |

### GitHub contract

`registerLiveConnectors(registry, { githubToken, allowedRepositories, fetch? })` registers:

- `github.read_issue`: `{ repository, issueNumber }` → normalized issue identity, body, state and source URL.
- `github.write_evidence`: `{ repository, issueNumber, body }` → comment ID and source URL. Live write, autonomy 2, `reconcile-only`.

The credential callback and allowlist are captured at registration. Requests go only to `https://api.github.com`, with redirects rejected. The API version is pinned to `2026-03-10`; supporting official references are in `docs/CONNECTORS.md`.

The write appends a hash-based correlation marker. Verification scans paginated comments, rejects duplicate markers, requires exact issue/body/source identity, then GETs the exact comment. A POST response alone is not confirmation. Empty search results, malformed responses, changed content or ambiguous results remain unknown; no blind write retry is added. Correlation markers are not provider-enforced idempotency keys.

These adapters are wired into the live incident launcher with an exact repository allowlist and operator approval boundary. The GPD `gh` session supplied the runtime token during the verified mission. The evidence write is confirmed in issue #1; do not broaden repository scope or remove the approval requirement.

### Dashboard contract and security

`startDashboard({ bridge, port?, actor? })` binds `127.0.0.1`, default port 4317, and returns `{ url, close }`. Port 0 is supported for tests. The host supplies the actor, default `local-operator`.

| Route | Purpose |
| --- | --- |
| `GET /api/runs` | List attached runs |
| `GET /api/runs/:id` | Inspect RunView; includes `dashboard.resuming` and `dashboard.resumeError` |
| `POST /api/runs/:id/approval` | Exact `{ digest, allow }`; actor cannot be supplied by browser |
| `POST /api/runs/:id/resume` | Empty object; queues execution, returns 202, rejects overlapping resumes |
| `GET /api/compare?baseline=...&candidate=...` | Compare bridge-provided metrics |

Mutations require exact Origin, strict JSON, a random token header and valid Host. The server rejects oversized bodies, hostile paths and cross-origin requests; the browser renders untrusted text via text nodes under CSP. It loads no external scripts/fonts. This is a local operator interface, not multi-user authentication or an externally deployable service.

Approval and Resume are deliberately separate. Expired approvals refresh through runtime resume. An uncertain side effect offers reconciliation, not a resend shortcut. Polling updates active runs and sidebar statuses. The UI preserves expanded cards and focus across refreshes.

## 5. Run the current build

Node observed: `v22.22.3`. Dependencies: existing TypeScript, tsx, Zod and Node types; no new production dashboard dependency.

```bash
cd /home/fr3k/fr3k-public-build/agentic-action-engine
npm ci
npm run typecheck
npm test
npm run demo
npm run dashboard
npm run demo:live
```

`npm run demo:live` is the judged external-app path. It reads the exact YouTube stream and GitHub issue, then prompts for each real write. Do not set `FR3K_APPROVE=1` for ordinary demos unless the exact ntfy topic/message and GitHub evidence comment have already been reviewed and authorized.

Open the loopback URL printed by the launcher. The ordinary startup sequence is:

1. Select `arga-baseline`, Resume, inspect the proposed Billing refund and its cited observations.
2. Approve the exact action. Confirm that no write executes until Resume is selected separately.
3. Resume, inspect the CRM update, approve and Resume again.
4. Observe `CONFIRMED_SUCCESS`, evaluator checks, read-back observations and trace.
5. Select `arga-candidate`, Resume to its approval, then Deny. Confirm no refund is performed.
6. Compare baseline/candidate outcomes.

Both runs use identical planner/configuration. Their different outcomes illustrate operator decisions; they are not evidence of a better model, policy candidate or checkpoint replay.

For UI-only fixtures:

```bash
node --import tsx src/dashboard/fixture.ts
```

Do not run both launchers on the default port simultaneously. The verification servers started in this session are stopped at handoff.

## 6. Verification actually performed

| Check | Observed result |
| --- | --- |
| Clean dependency install | Passed, Node 22 |
| Combined `npm test` | **77 passed, 0 failed, 0 skipped** on the integrated live branch |
| `npm run typecheck` | Passed |
| `npm run demo` | `CONFIRMED_SUCCESS`, evaluator 1.00; replay candidate `CONFIRMED_SUCCESS` score 1.00 with zero regressions; v1 counterfactual listed the three proofs it never evaluates; durable-outcome reconstruction line; 8-variant adversarial panel all PASS |
| `npm run demo-live` | Existing read-only GitHub attach still passes; separate judged `npm run demo:live` completed the real YouTube → GitHub → ntfy → GitHub evidence mission at `CONFIRMED_SUCCESS`, score 1.00 |
| Live three-app mission | Run `live-incident-1789331116305`; ntfy receipt `yNc6zkrpzqhg`; GitHub evidence comment `5655933189`; all 7 checks pass; both writes approved and read back |
| Reliability cases | 9 tests: stale-lock recovery and live-owner busy; audited `repairTail` (snapshot, tail-only truncation, corrupt-prefix refusal); torn-status authoritative denial; `HangError` on a hung planner; hung-read budget exhaustion plus `recover()`; deployed tool-revision invalidating a granted approval; `reconstructArgaState` and no-second-refund replay; counterfactual diff of the v1 design |
| Durable memory cases | 3 tests: outcome memory reconstructed after a restart and fed back; append-only and hash-reject; outcome seeded into the next run |
| Bounded planner cases | 8 tests: happy path to independent green; forbidden-tool injection; ghost evidence ref; write without evidence; finish without evidence; provider hang; fail-closed credentials; ref-budget guard |
| Adversarial variant cases | 2 tests: all 8 variants hold invariants (partial-refund bug fixed); every variant ends terminal/policy state |
| Connector cases | 14 passing tests: validation, allowlisting, fault sanitization, rate limiting, abort, pagination, duplicate/wrong markers, exact read-back, lost response, no blind retry |
| Dashboard API cases | 2 tests containing multiple assertions: actor binding, stale/expired approvals, allow/deny, asynchronous resume, overlap, background errors, Origin/Host/token/path/body limits |
| Actual bridge | 1 integration test: real Arga success versus denial, stale digest, approval does not execute, comparisons and unknown metrics |
| Fixture Chromium | Keyboard approval/resume/denial, expired refresh, comparisons, unavailable/uncertain/failure/success, literal injection text, mobile layout, no page JS errors |
| Actual-runtime Chromium | Keyboard approval/denial, separate resumes, completed versus denied state, comparisons, sidebar status updates, 390px mobile without page overflow, no page JS errors |
| Git whitespace check | Passed before integration commit |

Test-count breakdown: 28 runtime behavior tests + 1 Arga test + 14 connector tests + 2 dashboard API tests + 1 runtime bridge test + 9 reliability/replay tests + 3 durable memory tests + 8 bounded planner tests + 2 adversarial variant tests + 2 live launcher tests = 70.

The browser run after the sidebar fix repeated the full actual-runtime acceptance and explicitly checked final sidebar statuses. Tests and screenshots prove local behavior only. Remote CI is a separate observation; use the publication record at the end of this file and the Actions page for current results.

### Local evidence artifacts

| Artifact | Path |
| --- | --- |
| Fixture automation and screenshots | `/tmp/fr3k-dashboard-evidence/browser.mjs`, `desktop.png`, `mobile.png` |
| Actual-runtime automation | `/tmp/fr3k-dashboard-runtime-browser.mjs` |
| Actual-runtime screenshots | `/tmp/fr3k-dashboard-runtime-desktop.png`, `/tmp/fr3k-dashboard-runtime-mobile.png` |
| Latest actual-runtime traces | `/tmp/fr3k-dashboard-lQrMub/` |
| Earlier actual-runtime traces | `/tmp/fr3k-dashboard-6sYRHs/` |

These are ephemeral local files, not repository assets. Preserve copies in an approved evidence location if needed. The browser scripts use existing `/home/fr3k/supergrok-heavy-wrapper/node_modules/playwright-core` and `/bin/chromium`; neither path is portable. Install an appropriate browser harness in a clean environment before reproducing browser checks there.

## 7. Known limitations and concrete engineering work

### P0: select and prove the real mission — completed

The judged path is now YouTube → GitHub → ntfy → GitHub evidence. It is recorded in the directive and issue #1. The verified run used real provider state, exact approval before both external writes, reconcile-only semantics, and independent read-back. The first ntfy poll exposed provider visibility lag; the runtime failed closed instead of duplicating the notification, then operator-only verifier reconciliation confirmed the original receipt.

Acceptance is satisfied by run `live-incident-1789331116305` and evidence comment `5655933189`. Preserve this path as the headline proof.

### P0: harden the Arga mission and evaluator — completed in the gap-fill session

The following items from the previous handover are **resolved** and covered by tests:

- Durable provider/sandbox refund records persisted in `state.refunds`, read back on verify, and reused on replay (no second refund after crash reconstruction).
- Explicit duplicate-charge evidence derived from the raw payment ledger (grouping identical customer/amount/currency/reference/service/chargeId keys), not from narrative notes.
- Exact customer/amount/currency/refund binding in the evaluator and verifier.
- Evidence-specific evaluator references; `runtime.grounding` requires each written tool to be accounted for by a confirmed read-back.
- Unrelated-charge invariant preserved via an explicit post-refund read-back of CHG-89 and an evaluator check that no CHG-89 refund exists.
- `reconstructArgaState(events, seed)` rebuilds Arga app state from the durable journal.

**Remaining for the mission:** the mission planner `arga-planner-v2` is deterministic and emergency-drives incident/charge IDs from closure state (full history of the bounded model-backed `src/model/` design is shipped, but no live API key is set, so no model-backed run has been certified). The `npm run dashboard` launcher still creates fresh in-memory app state on startup; the replay runner (not the dashboard) is the crash-recovery path today. Live GitHub reads and the approval-gated evidence write are proven in the three-app mission. The Arga dashboard itself remains synthetic; do not conflate that UI fixture with the external-app proof.

### P0/P1: runtime crash and retry boundaries — completed in the gap-fill session

Each gap below is now resolved and regression-tested:

- **Crash between provider side effect and verification:** `recover()`/reconciliation reopens the journal, reconciles the exact action and never duplicates a provider-key write; replay against rebuilt state mints one refund identity only.
- **Incomplete JSONL tail:** `repairTail(runId)` fails closed, preserves the original bytes in `{run}.jsonl.incomplete.{ts}`, truncates only the uncommitted tail, and refuses corrupt committed prefixes.
- **Denial crash boundary:** `approval.denied` is authoritative in `project()` even if the process died before the terminal `run.status` append.
- **Retry expiry:** approval validity is rechecked immediately before every write attempt (`approvedAtBoundary()`), not only once before the loop.
- **Uncooperative timeouts:** `timed()` enforces a hard deadline and raises `HangError`; hung planner → `CONFIRMED_FAILURE`, hung read → classified `TRANSIENT` and bounded.
- **Evidence validation:** `runtime.grounding` requires each executed write tool to be certified by a confirmed read-back in some passing domain check.
- **Implementation revision binding:** approval digests bind the tool implementation `revision` (SHA-256 of execute+verify source); a deploy under a pending action yields `DENIED_BY_POLICY` with reason `Tool contract or action changed after planning`.
- **Exhausted reads:** explicit audited `recover()` (appends `runtime.recovery`, scales the read budget) is the only way to continue after `TOOL_UNAVAILABLE`; a fresh `run()` alone does not grant a new budget.

Reuse killed child-process and lost-response tests where appropriate; an in-process synthetic success is insufficient for crash acceptance. The reliability fixtures use in-process hangs and torn journal byte surgery as deterministic stand-ins.

### P1: memory, replay and metrics

`MemoryStore` provides lexical in-memory retrieval; `DurableMemoryStore` (`src/memory/durable.ts`) is now the journal-backed outcome memory: append-only, fsynced, hash-chained, and the runtime persists the outcome of every terminal run and reconstructs it across a restarted process, seeding later missions. `reconstructArgaState` + `replay-bridge.ts` provide isolated checkpoint replay and baseline/candidate revision execution.

The bridge counts tool-start events and unverified write steps from traces. Score comes from the independent evaluator. Policy violations are 0 only when the runtime policy check has passed; otherwise the value is unknown. Confidence, cost and latency remain unmeasured. Trace elapsed time includes operator waiting and must not be relabelled execution latency. Add actual usage/timing instrumentation before populating those fields.

### P1: dashboard lifecycle and usability

`close()` closes the server and sockets; it does not cancel an accepted bridge/runtime operation. Define drain/cancel behavior before relying on shutdown during live writes. The launcher keeps traces but cannot resume its old in-memory app states on restart; journal-to-state recovery exists today only in `replay-bridge.ts`. Keep old journals read-only unless their corresponding durable app state exists.

The UI is functional and browser-tested, but uses large embedded JavaScript/CSS strings. A future maintainability pass can extract readable local assets without introducing unsafe HTML rendering or external dependencies. Keep keyboard, small-screen, expiry and uncertainty cases in acceptance.

### P2: expand only after one complete vertical slice

See `PLAN.md` for Lemma, Comma Capital, Arga Labs adversarial variants and Userlens. The full domain scenarios, replay-backed repair proof, a live model-backed planner run and judged demo polish are unfinished. Do not mark them complete based on this dashboard delivery.

## 8. Suggested execution order for the successor

1. Observe Git state and current Actions results. Read the directive and this handover; treat old manifests as history.
2. Reproduce the 70-test/typecheck/demo baseline in a clean install. Run browser acceptance if modifying UI or bridge behavior.
3. Inventory live capabilities and record exact mission/resource acceptance before any live write integration.
4. The durable side-effect/recovery semantics, billing evidence, outcome memory, bounded model planner and adversarial variants are now proven in sandbox (see the marked-complete P0 sections); keep them as regression fixtures while attaching the necessary real adapters and a model-backed run to the existing runtime and dashboard, preserving approval separation.
5. Verify a single real three-app mission and its forbidden-effects checks with retained source evidence; live GitHub reads are the proven anchor today, live writes await operator approval and exact targets.
6. Demonstrate a failing baseline and justified passing candidate using `replay-bridge.ts` for a different model/policy/adapter revision.
7. Update `STATUS.md`, `COMPLETION.md`, `BUILD_LOG.md`, demo instructions and this handover with actual evidence, limitations and commit IDs. Keep old dated verification snapshots clearly historical.

## 9. Key references

- `HACKATHON_DIRECTIVE.md`: active scope and recorded mission.
- `PLAN.md`, `ARCHITECTURE.md`: full requirements and design.
- `STATUS.md`, `COMPLETION.md`, `BUILD_LOG.md`: progress and dated evidence; newer entries supersede old snapshots.
- `../agentic-action-engine/docs/CONNECTORS.md`: host contract, permissions, API references and live gate.
- `../agentic-action-engine/docs/DASHBOARD.md`: API, security, startup and browser evidence.
- `DEVELOPMENT_PATHWAY_DASHBOARD.md`: original detailed acceptance brief.
- `HANDOFF_MANIFEST.md`: historical runtime risk inventory, not current checkout/agent state.

## 10. Publication record

Implementation was published to `origin/main`, including connector `9d46a36`, dashboard `a220838`, integration `81f034e`, handover `dc2b222`, and the gap-fill batch `7fb5b77`/`f6bfff4` (crash recovery + replay) followed by `dc647ad` (durable outcomes, bounded model planner, adversarial variants, live GitHub attach). Another writer updated the livestream links during development; those commits (`96f3706`, `7867199`) were preserved with merge `f3553d9`, with no force push. `git ls-remote` confirmed `origin/main` after publication; the working tree was clean.

Local checks passed as recorded above. New GitHub CI results were not yet observed when this publication record was written. Inspect https://github.com/fR3kdev/fR3k/actions for `validate-agent-runtime` and `validate-qwen-4gb-kit` on the current commit. Do not mistake earlier successful Qwen-only checks for runtime validation.
