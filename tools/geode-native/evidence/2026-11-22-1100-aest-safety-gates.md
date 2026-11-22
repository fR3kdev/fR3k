# REDMAGIC Geode V2 — 11:00 AEST hardware preparation checkpoint

Evidence status: **PARTIAL / NOT DEPLOYABLE**. Captured 2026-11-22 (Australia/Brisbane).

- Omarchy conversion systemd unit observed `active/running`, process executing the native Q4 builder.
- Source-pinned journal recorded 12 of 40 completed layers (indexes 0 through 11).
- Native output retained the `INCOMPLETE` guard; the actual REDMAGIC staging script returned `BLOCKED: conversion still marked INCOMPLETE` with exit code 2.
- REDMAGIC NX809J appeared as an authorized ADB target. **No model import or default switch performed.**
- Updated deployment script now requires the V2 derivative source ID, 40 completed layers, matching SHA-1-style 40-character **Git revision identifiers** across journal and manifest, a matching source identity and correct lifecycle status. This gate does not replace actual per-file SHA-256 verification and Geode inference tests.
- 13 automated tests passed on Omarchy: six codec/tile8/patch tests and seven deployment-guard regression tests (valid metadata, incomplete marker, partial journal, missing journal, wrong source, wrong revisions, wrong lifecycle status).
- The converter has not finished all 40 layers. **Hardware inference and native-pack accuracy are UNKNOWN.**

Gate sequence: complete conversion → finalize and SHA-256 verify → guard preflight on NX809J → separate phone-side staging → Geode app-private import → deterministic real inference, vision and MTP tests → **only then** select as default, preserving original model for rollback.
