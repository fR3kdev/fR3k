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

In the recorded 4K/q8 comparison, the no-mmap configuration achieved 5.71 versus 5.59 peak tokens/s (about 2.1% higher). Q8 beat Q4 in the recorded 4K configurations. These short-suite results do not isolate the mechanism or establish a general advantage across workloads.

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

From `qwen-35b-on-4gb/`:

```bash
python3 harness/preflight.py
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
ollama pull huihui_ai/Qwen3.6-abliterated:35b-a3b
ALLOW_SYSTEM_OLLAMA_CHANGES=1 .venv/bin/python harness/sweep_ollama.py \
  --rig workstation \
  --grid configs/workstation.grid.json \
  --suites short
```

The sweep can change and restart the local Ollama systemd service to test KV-cache settings. Review `harness/launch_ollama.sh` before using the explicit `ALLOW_SYSTEM_OLLAMA_CHANGES=1` opt-in.

## Measurement boundaries

- The model uses CPU/system RAM plus partial GPU offload; the 22.3 GiB model does not fit entirely in 4 GB VRAM.

- This is a constrained-hardware engineering sweep, not a general model-quality benchmark.
- Correctness is limited to the included three-item short suite.
- Throughput comparisons are meaningful only with matching model, runtime and hardware conditions.
- Raw data is retained so the report can be checked independently.

## Licence

MIT. Benchmark result data is provided for reproducibility.
