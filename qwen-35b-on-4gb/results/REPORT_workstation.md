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

## Configuration interpretation

The sweep uses Ollama `num_gpu`, `num_ctx`, `use_mmap`, `use_mlock`, and the service-level `OLLAMA_KV_CACHE_TYPE` setting. These are the settings represented in the retained configuration and result files. The retained sweep does not include a CPU-expert-offload comparison or a TurboQuant benchmark.

## Findings and limits

- The highest recorded generation rate is **5.71 tok/s**, with **5.57 tok/s** mean generation for `auto_4k_q8_no_mmap`.
- Compared with `auto_4k_q8`, the no-mmap configuration has about **2.1% higher peak** and **1.8% higher mean** generation. The sweep does not isolate cache warmth or page-fault behavior, so it does not establish why this configuration was faster.
- At 4K context with mmap enabled, q8 has about **4.1% higher peak** and **2.2% higher mean** generation than q4 in the recorded results. This is specific to the measured short workload.
- Configured context sizes reached 16,384, but the three short prompts do not establish long-context quality or performance.
- Every configuration passed the same three checks; this does not establish general model quality or absence of quality loss.
- This is CPU/RAM plus partial GPU offload on a 32 GB RAM workstation. The model is not wholly resident in 4 GB VRAM. No controlled cross-GPU comparison is included, so bandwidth or VRAM alone cannot explain a performance ratio against another rig.

## Extension path

The harness is rig-agnostic. Add a hardware-specific grid, run the same short suite, and retain both the raw JSON and environment description so results remain comparable.

## Files

- Harness: `harness/launch_ollama.sh`, `harness/bench_ollama.py`, `harness/sweep_ollama.py`
- Grids: `configs/workstation.grid.json`
- Gold prompts: `bench/gold/short.json`
- Raw results: `results/workstation_20260506_033245.json`
- Optimal config (this rig): `configs/workstation.json`
