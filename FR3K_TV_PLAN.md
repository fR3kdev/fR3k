# FR3K TV — remote customization service execution plan

Date: 2026-10-29 (Australia/Brisbane)
Status: PROPOSED / NOT IMPLEMENTED / NOT HARDWARE VERIFIED
Scope: one customer-installed Android TV app containing connection and customization modules, plus a centrally operated management service. No Tailscale dependency.

## Product and boundaries

Customer journey: install signed APK → enter short-lived pairing code → review and grant permissions → choose a customization package → receive approved changes → inspect results → revoke access when desired.

Sell initial setup, launcher design, app configuration and remote support. Offer hosted fleet management as an optional subscription. Keep a useful local/self-hosted core free. Firmware work is a separate, explicitly approved service only for tested models with supported privileged access and a rehearsed recovery procedure.

Compatibility target: Android TV / Google TV and suitable Android-based TV boxes, with armeabi-v7a and arm64-v8a builds packaged in one universal APK. Minimum Android version is provisional until dependency and hardware testing. This is not support for Samsung Tizen, LG webOS, every Android TV, every processor architecture, or arbitrary firmware flashing.

BasicSync is not the control agent: file synchronization does not provide screen control or firmware privileges.

## Evidence and unresolved questions

- VERIFIED FACT (documentation): Android screen capture uses permission-mediated MediaProjection. For apps targeting Android 14+, consent is required for each capture session.
- VERIFIED FACT (documentation): Android Verified Boot and bootloader state constrain which firmware can boot.
- UNKNOWN: first test TV model, Android version, ABI, RAM, available permissions, background/standby behavior, launcher selection behavior and recovery method.
- UNKNOWN: current server resources, deployment route, existing fleet protocol compatibility and operational capacity. Inspect before choosing an integration path.
- HYPOTHESIS: outbound control connections and relayed media will work across typical customer networks. Test NAT, restrictive firewalls, outages and standby.
- No APK, server deployment, TV pairing or paid-service readiness is established by this document.

Sources:
- https://developer.android.com/media/grow/media-projection
- https://source.android.com/docs/security/features/verifiedboot/device-state
- https://developer.android.com/training/tv/get-started/create
- https://github.com/chenxiaolong/BasicSync/blob/master/README.md

## Proposed architecture

One Kotlin Android app, operable entirely by TV remote:
- Pairing, connection status, capability/permission checks and access revocation.
- Outbound authenticated TLS WebSocket over TCP 443 for commands/results; HTTPS for signed artifacts.
- Android Keystore-backed device identity where available; no shared fleet credential embedded in APKs.
- Reconnect with exponential backoff/jitter, bounded disk queue, storage limits and explicit expiry of pending actions.
- Modular customization executor and optional FR3K launcher in the same APK.
- Optional attended screen sharing using MediaProjection and WebRTC, with short-lived TURN relay credentials.
- Remote input is a separate capability requiring an explicitly enabled, supported accessibility or privileged mechanism; screen sharing alone grants no input control.
- Avoid unrestricted remote shell in the standard customer product.

One authoritative server/orchestrator:
- Enrollment, device registry, customer/tenant boundaries, operator access control and audit trail.
- Durable jobs, artifact manifests, capability matching, results and recovery state.
- PostgreSQL proposed for durable state; object storage for signed artifacts; signaling and TURN for media.
- Start with one deployable service and isolated media relay; split services only when measurements justify it.
- Read existing FR3K fleet interfaces before reuse. Reuse tested protocol/authentication primitives where appropriate; customer TV agents must not inherit private infrastructure authority.
- Dashboard showing last contact, last observed state and last verified job separately. A heartbeat is not task completion.

Deployment target: operator-controlled server; exact host, DNS, credentials and customer data remain private. No deployment or modifications to the existing voice service are authorized by this planning document alone.

## Customization packages

Versioned, signed manifest containing package ID/version, supported device constraints, required capability/authority, artifact hashes, planned changes, preconditions, postconditions and restoration instructions.

MVP actions:
- Apply FR3K launcher theme, wallpaper, shortcuts and branding.
- Deliver files into app-owned or explicitly granted storage.
- Open supported Android settings/setup flows and request app installation with platform confirmation where required.
- Collect bounded diagnostics with customer consent.

Do not claim silent app installation, silent launcher replacement, unrestricted settings changes, unattended screen viewing, persistence after force-stop, or wake from deep standby until demonstrated on the target model. Preserve native TV/input access and an obvious way to exit the launcher.

## Authority, job and recovery rules

OBSERVE: bounded diagnostics and capability discovery.
AUTO: customer-authorized reversible customization within an explicit allowlist.
APPROVAL: app installation/uninstallation, permission changes, elevated operations and disruptive changes.
PHYSICAL: local bootloader/recovery steps or physical confirmation where required.

Each job has tenant_id, device_id, stable job_id, idempotency_key, dependencies, package hash, authority, deadline, expected device state and protocol version.
- Server owns state transitions; leased execution uses fencing tokens to reject stale workers.
- Device records intent before applying side effects, then reconciles actual state before retry.
- Terminal states are immutable: SUCCEEDED, FAILED, CANCELLED. NEEDS_USER, BLOCKED and RECONCILING are explicit nonterminal states.
- A timed-out action with uncertain effects enters reconciliation; never blindly retry installations, reboots or firmware writes.
- Check authorization and revocation at dispatch and immediately before execution. Expired offline jobs cannot execute later.
- Preserve before/after configuration and raw receipts before derived summaries.
- Restoration is itself an audited job; compensation can fail and must report that failure.
- Firmware remains disabled in the MVP. Later support requires exact hardware matching, trusted image provenance, power checks and proven local recovery. No generic partition-writing executor.

Security: tenant isolation enforced server-side, least privilege, operator MFA, pairing rate limits, expiring one-time codes, replay protection, credential rotation/revocation, signed update verification, scoped short-lived download links, and bounded logs. Test confused-deputy and cross-customer access attempts. Never publish secrets, private addresses, customer recordings, identifiers or raw customer diagnostics.

## Ordered build backlog

All tasks below are TODO. Hardware tests must retain actual observations and build identifiers; simulation results are labeled SIMULATION.

| ID | Dependency | Deliverable | Acceptance |
|---|---|---|---|
| TV-001 | None | Inventory first TV and inspect existing FR3K server/protocol | Record model/API/ABI and actual integration constraints; redact public evidence |
| TV-002 | TV-001 | Protocol, authority and threat model | Versioned schemas; explicit permission matrix; replay/idempotency/tenant tests defined |
| TV-003 | TV-002 | Android app shell and universal build | Signed test APK installs/opens on real 32-bit and 64-bit targets; D-pad navigation works |
| TV-004 | TV-002 | Enrollment and durable control server | Expiring pairing; unique identities; revoked/cross-tenant connections denied |
| TV-005 | TV-003, TV-004 | Agent connection and capability negotiation | Real TV pairs, reconnects after network loss; unavailable capabilities rejected |
| TV-006 | TV-005 | Durable jobs and evidence | Duplicate delivery, stale lease, restart and uncertain-result tests preserve correct effects/state |
| TV-007 | TV-006 | Launcher and signed customization package | Visible theme change; independent state readback; successful restoration |
| TV-008 | TV-006 | Attended screen support | Capture consent honored; session stop/revoke works; input capability accurately reported |
| TV-009 | TV-007 | Multi-customer dashboard | Enroll multiple TVs; assign scoped packages; inspect outcomes; revoke access |
| TV-010 | TV-007, TV-009 | Signed updates and recovery | Interrupted download safe; invalid signature rejected; last usable configuration retained |
| TV-011 | TV-008, TV-010 | Hardware pilot and compatibility matrix | Reboot/standby/outage/storage-pressure results recorded per model and build |
| TV-012 | TV-011 | Commercial pilot | Defined support scope, customer consent, restore procedure, costs and paid trial feedback |
| TV-013 | TV-012 | Optional model-specific privileged adapters | Separate approval and tested recovery; never advertised as universal firmware support |

Suggested monorepo implementation layout after inspecting existing conventions:
- apps/tv-agent/ — connection, executor, launcher and TV onboarding
- services/tv-control/ — enrollment, orchestration and dashboard API
- packages/tv-protocol/ — schemas, fixtures and compatibility contracts
- deployments/tv/ — secret-free example configuration and self-hosted setup
- docs/tv/ — hardware matrix, operations, release and recovery evidence

## Verification and release gates

First vertical slice: a real TV pairs → receives a signed launcher customization → visibly applies it → reports independently observed state → reconnects after reboot → restores previous configuration. An emulator pass does not satisfy this gate.

Before paid general availability:
- At least three tested device models, spanning 32-bit and 64-bit Android, with documented permission/setup requirements.
- Test power/network interruption, standby/wake, process death, reboot, duplicate commands, expired jobs, revoked identity, hostile tenant requests and full storage.
- Check screen capture privacy, DRM/secure-screen limitations and customer session termination.
- Measure idle CPU/RAM, network traffic, reconnect time, customization duration and relay bandwidth. Establish acceptable thresholds from pilot measurements.
- CI validates schemas, build/lint, authorization/job tests and reproducible artifacts. Human hardware receipts link exact APK/server commit and device/OS versions.
- Run backup restoration and incident/revocation drills. A commit or green CI is not deployment or hardware verification.

## Commercial rollout

1. Internal proof on owned TVs.
2. Small invitation-only pilot with narrow supported-model list and assisted installation.
3. Charge a one-time setup/customization fee; offer optional hosted management/support subscription.
4. Measure installation labor, support minutes, storage, relay traffic and margin before setting prices. Do not promise unlimited support.
5. Add multi-location business customers after tenant isolation and operational recovery are demonstrated.

Customer-owned accounts and properly licensed apps/content only. No DRM bypass or bundled unauthorized subscriptions. Disclose exactly what remote access permits; make revocation straightforward.

Open core: local launcher, package format and useful self-hosted operation. Paid value: managed hosting, coordination, backups, fleet operations and support.

## Immediate next work

Execute TV-001, then agree protocol and build the first vertical slice. Do not activate unattended customer operations or firmware flashing as a side effect of implementation. Update this checklist and attach evidence when each acceptance condition is actually met.
