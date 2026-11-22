#!/usr/bin/env python3
"""Read-only selective-patch audit of Geode Q4 expert data.

Supports partial outputs while INCOMPLETE is present. This tool NEVER marks a
pack deployable; final manifest hashes + hardware inference are separate gates.
"""
import argparse
import json
from pathlib import Path


def check(base: Path, output: Path, reference: Path):
    manifest = json.loads((reference / "geode.json").read_text())
    journal = json.loads((output / "fr3k-progress.json").read_text())
    completed = journal.get("completed_layers", [])
    layers = manifest["experts"]["layers"]
    cfg = manifest["config"]
    if not completed or len(set(completed)) != len(completed):
        raise ValueError("missing or repeated completed layers")
    if any(type(i) is not int or i < 0 or i >= len(layers) for i in completed):
        raise ValueError("out-of-range layer number")
    if sorted(completed) != list(range(len(completed))):
        raise ValueError("non-contiguous completion journal")
    hidden = cfg["hidden_size"]
    ff = cfg["moe_intermediate_size"]
    experts = cfg["num_experts"]
    if (hidden % 16 or ff % 16 or hidden <= 0 or ff <= 0):
        raise ValueError("invalid Q4 geometry")
    gate_up_bytes = 2 * ff * hidden * 9 // 16
    down_bytes = hidden * ff * 9 // 16
    verified = 0
    print("evidence_type=READ_ONLY_PARTIAL_SAMPLING")
    print("completed_layers=" + str(len(completed)))
    print("format=geode q4 expert tile8")
    for layer in completed:
        table = layers[layer]
        if table.get("format") != "q4" or table.get("stride") != gate_up_bytes + down_bytes:
            raise ValueError("unexpected expert encoding at layer " + str(layer))
        name = table["file"]
        for expert in sorted(set((0, experts // 2, experts - 1))):
            pos = table["offset"] + expert * table["stride"]
            with (base / name).open("rb") as a, (output / name).open("rb") as b:
                a.seek(pos)
                b.seek(pos)
                orig_gate, new_gate = a.read(gate_up_bytes), b.read(gate_up_bytes)
                orig_down, new_down = a.read(down_bytes), b.read(down_bytes)
            if len(orig_gate) != gate_up_bytes or len(orig_down) != down_bytes or len(new_gate) != gate_up_bytes or len(new_down) != down_bytes:
                raise ValueError("truncated expert at layer %d expert %d" % (layer, expert))
            if orig_gate != new_gate:
                raise ValueError("gate/up unexpectedly changed: layer %d expert %d" % (layer, expert))
            if orig_down == new_down:
                raise ValueError("down projection not patched: layer %d expert %d" % (layer, expert))
            verified += 1
    print("sampled_experts=" + str(verified))
    print("gate_up_preserved=PASS")
    print("down_patch_present=PASS")
    print("native_model_ready=NO")
    print("device_inference_verified=NO")


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--base", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    p.add_argument("--reference", type=Path, required=True)
    a = p.parse_args()
    check(a.base, a.output, a.reference)


if __name__ == "__main__":
    main()
