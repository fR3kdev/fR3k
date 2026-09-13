#!/usr/bin/env python3
"""Read-only readiness check for the 4 GB Qwen/Ollama benchmark."""
from __future__ import annotations
import json
import pathlib
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]

def command_version(command: str, args: list[str]) -> tuple[bool, str]:
    path = shutil.which(command)
    if not path:
        return False, "not found"
    result = subprocess.run([path, *args], capture_output=True, text=True, timeout=10)
    output = (result.stdout or result.stderr).strip().splitlines()
    return result.returncode == 0, output[0] if output else path

def main() -> int:
    checks: list[tuple[str, bool, str]] = []
    for command, args in (("ollama", ["--version"]), ("curl", ["--version"])):
        ok, detail = command_version(command, args)
        checks.append((command, ok, detail))
    gpu_ok, gpu_detail = command_version(
        "nvidia-smi", ["--query-gpu=name,memory.total", "--format=csv,noheader"]
    )
    checks.append(("nvidia-smi", gpu_ok, gpu_detail))
    for relative in (
        "configs/workstation.grid.json", "configs/workstation.json",
        "bench/gold/short.json", "results/workstation_20260506_033245.json",
    ):
        path = ROOT / relative
        try:
            json.loads(path.read_text())
            checks.append((relative, True, "valid JSON"))
        except Exception as exc:
            checks.append((relative, False, str(exc)))
    for name, ok, detail in checks:
        print(f"[{'OK' if ok else 'FAIL'}] {name}: {detail}")
    print("\nRead-only preflight: no models pulled and no services changed.")
    print("The recorded 4 GB result also requires enough system RAM for CPU offload (32 GB on the measured rig).")
    return 0 if all(ok for _, ok, _ in checks) else 1

if __name__ == "__main__":
    sys.exit(main())
