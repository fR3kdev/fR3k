# Local mission dashboard

Run the synthetic demonstration from `agentic-action-engine/`:

```bash
npm ci
node --import tsx src/dashboard/fixture.ts
```

Open http://127.0.0.1:4317. Every demonstration mission is conspicuously labelled FIXTURE MODE and SIMULATION_ONLY. Fixtures include active, pending, expired, denied, unavailable tool, uncertain side effect, failed evaluation, successful evaluation, injection text and long input. These fixtures do not demonstrate live provider execution.

Production hosts inject the five-method `DashboardBridge` from `src/dashboard/bridge.ts` into `startDashboard({ bridge, port, actor })`. Port defaults to 4317; zero requests an ephemeral port. The returned `close()` stops the HTTP server and connections. It does not cancel a runtime operation already accepted by the bridge. Bridge implementations must provide their own runtime cancellation if required.

The host sets the trusted actor (default `local-operator`). Approve and Deny submit only the displayed digest and decision. Approval never resumes execution. Resume queues a background operation, returns 202 immediately, and rejects overlapping resumes for the same run. Reconcile does the same for a failed run with a pending write: it queues verifier-only reconciliation (202), rejects overlapping reconciles and any run that is not `CONFIRMED_FAILURE` with a pending write (409), and never re-executes the action. Inspection adds `dashboard.resuming`, `dashboard.resumeError`, `dashboard.reconciling` and `dashboard.reconcileError` to the bridge's RunView; background errors are visible without changing journal data. Runtime errors return 409, invalid bodies 400, missing runs 404 when the bridge reports not found/missing/no events, and excessive bodies 413.

The server binds to IPv4 loopback and validates Host. Mutations require exact Origin, application/json, a random per-server header token, and strict request schemas. Cross-origin reads are rejected when Origin is present. Tokens appear only in the local page's meta tag, never URLs or logs. No external scripts, fonts or assets are loaded. Text from tools is rendered with textContent under a restrictive content security policy.

The browser polls active, approval and uncertain runs once per second; navigation and page teardown clear pending timers. Expanded trace/input cards and keyboard focus are retained across refresh. Expired approvals require refresh and review. Uncertain writes offer runtime verification, with no resend shortcut. Observations retain evidence labels; historical memory remains separate. Evaluator checks are distinct from planner completion. Comparison metrics come exclusively from the bridge: null means “Not measured.” Run-level confidence, cost and latency remain unmeasured because RunView does not expose these fields.

Validation:

```bash
node --import tsx --test tests/dashboard.*.test.ts
npm run typecheck
```

The API tests exercise trusted actor binding, exact decisions, expired and stale approvals, asynchronous resumes, background failures, duplicate resumes, verifier-only reconciliation with overlap and ineligible-run guards, body limits, hostile origins/hosts, malformed paths and injection-safe rendering. Browser evidence is recorded separately from runtime integration evidence.

Fixture browser acceptance (2026-09-14): headless `/bin/chromium` with the pre-existing Playwright installation passed keyboard approve → independent Resume → success, expired request refresh → keyboard deny, baseline/candidate comparison, unavailable/uncertain/failure/success state navigation, injection text rendering, and 390px mobile viewport without horizontal overflow. No page JavaScript errors occurred. Screenshots: `/tmp/fr3k-dashboard-evidence/desktop.png` and `/tmp/fr3k-dashboard-evidence/mobile.png`; automation: `/tmp/fr3k-dashboard-evidence/browser.mjs`. These are local session artifacts, not committed private traces. Production runtime acceptance is a separate integration gate.

## Actual Arga runtime integration

Run `npm run dashboard` from `agentic-action-engine/` to use `src/demo/dashboard-cli.ts` and `src/demo/dashboard-bridge.ts`. This executes the actual Runtime with independent baseline/candidate Arga sandbox states. Both runs use the same planner; comparison is not checkpoint replay or evidence of model improvement. The browser controls exact approvals and separate resumes. Every launch creates a new temporary trace directory and fresh app state.

Main integration acceptance passed on 2026-09-14: approve and separately resume both writes to achieve CONFIRMED_SUCCESS, deny the other run before its write, compare recorded outcomes, verify updated sidebar statuses, and check a 390px mobile viewport. No page errors. Local evidence: `/tmp/fr3k-dashboard-runtime-browser.mjs`, `/tmp/fr3k-dashboard-runtime-desktop.png`, `/tmp/fr3k-dashboard-runtime-mobile.png`. This validates sandbox runtime integration; live provider execution remains pending.
