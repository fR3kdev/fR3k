# Geode Abliterated V2 — transfer concurrency reconciliation

**Observed:** 2026-11-22 12:02–12:11 AEST. This is partial deployment evidence, not hardware acceptance.

## Observations

- Full Geode-native model conversion completed at 40/40 layers, all native file hashes verified on Omarchy; final `INCOMPLETE` marker absent.
- A final read-only sampled expert audit on Omarchy passed **120/120**, confirming unchanged gate/up bytes and changed down-projection bytes for the sampled experts.
- An authorized REDMAGIC NX809J was reachable by paired wireless ADB, and source-model preflight passed its storage and provenance checks.
- Two independently started staging services were found uploading the same `dense.bin.uploading` destination. Competing writes invalidated any assumption that the partial file could be trusted.
- Both competing workers were stopped. The deployment script was modified to acquire an exclusive `flock` lease stored outside the model folder; its regression suite now has **14 passing tests**, including rejecting a second writer.
- One new exclusive transfer service was observed `active/running` and emitted `STAGING_LEASE_ACQUIRED` and `SOURCE_HASHES_VERIFIED`.
- A separate 5.3 MB tokenizer file was sent directly by TCP for a bounded transport experiment. The receiver initially had not finished flushing when first inspected; its eventual full size and SHA-256 matched the source. The verified file was moved to the canonical `tokenizer.bin` name. Direct Wi-Fi HTTP from phone to workstation timed out, so no claim of faster transport is made.
- The main 20.76 GB pack transfer remains **in progress**; its expert files have not been shown to be on the device.

## Release status

- **VERIFIED:** converted Geode pack complete and hashed on Omarchy, 14 software tests pass, one designated staging worker started, tokenizer hash matched on phone.
- **UNKNOWN:** full phone transfer completion, Geode app-private import, real inference and model quality, vision and MTP behavior.
- **BLOCKED:** changing Geode default until import, on-device prompt execution and acceptance criteria pass. Preserve the existing working model.

## Operating rule

Never run a second stage operation against the same `output/Q4` pack. Always use the exclusive flock-enabled script, verify the service state and completed per-file SHA-256 hashes, and wait for the `STAGED_HASH_VERIFIED` terminal line before Geode import. A systemd unit in `active` state is not proof of a successful transfer.
