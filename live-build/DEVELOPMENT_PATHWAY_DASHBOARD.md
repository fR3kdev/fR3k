# Development pathway 2 — Mission dashboard and approval UI

## Mission and ownership

Build a local dashboard that lets a person see what the agent is doing, inspect its evidence, approve or deny an exact action, and compare replay results. The main agent owns the runtime, domain logic, evaluation, replay, CLI integration and shared configuration. The other delegated pathway owns live connectors.

This is a standalone assignment for one development agent. It can be completed using an injected runtime bridge and synthetic fixtures, without Google access or a dependency on the connector agent.

## Isolation rules

Work in an isolated copy at `/home/fr3k/fr3k-dashboard-pathway`, on branch `pathway/dashboard`. Never edit the primary checkout or the connector agent's copy.

The runtime is currently uncommitted, so cloning GitHub main alone will omit the integration contracts. At assignment time, take a local snapshot of the primary checkout: copy tracked files plus the current `agentic-action-engine/` source and `live-build/` documents, excluding `.git`, `node_modules`, `dist`, `runs`, logs, `.env` and other credential files. Initialize a new local Git repository in the isolated copy and commit that snapshot as the baseline before editing. Keep that baseline commit separate from the delivery commits.

Own only these paths relative to the repository root:

- `agentic-action-engine/src/dashboard/**`
- `agentic-action-engine/tests/dashboard.*.test.ts`
- `agentic-action-engine/tests/fixtures/dashboard/**`
- `agentic-action-engine/docs/DASHBOARD.md`

Do not edit shared types, runtime, connectors, package manifests, lockfiles, CI, status board or build log. Use Node 22's HTTP server and browser-native HTML, CSS and JavaScript, with no new production dependencies or frontend framework. Report shared-contract changes to the main agent instead of making them.

## Integration contract

Read `src/core/types.ts`, `src/core/orchestrator.ts` and `src/trace/jsonl.ts` inside `agentic-action-engine/` first. The dashboard consumes `RunView`; it does not mutate journals, calculate permission decisions or independently execute tools.

Define and export the following bridge in `src/dashboard/bridge.ts`:

```ts
interface DashboardBridge {
  listRuns(): Promise<Array<{ id: string; world: string; goal: string; status: string }>>;
  inspect(runId: string): Promise<RunView>;
  approve(runId: string, digest: string, actor: string, allow: boolean): Promise<RunView>;
  resume(runId: string): Promise<RunView>;
  compare(runIds: [string, string]): Promise<DashboardComparison>;
}

interface DashboardComparison {
  runs: Array<{
    runId: string;
    label: string;
    status: string;
    score: number | null;
    toolCalls: number;
    policyViolations: number | null;
    unverifiedWrites: number | null;
    latencyMs: number | null;
    costUsd: number | null;
  }>;
}
```

Import `RunView` from the core types. The main agent will supply the production bridge; this pathway supplies a deterministic fixture bridge and server tests. Missing metrics remain `null` and render as “Not measured.” Never substitute zero for unknown cost, confidence, violations or latency.

Export `startDashboard({ bridge, port?, actor? })` from `src/dashboard/server.ts`, resolving to `{ url, close }`. Bind only to `127.0.0.1`; use port 4317 by default and permit port 0 for tests. `close()` must stop polling/streams and close the server. The trusted host provides the actor identity, defaulting to `local-operator`; browser requests cannot override it. This is a local operator interface, not a multi-user authentication system.

Expose the following local API:

| Route | Behavior |
|---|---|
| `GET /api/runs` | Return run summaries. |
| `GET /api/runs/:id` | Return current `RunView`. |
| `POST /api/runs/:id/approval` | Accept exactly `{ digest, allow }`; call the bridge with the server's actor. |
| `POST /api/runs/:id/resume` | Queue one resume for that run, return HTTP 202, expose progress through inspection, and reject overlapping resumes. |
| `GET /api/compare?baseline=:id&candidate=:id` | Return the bridge's comparison for the selected runs. |

Use polling at one-second intervals while a run is active. Stop redundant polling on navigation or page teardown. Resume must not keep the HTTP response open throughout a long mission. Approval does not automatically execute the action: provide a distinct Resume control so the operator can inspect the granted state.

Protect local mutations with a random per-server token carried in a request header and an exact same-origin check. Validate the Host header to prevent DNS rebinding, reject cross-origin requests, avoid wildcard CORS, cap JSON request bodies, and use strict schemas and existing run-ID validation. This prevents an unrelated website from controlling the local agent through the user's browser. Keep session tokens out of URLs and logs.

## Required interface

Create a clear, responsive interface using the repository's dark background and cyan/purple accents. Use system fonts and local assets; no external fonts or scripts are needed.

- A run list and selected mission with visible status and world.
- Current plan/action, rationale and cited observations. Tool input is inspectable before approval.
- Current observed state with source evidence and clear `SIMULATION_ONLY` or `VERIFIED` labels.
- Retrieved memory, with its source and outcome separated from current observations.
- Live trace ordered by sequence, expandable tool-call cards, and verification outcomes.
- Autonomy and policy decision, write budget, and an approval panel showing the exact pending action and expiry.
- Independent evaluator verdict and individual checks; a planner saying “done” must not render as verified success.
- Baseline/candidate selectors and comparison of scores, calls, violations, unverified writes, latency and cost.
- Confidence, cost and latency displays that explicitly acknowledge unavailable measurements.

Cover idle/empty, loading, active, waiting for approval, expired approval, denied, unavailable tool, uncertain side effect, confirmed failure and confirmed success. On stale approval, reload the run and show that the action must be reviewed again. On uncertain side effect, explain that verification is pending; do not present a “send again” shortcut.

Use semantic controls, keyboard operation, visible focus, accessible status announcements and readable contrast. Render untrusted tool results and source text through text nodes, never raw HTML. Do not publish private traces to an external host.

## Implementation sequence and tests

1. Build synthetic `RunView` fixtures for every state, including injection text, long values, missing metrics and failed evaluations.
2. Implement the injected bridge contract, local API, mutation protection and asynchronous resume tracking.
3. Build the responsive UI and connect it to the API. All buttons must perform real bridge calls; fixture mode must be conspicuously labelled.
4. Test run listing/inspection, missing IDs, invalid bodies, approval allow/deny, stale digests, expired requests, duplicate resumes and surfaced background errors.
5. Test invalid Host/Origin, missing or invalid mutation token, oversized bodies, path traversal and HTML injection. Prove browser input cannot select a different actor or bypass the bridge's approval method.
6. Use the available browser skills to verify the running dashboard: page load, console errors, complete keyboard approval/deny/resume flow, replay comparison, mobile layout, and all important failure states. Capture screenshots and actual results.

Run from `agentic-action-engine/`:

```bash
npm ci
node --import tsx --test tests/dashboard.*.test.ts
npm run typecheck
```

Provide a directly runnable fixture entry point under `src/dashboard/` and document its `node --import tsx ...` command in `docs/DASHBOARD.md`, without editing shared package scripts.

## Handoff and definition of done

Deliver only owned-path changes after the isolated baseline commit. Report that baseline SHA, delivery commit SHAs, startup command, automated test results, browser results/screenshots and any missing bridge data. The main agent applies delivery changes, implements the production bridge, and repeats verification against actual runtime runs.

This pathway's code gate passes when the dashboard and all controls work through the injected bridge, security and behavior tests pass, and browser verification succeeds. Fixture screenshots do not prove live tool execution; final runtime integration remains a separately recorded main-agent gate.
