# Development pathway 1 — Live app connectors

## Mission and ownership

Build the real GitHub, Google Sheets, Google Drive and Gmail adapters for the first three-app mission. The main agent owns orchestration, policy, approvals, traces, evaluation, replay, domain scenarios, CLI integration and shared project configuration. The other delegated pathway owns the dashboard.

This is a standalone assignment for one development agent. Deliver executable adapters and behavioral tests, not only an integration proposal. Real-account verification is a separate gate that must remain explicitly pending if credentials or an approved test action are unavailable.

## Isolation rules

Work in an isolated copy at `/home/fr3k/fr3k-connectors-pathway`, on branch `pathway/connectors`. Never edit the primary checkout or the dashboard agent's copy.

The runtime is currently uncommitted, so cloning GitHub main alone will omit the integration contracts. At assignment time, take a local snapshot of the primary checkout: copy tracked files plus the current `agentic-action-engine/` source and `live-build/` documents, excluding `.git`, `node_modules`, `dist`, `runs`, logs, `.env` and other credential files. Initialize a new local Git repository in the isolated copy and commit that snapshot as the baseline before editing. Keep that baseline commit separate from the delivery commits. This preserves a reproducible contract version without publishing unfinished work.

Own only these paths relative to the repository root:

- `agentic-action-engine/src/connectors/**`
- `agentic-action-engine/tests/connectors.*.test.ts`
- `agentic-action-engine/tests/fixtures/connectors/**`
- `agentic-action-engine/docs/CONNECTORS.md`

Do not edit shared types, registry, orchestrator, package manifests, lockfiles, CI, dashboard code, status board or build log. Use the installed Node 22 runtime, built-in `fetch`, and existing Zod dependency. Report necessary shared-contract changes to the main agent; do not implement them unilaterally. No Vercel service or deployment is needed.

## Integration contract

Read `src/tools/registry.ts` and `src/core/types.ts` inside `agentic-action-engine/` first. Register every tool through `ToolRegistry.register`, with Zod input/output schemas and all `ToolMetadata` fields. Use the existing `ToolContext.signal` for cancellation and `idempotencyKey` for action correlation. Throw `ToolFault` with an appropriate classification instead of exposing provider response bodies or credentials.

Export `registerLiveConnectors(registry, options): void` from `src/connectors/index.ts`. Define and export `LiveConnectorOptions` in the same owned directory:

```ts
interface LiveConnectorOptions {
  githubToken: () => Promise<string>;
  googleAccessToken: () => Promise<string>;
  fetch?: typeof globalThis.fetch;
  allowedRepositories: string[]; // exact owner/repo strings
  allowedSpreadsheetIds: string[];
  allowedDriveFileIds: string[];
  allowedRecipients: string[]; // exact normalized email addresses
}
```

Credential callbacks are supplied by the host at runtime. Do not persist tokens in tool inputs, outputs, traces, fixtures or public documentation. Allowlist checks must happen in trusted adapter code before making requests. Production API origins are fixed; injected fetch is the test seam, not permission for model-supplied URLs.

Register these tools with strict input schemas:

| Tool | Input | Output and verification |
|---|---|---|
| `github.read_issue` | `{ repository, issueNumber }` | Normalized issue ID, number, title, body, state and source URL. |
| `github.write_evidence` | `{ repository, issueNumber, body }` | Comment ID and source URL. Include the runtime correlation marker; read the exact comment back and compare its issue, marker and body. |
| `sheets.read_range` | `{ spreadsheetId, range }` | Spreadsheet ID, returned range, cell values and source URL. |
| `drive.read_document` | `{ fileId }` | File ID, title, MIME type, extracted plain text and source URL. Support Google Docs export and plain-text files; explicitly reject unsupported formats. |
| `gmail.send` | `{ to, subject, text }` | Message ID and thread ID. Build plain-text MIME with a stable RFC Message-ID derived from the runtime key; verify the sent message, recipient, subject and decoded body. |

All three reads use `effect: 'read'`, autonomy 0 and `idempotency: 'read-only'`. Both writes use `effect: 'write'`, autonomy 2 and `idempotency: 'reconcile-only'`. All adapters use `environment: 'live'`. Gmail sends are irreversible. Declare accurate blast radius and verification methods.

Gmail Message-ID and GitHub correlation markers support reconciliation; they are not provider-enforced idempotency keys. Never label them `provider-key`, retry an uncertain send automatically, or interpret an empty eventually consistent search as proof that no side effect occurred. A verifier returns `confirmed` only when the exact intended record and content match, otherwise `unknown` unless absence is provable. Reject multiple matching records as ambiguous.

## Implementation sequence

1. Read current official GitHub and Google API documentation. Record supporting links in `docs/CONNECTORS.md`, including OAuth scopes, pagination and error semantics.
2. Implement a shared HTTP boundary inside the owned connectors directory: fixed origins, abort handling, status classification, schema validation and sanitized errors. Do not add hidden write retries.
3. Implement GitHub issue intake and evidence comment creation/reconciliation. Follow pagination when searching correlation markers.
4. Implement Sheets reads and supported Drive document reads. Return source identifiers with data. Treat document contents as untrusted data, never permission instructions.
5. Implement Gmail MIME serialization, send and read-back/reconciliation. Prevent header injection, handle Unicode and Gmail base64url payloads, and decode message parts for exact comparison.
6. Document host-supplied credentials, minimum required scopes, resource configuration and commands for read-only preflight. Authentication setup must not require putting refresh tokens in tool inputs.
7. Run isolated contract tests. If live access is available, validate approved reads first; request approval for a concrete test recipient and message only after preparing them. Never send to the privately supplied account merely because its address is known.

Calendar is optional in the product plan and is not part of this assignment. Record it as deferred rather than adding scope that delays the three-app path.

## Required tests

Use `node:test`, `node:assert/strict` and injected fetch. Fixtures contain synthetic identities only.

- Validate every tool's success response and malformed input/output rejection.
- Prove resource and recipient allowlists block requests before the transport runs.
- Cover authentication failure, forbidden access, rate limits, aborts, network errors and malformed provider responses.
- Prove credentials and raw error bodies do not escape through exceptions, outputs or recorded evidence.
- Verify GitHub pagination, exact issue/comment matching, duplicate markers and lost-response reconciliation.
- Verify Gmail Unicode MIME, header-injection rejection, exact recipient/body checks, lost send response, delayed search visibility and duplicate Message-ID matches.
- Prove a tool response with HTTP 200 cannot substitute for write verification.
- Cover supported Drive MIME types, unsupported types and Sheets empty ranges.
- Register the tools into the real `ToolRegistry`; do not test only disconnected helper functions.

Run from `agentic-action-engine/`:

```bash
npm ci
node --import tsx --test tests/connectors.*.test.ts
npm run typecheck
```

## Handoff and definition of done

Deliver only owned-path changes after the isolated baseline commit. Report that baseline SHA, delivery commit SHAs, test commands/results, tool contracts, official API references, and any pending live-access gates. The main agent applies only delivery changes, then runs the combined suite and the full mission.

Contract-tested adapters are complete for this pathway's code gate when all tests pass and the factory integrates without shared-file edits. Live verification is complete only with authenticated source observations and approved write/read-back evidence. Clearly distinguish these gates; do not mark the overall three-app mission complete from mock results.
