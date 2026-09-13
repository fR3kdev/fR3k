# Developer handover — fR3k hackathon build

Prepared 2026-09-14, Australia/Brisbane. This is the current handover after the two concurrent connector and dashboard jobs. Read this document and `HACKATHON_DIRECTIVE.md` before continuing. `HANDOFF_MANIFEST.md` is historical: its uncommitted-runtime and unstarted-agent statements no longer describe this checkout.

## 1. Outcome and immediate objective

The repository now has a working local operator dashboard attached to the actual Arga runtime, contract-tested GitHub adapters, and an agent-runtime CI workflow. The dashboard can pause before a refund, accept an exact operator approval, execute only after a separate Resume, verify the sandbox result, repeat for CRM, and display independent evaluation. A second independent run can be denied and compared with the successful run.

**The hackathon submission is not complete.** All Arga app state is synthetic and in memory. GitHub adapters are implemented but not attached to the Arga mission or verified through authenticated runtime calls. Three necessary live external apps, a model-driven planner, durable recovery and checkpoint replay remain unfinished.

The next developer should complete one coherent, evidenced vertical slice before expanding the four planned worlds. Do not represent a simulation, fixture screenshot, or connector unit test as external-app completion.

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
- The recorded mission is Arga duplicate-charge resolution: Support Desk intake → Billing refund → CRM resolution, with exact approval and read-back at each write.
- GitHub availability is supporting infrastructure, not a reason to invent a generic connector-count demo.
- No live comments, emails, refunds or CRM updates were sent during these jobs. Tests used injected transports and synthetic state.
- Account identifiers, tokens and private traces do not belong in public docs, fixtures or commits. Tool availability in the assistant does not supply a token to the Node runtime.
- Before a live write, prepare the exact target and action, obtain required user authorization, and execute through the policy/approval boundary. Knowing an account or having repository access is not permission to send an arbitrary message.

## 4. What is implemented

| Area | Files under `agentic-action-engine/` | Behavior and boundary |
| --- | --- | --- |
| Runtime | `src/core/orchestrator.ts`, `types.ts`, `state-machine.ts` | Typed mission, planning loop, policy, exact approvals, retries/reconciliation, evaluator and event projection. Existing reliability limitations remain below. |
| Tools | `src/tools/registry.ts` | Zod input/output validation, metadata, ToolFault classifications and verification contract. |
| Policy | `src/policy/engine.ts` | Tool allowlist, sandbox/live separation, autonomy and write budgets. |
| Traces | `src/trace/jsonl.ts` | JSONL, fsync, exclusive lock, sequence and hash checks. No safe crash recovery yet. |
| Evaluation | `src/eval/evaluator.ts` | Domain checks plus runtime policy, verification and grounding checks. |
| Memory | `src/memory/store.ts` | In-memory retrieval; not durable outcome memory. |
| Arga | `src/demo/arga-mission.ts` | Four tools across three simulated boundaries; deterministic planner and in-memory state. |
| CLI demo | `src/cli.ts` | Automatically approves sandbox actions as `demo-operator`; never use this as the approval design for live actions. |
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

These adapters are not wired into a production mission launcher. Live testing still needs host credentials, an exact repository allowlist, approved resources and real runtime evidence. `gh` was not available on PATH during this session; Git operations worked over the configured remote and GitHub inspection used connector tools/public REST. Do not assume old handoff claims about the CLI or OAuth scopes describe the current environment.

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
```

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
| Combined `npm test` | **46 passed, 0 failed, 0 skipped** |
| `npm run typecheck` | Passed |
| `npm run demo` | `CONFIRMED_SUCCESS`, evaluator 1.00 |
| Connector cases | 14 passing tests: validation, allowlisting, fault sanitization, rate limiting, abort, pagination, duplicate/wrong markers, exact read-back, lost response, no blind retry |
| Dashboard API cases | 2 tests containing multiple assertions: actor binding, stale/expired approvals, allow/deny, asynchronous resume, overlap, background errors, Origin/Host/token/path/body limits |
| Actual bridge | 1 integration test: real Arga success versus denial, stale digest, approval does not execute, comparisons and unknown metrics |
| Fixture Chromium | Keyboard approval/resume/denial, expired refresh, comparisons, unavailable/uncertain/failure/success, literal injection text, mobile layout, no page JS errors |
| Actual-runtime Chromium | Keyboard approval/denial, separate resumes, completed versus denied state, comparisons, sidebar status updates, 390px mobile without page overflow, no page JS errors |
| Git whitespace check | Passed before integration commit |

Test-count breakdown: 28 existing runtime behavior tests + 1 Arga test + 14 connector tests + 2 dashboard API tests + 1 runtime bridge test = 46.

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

### P0: select and prove the real mission

1. Inventory apps and runtime authentication actually available now. Assistant connector access is not host authentication.
2. Choose three necessary app roles for the recorded Arga problem or explicitly record a justified replacement in the directive before building it. GitHub-only capability does not satisfy this gate.
3. Define exact test resources, customer/charge identity, permitted action, forbidden effects and evidence requirements.
4. Build the thinnest adapters and launcher around those contracts, with injected credentials, allowlists and exact-action approval.
5. Capture authenticated reads and approved writes with independent read-back through the runtime. Do not substitute API mocks or the current state Maps.

Acceptance: one reproducible workflow across three real app boundaries, policy pauses before consequential actions, exact records verified afterward, unrelated records preserved, independent evaluator grounded in those observations.

### P0: harden the Arga mission and evaluator

The current planner is deterministic and uses closure state to choose incident/charge IDs; it is not an LLM planner grounded solely in observations. The evaluator inspects in-memory Maps and gives its checks broad observation references. The seed data and prompt label the charge duplicate, but the mission does not yet independently prove a duplicate transaction from a billing ledger.

The refund verifier confirms a refunded flag plus supplied result and constructs the refund marker from that result; it does not persist an independent provider refund record. A new createArgaMission call resets app state. Tests showing a fresh Runtime object over shared fixture state do not prove process-restart recovery of the Arga app.

Required improvements: durable provider/sandbox records, explicit duplicate-charge evidence, exact customer/amount/currency/refund binding, evidence-specific evaluator references, adversarial variants, and a bounded model-backed planner if required by the submission. Preserve the unrelated-charge invariant.

### P0/P1: runtime crash and retry boundaries

The parallel jobs did not repair the existing runtime reliability gaps. Reproduce each with a focused regression before changing behavior:

- **Crash between provider side effect and verification:** safely reopen the journal, reconcile the exact external action and never duplicate it. Current exclusive lock files can survive process death; there is no stale-lock recovery protocol.
- **Incomplete JSONL tail:** fails closed, with no audited repair procedure. Preserve original bytes and evidence if adding recovery.
- **Denial crash boundary:** `approval.denied` and terminal `run.status` are separate appends; projection takes its status from status events. A crash between them can leave misleading pending state. Make denial authoritative.
- **Retry expiry:** approval validity is checked before the attempt loop, not immediately before every potential write retry. Recheck at the actual side-effect boundary.
- **Uncooperative timeouts:** signals do not bound a planner/tool/evaluator that ignores cancellation. Avoid allowing timed-out writes to overlap retries.
- **Evidence validation:** trajectory grounding accepts broad tool-result/verification event references. Require appropriate confirmed observations for each invariant.
- **Implementation revision binding:** approval digests include metadata/schema/action/policy, not executable adapter revision. Define safe behavior when implementation changes under a pending action.
- **Exhausted reads:** attempt counts span the step history; ordinary Resume does not grant a new read budget. Document or implement an explicit bounded recovery operation.

Use killed child-process and lost-response tests where necessary; an in-process synthetic success is insufficient for crash acceptance.

### P1: memory, replay and metrics

Memory is in memory and lexical. There is no durable outcome update, isolated checkpoint replay or baseline/candidate revision execution. Implement these before presenting the comparison panel as replay.

The bridge counts tool-start events and unverified write steps from traces. Score comes from the independent evaluator. Policy violations are 0 only when the runtime policy check has passed; otherwise the value is unknown. Confidence, cost and latency remain unmeasured. Trace elapsed time includes operator waiting and must not be relabelled execution latency. Add actual usage/timing instrumentation before populating those fields.

### P1: dashboard lifecycle and usability

`close()` closes the server and sockets; it does not cancel an accepted bridge/runtime operation. Define drain/cancel behavior before relying on shutdown during live writes. The launcher keeps traces but cannot resume its old in-memory app states on restart. Keep old journals read-only unless their corresponding durable app state exists.

The UI is functional and browser-tested, but uses large embedded JavaScript/CSS strings. A future maintainability pass can extract readable local assets without introducing unsafe HTML rendering or external dependencies. Keep keyboard, small-screen, expiry and uncertainty cases in acceptance.

### P2: expand only after one complete vertical slice

See `PLAN.md` for Lemma, Comma Capital, Arga Labs adversarial variants and Userlens. The full domain scenarios, replay-backed repair proof, durable outcome memory and judged demo polish are unfinished. Do not mark them complete based on this dashboard delivery.

## 8. Suggested execution order for the successor

1. Observe Git state and current Actions results. Read the directive and this handover; treat old manifests as history.
2. Reproduce the 46-test/typecheck/demo baseline in a clean install. Run browser acceptance if modifying UI or bridge behavior.
3. Inventory live capabilities and record exact mission/resource acceptance before external integration.
4. Prioritize durable side-effect/recovery semantics and genuine billing evidence; prove failure cases before live writes.
5. Attach the necessary real adapters and planner to the existing runtime and dashboard, preserving approval separation.
6. Verify a single real three-app mission and its forbidden-effects checks with retained source evidence.
7. Implement isolated replay and durable outcome memory, then demonstrate a failing baseline and justified passing candidate.
8. Update `STATUS.md`, `COMPLETION.md`, `BUILD_LOG.md`, demo instructions and this handover with actual evidence, limitations and commit IDs. Keep old dated verification snapshots clearly historical.

## 9. Key references

- `HACKATHON_DIRECTIVE.md`: active scope and recorded mission.
- `PLAN.md`, `ARCHITECTURE.md`: full requirements and design.
- `STATUS.md`, `COMPLETION.md`, `BUILD_LOG.md`: progress and dated evidence; newer entries supersede old snapshots.
- `../agentic-action-engine/docs/CONNECTORS.md`: host contract, permissions, API references and live gate.
- `../agentic-action-engine/docs/DASHBOARD.md`: API, security, startup and browser evidence.
- `DEVELOPMENT_PATHWAY_DASHBOARD.md`: original detailed acceptance brief.
- `HANDOFF_MANIFEST.md`: historical runtime risk inventory, not current checkout/agent state.

## 10. Publication record

Implementation is committed locally through `81f034e`, preceded by connector `9d46a36` and dashboard `a220838`. The handover commit and remote verification are recorded by the finishing agent below. Consult the actual branch and Actions runs if this snapshot has aged.
