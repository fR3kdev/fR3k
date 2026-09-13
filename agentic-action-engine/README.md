# fR3k Agentic Action Engine

A TypeScript runtime for observing app state, approving exact actions, verifying writes, and recording evidence. The [recorded live mission](../live-build/evidence/LIVE_MISSION_2026-09-14.md) connects YouTube → GitHub → ntfy → GitHub evidence. The Arga sandbox supplies reliability and replay fixtures.

## Install and check

Use Node.js 22, matching the repository CI. From the repository root:

```bash
cd agentic-action-engine
npm ci
npm run typecheck
npm test
npm run demo
```

`demo` automatically approves synthetic Arga actions. Its observations, replay and adversarial scenarios are `SIMULATION_ONLY`.

## Choose a command

| Command | What it runs | External effects |
| --- | --- | --- |
| `npm run demo` | Arga sandbox, replay, counterfactual and adversarial variants | None |
| `npm run dashboard` | Local browser UI controlling two fresh Arga sandbox runs | None |
| `npm run demo-live` | Authenticated GitHub repository, commit and issue reads | Reads only; no write tools registered |
| `npm run demo:live` | YouTube → GitHub → ntfy → GitHub evidence | One notification and one evidence comment, each through runtime approval |

The hyphen and colon commands are separate launchers with different configuration. See [dashboard operation](docs/DASHBOARD.md) and [connector contracts](docs/CONNECTORS.md).

## Live three-app mission: `demo:live`

Supply a GitHub token through `FR3K_GITHUB_TOKEN`, then `GH_TOKEN`, or an authenticated `gh auth token` fallback. The token needs issue read/write access to the target repository. GitHub CLI is needed only for the fallback. Export variables in the launch environment; these npm commands do not automatically load `.env` files.

| Variable | Default / purpose |
| --- | --- |
| `FR3K_REPOSITORY` | `fR3kdev/fR3k`; exact repository allowlist |
| `FR3K_ISSUE_NUMBER` | `1`; existing issue to read and append evidence to |
| `FR3K_YOUTUBE_VIDEO_ID` | `xKOL36Yjs0U`; exact video allowlist |
| `FR3K_NTFY_TOPIC` | Random `fr3k-live-…` topic on `https://ntfy.sh` for each launch |
| `FR3K_RUN_ID` | `live-incident-` plus the current timestamp; use a fresh ID for each launch |
| `FR3K_TRACE_ROOT` | `.work/live-traces` relative to the working directory |
| `FR3K_OPERATOR` | `stream-operator`; actor recorded for approvals |

The configured YouTube video must be currently live for the evaluator to pass. The historical video may no longer be live. The planner can still propose writes when the observed live flag is false, so review the displayed state before approving. The YouTube connector reads public watch-page metadata; it does not require a YouTube API key. The ntfy connector sends to an unauthenticated topic, so use non-sensitive status text.

After configuring the target repository, issue, video and credentials:

```bash
npm run demo:live
```

In a terminal, the launcher displays each exact action and asks `Approve exact action? [y/N]`. After approval it resumes automatically. Non-interactive launches deny the pending action by default. `FR3K_APPROVE=1` automatically grants every pending approval without prompting; leave it unset for interactive review. It is only appropriate when the exact actions have already been reviewed and authorized.

The CLI creates a fresh mission and leaves its JSONL trace on disk. It does not expose a resume-existing-run command. An uncertain write must be reconciled against the original run; launching a new run is not verifier-only recovery. See the [recorded ntfy visibility race](../live-build/evidence/LIVE_MISSION_2026-09-14.md).

## Read-only GitHub attach: `demo-live`

This launcher resolves `GH_TOKEN`, then `GITHUB_TOKEN`, then `gh auth token`. It does not use `FR3K_GITHUB_TOKEN`. Set `LIVE_GH_OWNER` and `LIVE_GH_REPO` to override `fR3kdev` and `fR3k`, then run:

```bash
npm run demo-live
```

## Evidence boundaries

The shipped Arga and live-incident demos use deterministic planners. `src/model/` provides a bounded model-planner interface and fetch provider, but setting an API key alone does not switch these launchers to an LLM. A host must explicitly wire the provider and planner; no live model-backed run is certified in the recorded evidence.

The dashboard is verified with Arga sandbox state. External-app proof comes from the CLI mission. Restarting the dashboard creates new app state; journal reconstruction and replay are exercised separately by the sandbox demo. Confidence, cost and latency remain unmeasured.
