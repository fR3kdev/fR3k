# Geode-native V2 checkpoint — 2026-11-22 11:18 AEST

This is a partial-work snapshot. **Do not import or set as default yet.**

## Direct observations

- The authorized Omarchy host's `fr3k-geode-native-20261122.service` was `active/running` and its native builder process existed.
- The pinned conversion journal recorded **20 of 40 layers** completed (indexes 0–19).
- The separate native output directory still contained `INCOMPLETE`.
- The read-only `check-partial-expert-patches.py` audit inspected three routed experts in each of those 20 completed layers: **60 of 60 samples passed**. Gate/up bytes matched the official Geode Q4 source, and each sampled down-projection byte range differed as expected.
- **13 of 13 software tests passed** on Omarchy.
- `deploy-redmagic.sh preflight` refused the unfinished pack and returned exit code **2**.
- The dedicated model partition had approximately **62 GiB available**.
- The REDMAGIC **was not reachable** by ADB at the checkpoint. Wireless ADB mDNS advertisements were absent, and the previous paired address returned a network error. This is a phone connectivity blocker independent of the conversion process.

## Verified / Unknown / Blocked

**VERIFIED:** conversion is progressing; completed layers are recorded; sampled native expert patches satisfy preservation/change checks; incomplete pack is rejected.

**UNKNOWN:** overall model quality, full native pack integrity, Geode inference, acceleration, vision and MTP behavior.

**BLOCKED:** phone import and default change require (1) complete 40/40 verified pack and (2) restored, identity-verified REDMAGIC connection.

## Next safe actions

1. Continue the existing resumable conversion service without restarting it.
2. Once the `INCOMPLETE` marker is gone and 40/40 layers are recorded, run `geode_native.py verify-output`, complete SHA-256 preflight, and stage to a freshly identified NX809J only if connected.
3. Import through Geode's model folder picker into its app-private storage.
4. Validate actual inference and model selection before setting V2 as default. Keep working Gemma intact for rollback.

Evidence is a snapshot, **not** a success or deployment claim.
