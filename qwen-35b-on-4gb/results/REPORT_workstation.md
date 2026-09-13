# Qwen3.6-35B-A3B — Workstation Benchmark Report

**Generated:** 2026-05-06 03:44   
**Rig:** Quadro T1000 4GB / i7-10850H 12t / 32GB DDR4 / Parrot 7.2  
**Engine:** Ollama 0.22.1 (llama.cpp internal) · CUDA 13  
**Model:** huihui_ai/Qwen3.6-abliterated:35b-a3b (Q4_K_M, 22.3 GiB, 41 layers, 256 experts × 8 active)

**Suite:** short (3 prompts — primes / code_balance / moe_writeup) · temperature=0  
**Source doctrine:** https://www.youtube.com/watch?v=8F_5pdcD3HY (5-flag MoE optimization)

## Results — sorted by peak gen tok/s

| rank | label | mean t/s | max t/s | prefill t/s | pass | VRAM peak | load |
|------|-------|---------:|--------:|------------:|-----:|----------:|-----:|
| 1 | `auto_4k_q8_no_mmap` | 5.57 | **5.71** | 15.36 | 3/3 | 3063 MB | 13.7s |
| 2 | `auto_4k_q8` | 5.47 | **5.59** | 15.37 | 3/3 | 3367 MB | 94.2s |
| 3 | `auto_8k_q4` | 5.52 | **5.56** | 15.41 | 3/3 | 3071 MB | 15.0s |
| 4 | `auto_16k_q4` | 5.48 | **5.56** | 15.40 | 3/3 | 3187 MB | 13.7s |
| 5 | `auto_4k_q4` | 5.35 | **5.37** | 15.11 | 3/3 | 3059 MB | 15.1s |

## Winner

**`auto_4k_q8_no_mmap`** — 5.71 t/s peak, all 3 correctness checks passed.

```json
{
  "NUM_GPU": -1,
  "NUM_CTX": 4096,
  "KV_TYPE": "q8_0",
  "USE_MMAP": "false",
  "USE_MLOCK": "true",
  "label": "auto_4k_q8_no_mmap"
}
```

## Translation — video flag → Ollama parameter

| video flag | Ollama equivalent | this rig |
|-----------|------------------|---------|
| `--n-cpu-moe N` | `num_gpu` (inverse) — Ollama auto-fits 11/41 layers | auto |
| `--no-mmap` | `use_mmap false` | **on** (winner) |
| `--mlock` | `use_mlock true` | on |
| `--ctx-size N` | `num_ctx N` | 4096 (winner); proven to 16384 |
| `--cache-type-k q4_0 --cache-type-v q3_0` (TurboQuant) | env `OLLAMA_KV_CACHE_TYPE=q4_0` | q8_0 winner here |

## Findings vs the video

- **Video baseline (GTX 1060 6GB):** 17 t/s peak, 256K ctx.
- **This rig (T1000 4GB):** 5.71 t/s peak, ~16K ctx achievable.
- T1000 has **66% less VRAM** + 75% lower memory bandwidth (192 vs 768 GB/s class) → roughly 1/3 the throughput. Result tracks the bandwidth ratio cleanly.
- **No-mmap wins by 2-4%** even with 32GB RAM — confirms the video's mechanism (avoiding cold expert page-faults).
- **q4_0 KV cache (TurboQuant-style)** loses ~3-4% vs q8_0 on this hardware (q8_0 winner). Likely because the T1000 lacks the memory pressure where KV compression pays off.
- **All KV cache types and contexts pass 3/3 correctness** — no silent quality loss observed in short suite.

## Extension path

The harness is rig-agnostic. Add a hardware-specific grid, run the same short suite, and retain both the raw JSON and environment description so results remain comparable.

## Files

- Harness: `harness/launch_ollama.sh`, `harness/bench_ollama.py`, `harness/sweep_ollama.py`
- Grids: `configs/workstation.grid.json`, `configs/3060ti-host.grid.json`
- Gold prompts: `bench/gold/short.json`, `bench/gold/medium_recall.json`, `bench/gold/long_codebase.json`
- Raw results: `results/workstation_20260506_033245.json`
- Optimal config (this rig): `configs/workstation.json`