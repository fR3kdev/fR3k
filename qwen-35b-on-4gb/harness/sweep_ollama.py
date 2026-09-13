#!/usr/bin/env python3
"""sweep_ollama.py — for each grid cell: launch via Ollama modelfile + KV-cache env, run bench."""
import argparse, json, os, pathlib, subprocess, sys, time, threading, datetime

ROOT = pathlib.Path(__file__).resolve().parents[1]
LAUNCH = ROOT / "harness" / "launch_ollama.sh"
BENCH = ROOT / "harness" / "bench_ollama.py"

def sh(cmd, timeout=None):
    return subprocess.run(cmd, shell=isinstance(cmd, str), capture_output=True,
                          text=True, timeout=timeout)

class VramSampler(threading.Thread):
    def __init__(self):
        super().__init__(daemon=True); self.peak = 0; self.stop_flag = False
    def run(self):
        while not self.stop_flag:
            try:
                r = sh(["nvidia-smi", "--query-gpu=memory.used", "--format=csv,noheader,nounits"], timeout=3)
                u = int(r.stdout.strip().split("\n")[0])
                self.peak = max(self.peak, u)
            except Exception: pass
            time.sleep(0.5)

def unload(model):
    payload = json.dumps({"model": model, "keep_alive": 0})
    sh(["curl", "-fsS", "-X", "POST", "http://127.0.0.1:11434/api/generate",
        "-H", "Content-Type: application/json", "-d", payload], timeout=20)
    time.sleep(2)

def launch_cell(cell, base_model, deriv):
    env = os.environ.copy()
    env.update({
        "BASE_MODEL": base_model,
        "DERIV_NAME": deriv,
        "NUM_GPU": str(cell["NUM_GPU"]),
        "NUM_CTX": str(cell["NUM_CTX"]),
        "USE_MMAP": str(cell.get("USE_MMAP", "true")),
        "USE_MLOCK": str(cell.get("USE_MLOCK", "true")),
        "KV_TYPE": cell.get("KV_TYPE", "q8_0"),
    })
    return subprocess.run(["bash", str(LAUNCH)], env=env, capture_output=True, text=True, timeout=300)

def run_bench(model, suite, out_path):
    return subprocess.run(["python3", str(BENCH), "--model", model, "--suite", suite, "--out", str(out_path)],
                          capture_output=True, text=True, timeout=2400)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--rig", required=True)
    ap.add_argument("--grid", required=True)
    ap.add_argument("--base-model", default="huihui_ai/Qwen3.6-abliterated:35b-a3b")
    ap.add_argument("--suites", default="short")
    args = ap.parse_args()

    grid = json.loads(pathlib.Path(args.grid).read_text())
    cells = grid["grid"]
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    results_dir = ROOT / "results"; results_dir.mkdir(exist_ok=True)
    summary_path = results_dir / f"{args.rig}_{ts}.json"
    all_rows = []

    deriv = "qwenbench:current"
    try:
        for i, cell in enumerate(cells):
            tag = cell.get("label", f"cell{i}")
            print(f"\n=== [{i+1}/{len(cells)}] {tag} :: {cell} ===", flush=True)
            unload(deriv)
            sampler = VramSampler(); sampler.start()
            t0 = time.time()
            r = launch_cell(cell, args.base_model, deriv)
            load_t = time.time() - t0
            if r.returncode != 0 or "PRELOADED" not in r.stdout:
                err = (r.stderr or r.stdout)[-500:]
                sampler.stop_flag = True
                print(f"  LAUNCH FAILED ({load_t:.1f}s): {err}", flush=True)
                all_rows.append({"cell": tag, "config": cell, "ok": False,
                                 "error": err, "load_s": round(load_t,1),
                                 "vram_peak_mb": sampler.peak})
                continue
            print(f"  loaded in {load_t:.1f}s", flush=True)
            time.sleep(2)
            for suite in args.suites.split(","):
                bench_out = results_dir / f"{args.rig}_{ts}_{tag}_{suite}.json"
                br = run_bench(deriv, suite.strip(), bench_out)
                if br.returncode != 0:
                    print(f"  bench {suite} FAILED: {br.stderr[-300:]}", flush=True)
                    all_rows.append({"cell": tag, "config": cell, "suite": suite,
                                     "ok": False, "error": br.stderr[-300:]})
                    continue
                try:
                    bj = json.loads(bench_out.read_text())
                    summary = bj.get("summary", {})
                    print(f"  {suite}: pass {summary.get('n_pass')}/{summary.get('n_items')} "
                          f"mean {summary.get('mean_gen_tok_per_s')}t/s "
                          f"max {summary.get('max_gen_tok_per_s')}t/s "
                          f"prefill {summary.get('mean_prefill_tok_per_s')}t/s", flush=True)
                    all_rows.append({"cell": tag, "config": cell, "suite": suite,
                                     "summary": summary, "rows": bj.get("rows"),
                                     "load_s": round(load_t,1)})
                except Exception as e:
                    all_rows.append({"cell": tag, "config": cell, "suite": suite,
                                     "ok": False, "error": str(e)[:200]})
            sampler.stop_flag = True; sampler.join(timeout=2)
            for row in all_rows:
                if row.get("cell") == tag and "vram_peak_mb" not in row:
                    row["vram_peak_mb"] = sampler.peak
            print(f"  vram peak: {sampler.peak} MB", flush=True)
            # write incrementally
            summary_path.write_text(json.dumps({"rig": args.rig, "rows": all_rows}, indent=2))
    finally:
        unload(deriv)
        summary_path.write_text(json.dumps({"rig": args.rig, "rows": all_rows}, indent=2))
        print(f"\nFINAL: {summary_path}")

if __name__ == "__main__":
    main()
