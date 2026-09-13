# Live app connectors

Status: **contract-tested, with a recorded live three-app mission**. `npm run demo:live` uses YouTube, GitHub and ntfy; the [2026-09-14 evidence record](../../live-build/evidence/LIVE_MISSION_2026-09-14.md) documents both approved writes and exact read-back. The separate `npm run demo-live` launcher only reads GitHub. No Google, Gmail or Calendar adapters are included.

See the [runtime command and configuration guide](../README.md) for credentials, targets and approval behavior. The Arga demo and dashboard remain `SIMULATION_ONLY`.

## GitHub issue and evidence adapters

`registerLiveConnectors(registry, options)` in `src/connectors/index.ts` registers:

| Tool | Input | Output | Policy |
| --- | --- | --- | --- |
| `github.read_issue` | `repository`, positive `issueNumber` | `issueId`, `number`, `title`, `body`, `state`, `sourceUrl` | live read, autonomy 0 |
| `github.write_evidence` | same resource fields plus `body` | `commentId`, `sourceUrl` | live write, autonomy 2, reconcile-only |

The host supplies `githubToken: () => Promise<string>`, an exact `allowedRepositories: string[]`, and optionally injected `fetch` for tests. Tokens stay in authorization headers and must never enter mission inputs or traces. Origins are fixed to `https://api.github.com`; redirects are rejected. Repository allowlists are copied at registration and checked before credentials or transport. Issue content is untrusted data, never authorization.

Use a fine-grained token restricted to the intended repository, with Issues read permission for intake and Issues write permission for comments (GitHub also accepts the corresponding Pull requests permissions for comment endpoints). Classic tokens commonly require `repo` for private repositories; prefer narrow fine-grained permissions. Host authentication and the runtime's exact write approval are separate requirements. Public comments can trigger notifications, so the adapter does not promise reversibility.

A write appends a SHA-256 correlation marker derived from the runtime idempotency key. This is not provider-enforced idempotency. `execute` performs exactly one POST and returns identifiers; the runtime must call `verify` before treating that result as evidence. Verification scans all comment pages, requires exactly one marker with exact body and issue identity, then GETs the exact comment ID and compares again. Even with a returned comment ID, the verifier scans for duplicate markers. Provider pagination URLs must retain the expected origin and issue path. Cycles or more than 1,000 pages yield unknown.

Empty lists, changed content, duplicate markers, verification errors and uncertain side effects return `unknown`, never proven absence. A lost POST response, malformed successful write response, or server error produces `UNCERTAIN`; no automatic write retry occurs. Reads classify transport failures as `UNAVAILABLE`, server/rate errors as `TRANSIENT`, and rejected requests as `REJECTED`. Provider error bodies and credential callback errors are discarded. Authentication must be configured through the host, not pasted into tool arguments.

## YouTube and ntfy adapters

`registerIncidentConnectors(registry, options)` in `src/connectors/incident.ts` takes exact `allowedYoutubeVideoIds` and `allowedNtfyTopics` allowlists, optional injected `fetch`, and an optional `ntfyOrigin` (default `https://ntfy.sh`).

| Tool | Input | Output | Policy |
| --- | --- | --- | --- |
| `youtube.read_live_state` | `videoId` | exact video ID, title, live flags, source URL | live read, autonomy 0 |
| `ntfy.publish_status` | `topic`, `title`, `message` | event ID, source URL, sent timestamp | live write, autonomy 2, reconcile-only |

YouTube state comes from public watch-page player metadata with exact video identity checks. The live mission evaluator requires `isLiveNow=true`; the dated successful run does not guarantee that the same video is live on a later launch.

The ntfy write appends a correlation marker. Its verifier polls the exact topic up to four times, with 250/500/750 ms waits between attempts, and requires a unique exact topic/title/message match plus the returned event ID when available. Duplicate exact matches, a matching event with the wrong returned ID, and transport/parse errors yield `unknown`; no exact match after all polls yields `absent`. Reconcile-only semantics prevent an automatic resend. The recorded mission recovered from delayed visibility by reconciling the original receipt without executing another write.

## Validation and live operation

From `agentic-action-engine/`:

```sh
npm ci
node --import tsx --test tests/connectors.*.test.ts
npm run typecheck
```

Tests use synthetic inline fixtures and the real ToolRegistry. They exercise allowlisting, schema and resource checks, sanitized errors, cancellation, pagination, exact readback, duplicate markers, lost responses and uncertain verification. The shipped `createLiveIncidentMission` host wires these adapters into the approved three-app flow. That path has recorded POST/read-back evidence; a new run still needs its own configured credentials, exact resource allowlists and write approvals.

An operator can perform a read-only credential/resource preflight (replace the explicit example repository and issue with the approved target):

```sh
gh auth status
gh api repos/OWNER/REPOSITORY/issues/ISSUE_NUMBER --jq '{id,number,title,state,html_url}'
```

This CLI preflight does not verify the runtime adapter itself. Comment posting remains a separate approved runtime action.

## Official references

- [Get an issue](https://docs.github.com/en/rest/issues/issues#get-an-issue): resource identity and read permissions.
- [Create an issue comment](https://docs.github.com/en/rest/issues/comments#create-an-issue-comment): required permissions and write response.
- [Get an issue comment](https://docs.github.com/en/rest/issues/comments#get-an-issue-comment): exact comment readback.
- [List issue comments](https://docs.github.com/en/rest/issues/comments#list-issue-comments): list response and pagination.
- [Pagination](https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api): Link headers.
- [REST troubleshooting](https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api): authentication and rate-limit responses.

The requests pin GitHub API version `2026-03-10`, as shown in the current official endpoint documentation reviewed on 2026-09-14.
