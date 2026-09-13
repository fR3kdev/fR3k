# fR3k Hackathon Submission

> **An agent that acts, then proves it.**

This is the judge-facing submission bundle for the Multi-App AI Agent Hackathon. The working project is the repository root; this folder contains the two-minute demo and the short system/reliability brief requested by the event.

## Deliverables

- **Working project:** [`../agentic-action-engine/`](../agentic-action-engine/)
- **Two-minute demo:** [`demo-2min.mp4`](demo-2min.mp4) — 117.8 s, 1080p H.264/AAC
- **System + reliability brief:** [`SYSTEM_RELIABILITY_BRIEF.md`](SYSTEM_RELIABILITY_BRIEF.md)
- **Voiceover:** [`voiceover.mp3`](voiceover.mp3)
- **Captions:** [`captions.vtt`](captions.vtt)
- **Demo script:** [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md)

## The live mission

`YouTube → GitHub → ntfy → GitHub evidence`

The agent reads the exact YouTube live-stream state, grounds the task against GitHub issue #1, pauses for exact approval, writes one bounded operator notification through ntfy, verifies the external receipt, then writes the verified evidence back to GitHub and reads that comment back exactly.

The verified live run reached **`CONFIRMED_SUCCESS`**, evaluator **1.00**, **7/7 checks passed**. The rendered video shows **77/77**, which was the green count at render time; current `main` adds three follow-up hardening tests and passes **80/80**. The repository integration suite passed **80 tests** with **0 failures**, and GitHub Actions was green on the submission commit.

## Public receipts

- Canonical task: https://github.com/fR3kdev/fR3k/issues/1
- Evidence comment: https://github.com/fR3kdev/fR3k/issues/1#issuecomment-5655933189
- Runtime evidence record: [`../live-build/evidence/LIVE_MISSION_2026-09-14.md`](../live-build/evidence/LIVE_MISSION_2026-09-14.md)
- Source commit containing the verified mission: `a7c7649`

## Why this is useful

The product is not another tool-calling chat demo. It is a small execution control plane for agents that need to change external state without hand-waving about whether the action actually happened. Every consequential action is policy checked, approval bound, externally verified, and left in an append-only evidence trail.

## Media integrity

SHA-256 hashes for the demo, voiceover, captions and thumbnail are in [`SHA256SUMS.txt`](SHA256SUMS.txt).
