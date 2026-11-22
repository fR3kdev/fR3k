# FR3K Geode Abliterated V2: hardware preparation checkpoint

**Observed 2026-11-22 10:56 AEST.** This is a dated evidence snapshot, not a deployment declaration.

## Observations on the authorized Omarchy workstation

- A user systemd unit for the experimental native conversion remained `active/running`.
- The upstream **Geode Q4 base pack** had previously been staged and file-hash-verified.
- The V2 conversion journal initially recorded **9 of 40 layers** completed. At subsequent validation, it recorded **10 of 40**.
- The output retained an `INCOMPLETE` marker, preventing any premature install attempt.
- A read-only check sampled three routed experts in each of the first ten completed layers (**30/30 samples passed**): gate/up bytes were identical to the base file and down-projection bytes had changed.
- Six synthetic Q4/tile8/patching tests passed on the actual workstation.
- The dedicated staging partition had approximately **62 GiB free** at the initial observation.
- A paired Android handset identified as **REDMAGIC NX809J** was reachable using ADB; no credentials or internal addresses are recorded here.
- The native output was **not** copied into the Android Geode app. The existing default was deliberately preserved.

## Evidence labels

- **VERIFIED:** 10 layers recorded in the source-pinned journal; converter running; 30 sampled expert patches matched their expected change/preservation pattern; 6 software unit tests pass.
- **UNKNOWN:** full-pack tensor quality, refusal properties, Geode runtime acceptance, NPU/GPU path, vision parity and MTP accept rate.
- **BLOCKED:** Geode app import and default selection until 40/40, no `INCOMPLETE`, all manifests/files/hash checks and on-device inference verification.

## Release gate

Do not substitute a running service, partial tensor patch or model byte count for a valid native pack. The release requires:
1. All 40 layers completed, source revisions unchanged, complete pack verified by SHA-256.
2. Isolated phone staging and import into Geode app-private storage.
3. Real Geode text generation and quality checks with the new model selected.
4. Vision and MTP sanity checks; record GPU/NPU utilization or mark it UNKNOWN.
5. Only after successful inference, set the abliterated model as default; keep the previous model for rollback.

Source implementation: this PR, `tools/geode-native/`, including `check-partial-expert-patches.py` and `deploy-redmagic.sh`.
