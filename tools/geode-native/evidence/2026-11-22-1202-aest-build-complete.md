# FR3K Geode-native Abliterated V2 — completed conversion, hardware pending

**Observation:** 2026-11-22 12:00–12:02 AEST.

## Verified host evidence

- Omarchy's isolated native Geode Q4 conversion ran all **40 of 40** layers, indexes 0–39.
- The builder exited successfully (the systemd user service was `inactive/dead` with `ExecMainStatus=0`), printed `PACK READY FOR HARDWARE TEST, NOT VERIFIED INFERENCE`, and its final `geode_native.py verify-output` succeeded (`sha256=True`).
- The output contains the 15 expected native `.bin` files, a `geode.json` manifest, and a completed source-revision journal. The `INCOMPLETE` marker was absent.
- The source-pinned provenance preflight passed for **Qwen3.6-35B-A3B Abliterated V2** with all 40 journal entries. Pack files total **20,757,785,681 bytes**.
- All **13 software regression tests** passed on the actual Omarchy machine.
- The authorized REDMAGIC was positively identified as `NX809J`. The phone had approximately **245 GB free** by `df` at preflight, exceeding the ~50.1 GB staging/import reserve requirement.
- A separate `fr3k-geode-v2-stage-20261122.service` was **started** to hash-verify and push the pack to phone shared storage. Service start alone is NOT evidence of finished transfer, import, model selection, or inference.

## Critical acceptance boundaries

- **VERIFIED:** source revision pins, 40-layer build completion, completed manifest and SHA-256 checks on Omarchy, software tests, phone identity and storage at preflight.
- **IN PROGRESS:** hash-verified transfer into the phone's Download/FR3K-Geode-Abliterated-Q4-V2 folder.
- **UNKNOWN:** model loadability inside Android Geode, actual generated tokens, speed, memory, GPU/NPU path, vision quality, MTP accuracy and abliterated response quality.
- **MUST NOT CHANGE DEFAULT:** until Geode's Android folder import completes with its own checksums and actual hardware inference passes. Keep the existing Gemma model intact for rollback.

## Next action

Follow the running phone staging service's status and log; do not launch a duplicate transfer. If staging succeeds, import the folder with Geode's `Models → Import folder` UI (Android SAF), choose **copy** rather than move to preserve staging, wait for app-private import, then select and test. Only if actual inference works should the user-requested abliterated model become the default.

This is an evidence snapshot, **not a claim of successful installation**.
