# fR3k Open Code Drop

> 🔴 **LIVE NOW:** [Watch the full Multi-App AI Agent Hackathon build on YouTube](https://youtube.com/live/eY0ChQGaEe0?si=ihuGARaRKP5ENoDZ)

Useful, runnable code shared live during the Multi-App AI Agent Hackathon. Fork it, break it, improve it, and ship something strange.

## Agentic Action Engine

[`agentic-action-engine/`](agentic-action-engine/) is the public specification for the live competition build: one reusable evidence-first agent runtime adapted to Lemma, Comma Capital, Arga Labs, and Userlens. It is designed around observable traces, grounded state, policy-gated actions, verification after writes, evaluation, and replay.

The initial public drop is intentionally architecture/specification only. Contest implementation begins in the official build window and will evolve live on stream.

## Headline giveaway: a 35B-A3B Qwen model on 4 GB VRAM

[`qwen-35b-on-4gb/`](qwen-35b-on-4gb/) contains the complete reproducible Ollama sweep that ran the 22.3 GiB Q4_K_M community model `huihui_ai/Qwen3.6-abliterated:35b-a3b` on a Quadro T1000 with 4 GB VRAM.

Measured on the recorded workstation run:

- **5.71 generated tokens/second peak** and 5.57 mean
- **3,063 MB peak VRAM** for the winning configuration
- **3/3 included short-suite checks passed**
- Context configurations exercised up to **16K**
- Raw JSON, exact configs, benchmark prompts, harness, and report included

This is CPU/RAM plus partial GPU offload, not a claim that the 22.3 GiB model lives entirely inside 4 GB VRAM. The measured machine also had 32 GB system RAM. Read the evidence and limitations before comparing results.

```bash
cd qwen-35b-on-4gb
python3 harness/preflight.py
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
ollama pull huihui_ai/Qwen3.6-abliterated:35b-a3b
ALLOW_SYSTEM_OLLAMA_CHANGES=1 .venv/bin/python harness/sweep_ollama.py \
  --rig my-4gb-rig --grid configs/workstation.grid.json --suites short
```

The opt-in variable is deliberate: the sweep adjusts the local Ollama systemd service to test KV-cache settings.

## Bonus: dependency-free LLM cost router

`router.py` classifies prompts by complexity and selects a cheap, mid-tier, or frontier model. No key is required to inspect decisions:

```bash
python router.py "Design a multi-app agent with retries and idempotency"
```

Pricing changes frequently. Verify the values in `pricing.py` before production use.

## Why this exists

If you're building today: good luck. Take what helps, improve it, and ship something brilliant.

## Origin and licence

The router is copied from the MIT-licensed [agent-cost-router demo](https://github.com/fr3kchy/agent-cost-router-demo). The 4 GB Qwen kit is copied and hardened from [qwen36-bench](https://github.com/fr3kchy/qwen36-bench). Original licences and attribution are preserved.
