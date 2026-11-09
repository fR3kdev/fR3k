# FR3K AI Breakthroughs — Evidence-Gated Workload (2026-11-09)

**Tracking:** [Issue #6](https://github.com/fR3kdev/fR3k/issues/6) · **Coding-agent prompt:** [fr3k-ai-breakthroughs.prompt.md](../../../.github/prompts/fr3k-ai-breakthroughs.prompt.md).

## Goal
Curate and reproduce the most useful techniques from Codacus/thecodacus and independent experimenters for RTX 3060 local abliterated coding models, reliable agent workflows, durable memory, bounded fleet delegation, Android/voice, and Reticulum hardware.

**Status:** This branch contains planning/research ONLY. No agent process is triggered by the issue, these files, or this PR. Production deployments are NOT authorised.

## Priority experiments
| Track | IDs | Accept only after |
|---|---|---|
| Source + licence + measurements | AIB-001/AIB-002 | Pinned source/commit, verified test definitions, exact live machine status or BLOCKED |
| Evaluation harness | AIB-003/AIB-050 | Pi+Hermes real read/edit/test/continuation, hidden spec-vs-test checks, long context and isolation |
| MoE expert caching | AIB-010 | Existing Codex tuning reaches terminal verification; GPU lease; baseline controlled |
| Prefill threading and batch | AIB-020 | Same quality, p95, resource and reproducibility gates |
| KV/cache / speculation / other engines | AIB-030/AIB-040 | Exact quant/model support, 64K context, no prompt-cache leakage |
| UI, memory, Fleet / sandbox | AIB-060/070/080 | Single FR3K scheduler and bounded scopes; capability tests |
| Reticulum/voice / routing/media | AIB-090/100/110 | Simulation first, physical authority separate; licence and privacy |
| Release candidate | AIB-900 | Small PRs, CI, independent deployment verification, rollback, redaction |

**Metric:** verified useful code edits per minute rather than headline tokens/sec; report full-task median/p95, prefill/decode separately, GPU VRAM, RAM, swap, error and repeat rates. At least 3 replicates initially and 5 finalists. Typical promotion requires ≥10% task gain with no quality regression and ≥1 GiB GPU margin.

## Sources by theme
**Local inference:** [thecodacus llama.cpp](https://github.com/thecodacus/llama.cpp), [merged MoE cache PR](https://github.com/ggml-org/llama.cpp/pull/29887), [expert-slot RFC](https://github.com/ggml-org/llama.cpp/discussions/28248), [moe-hotcache](https://github.com/ap03906101/moe-hotcache), [moe-expert-cache](https://github.com/CAN230921/moe-expert-cache), [FreeToken-Kai](https://github.com/yuuki-net/FreeToken-Kai), [Betelgeuse](https://github.com/Betelgeuse-AI/Betelgeuse), [Strata](https://github.com/Niko1221/Strata), [ik_llama.cpp](https://github.com/ikawrakow/ik_llama.cpp).

**Agent/control:** [Pithagoras](https://github.com/thecodacus/pithagoras), [Nerve Protocol](https://github.com/thecodacus/Nerve-Protocol), [AgentBox](https://github.com/thecodacus/agentbox), [spec-wins](https://github.com/thecodacus/spec-wins), [LLM eval suite](https://github.com/thecodacus/llm-eval-suite), [Understory](https://github.com/thecodacus/understory), [Decision Playground](https://github.com/thecodacus/decision-playground).

**Voice and hardware:** [Qwen duplex](https://github.com/thecodacus/qwen3-omni-duplex), [Dexter](https://github.com/thecodacus/dexter), [MeshCam Reticulum](https://github.com/meshcam/meshcam-firmware), [Rendiv](https://github.com/thecodacus/rendiv).

All are **research references**. Performance figures remain creator claims until reproduced on FR3K's exact hardware. MeshCam firmware is GPL-3.0; others may have missing or incompatible licence information. No external code has been incorporated here. Issue #6 contains the fuller dependencies and acceptance contract.

## Approval and security
OBSERVE and authorised sandbox AUTO may proceed without repetitive permission requests. A device-bound one-hour connection lease must not bypass destructive-command approvals. PHYSICAL work (device flash, LoRa transmissions, boot/driver changes) is not authorised by this workload. Secrets, PII, private topology and credentials never go into public evidence. Use the GitHub issue for status, links and blockers; do not claim a job is running without its verified run ID.
