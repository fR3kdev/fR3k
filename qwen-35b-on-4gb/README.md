# Qwen3.6 35B-A3B on 4 GB VRAM

Reproducible Ollama benchmark harness and measured optimisation sweep for `huihui_ai/Qwen3.6-abliterated:35b-a3b` on a Quadro T1000 4 GB.

## Result

| Metric | Winner |
|---|---:|
| Peak generation | **5.71 tok/s** |
| Mean generation | **5.57 tok/s** |
| Mean prefill | **15.36 tok/s** |
| Peak VRAM | **3063 MB** |
| Correctness | **3/3 short-suite checks** |
| Context tested | up to **16K** |

Winning Ollama configuration:

```json
{
  "NUM_GPU": -1,
  "NUM_CTX": 4096,
  "KV_TYPE": "q8_0",
  "USE_MMAP": "false",
  "USE_MLOCK": "true"
}
```

On this 4 GB GPU, disabling mmap improved peak generation by roughly 2–4%. Q8 KV cache beat Q4 for the measured short workload; the constrained card did not benefit enough from KV compression to offset its cost.

## Hardware and runtime

- NVIDIA Quadro T1000 4 GB
- Intel i7-10850H, 12 threads
- 32 GB DDR4
- Ollama 0.22.1 / llama.cpp backend
- CUDA 13
- Q4_K_M model, 22.3 GiB, 41 layers, 256 experts × 8 active

## Repository contents

- `harness/bench_ollama.py` — deterministic Ollama chat benchmark
- `harness/sweep_ollama.py` — configuration sweep coordinator
- `configs/workstation.grid.json` — tested grid
- `configs/workstation.json` — winning configuration
- `bench/gold/short.json` — three inspectable correctness checks
- `results/workstation_20260506_033245.json` — raw measured output
- `results/REPORT_workstation.md` — full report and interpretation

## Reproduce

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
ollama pull huihui_ai/Qwen3.6-abliterated:35b-a3b
python3 harness/sweep_ollama.py \
  --rig workstation \
  --grid configs/workstation.grid.json \
  --suites short
```

## Measurement boundaries

- This is a constrained-hardware engineering sweep, not a general model-quality benchmark.
- Correctness is limited to the included three-item short suite.
- Throughput comparisons are meaningful only with matching model, runtime and hardware conditions.
- Raw data is retained so the report can be checked independently.

## Licence

MIT. Benchmark result data is provided for reproducibility.
