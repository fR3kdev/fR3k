# FR3K Geode-native Q4 abliterated conversion (experimental)

**Status: code tested on synthetic tensors; native pack and device inference UNVERIFIED.**

Builds a *new* Geode `qwen35moe` Q4 pack by selectively re-encoding the `wangzhang/Qwen3.6-35B-A3B-abliterated-v2` attention output and MoE down-projection tensors into Geode's `geode-pack v1` layout. It copies the official base model pack, preserving unchanged gate/up weights, MTP, tokenizer and vision encoder, and modifies only a separate working copy. Data is streamed by pinned-revision HTTP `Range` requests; it **does not need to download 70 GB of source safetensors to disk**.

*Not* a GGUF conversion. The OnePlus 7 Pro GGUF download remains a separate runtime/test artifact. *Not* the original Geode GPTQ calibration: this code uses experimental per-block scale-error-search E4M3FN Q4 post-training quantization. Accuracy and text/image/MTP behavior MUST be measured independently before this can replace the stock Geode model.

## Commands

Use a workstation with enough free disk for **two copies** of the ~20.8 GB original Geode pack and a safety reserve (at least ~50 GB free), adequate RAM, and network access to public Hugging Face. Existing Geode app models are never modified.

```bash
python3 -m pip install --user -r requirements.txt # only if numpy not installed
ROOT=/mnt/fr3k-models/fr3k-geode-native
mkdir -p "$ROOT/reference" "$ROOT/base" "$ROOT/output"
curl -fL 'https://huggingface.co/Maximilian228/Geode-Qwen3.6-35B-A3B/resolve/main/Q4/geode.json' -o "$ROOT/reference/geode.json"
curl -fL 'https://huggingface.co/wangzhang/Qwen3.6-35B-A3B-abliterated-v2/resolve/main/model.safetensors.index.json' -o "$ROOT/reference/model.safetensors.index.json"

python3 geode_native.py inspect --reference "$ROOT/reference"
python3 geode_native.py stage --reference "$ROOT/reference" --base-dir "$ROOT/base/Q4"
python3 geode_native.py verify-base --reference "$ROOT/reference" --base-dir "$ROOT/base/Q4"
python3 geode_native.py build --reference "$ROOT/reference" --base-dir "$ROOT/base/Q4" --output "$ROOT/output/Q4"
python3 geode_native.py verify-output --reference "$ROOT/reference" --output "$ROOT/output/Q4"
python3 -m unittest discover -s tests -v
```

For an **on-disk conversion**, `build` creates a `fr3k-progress.json` journal and an `INCOMPLETE` marker. A partially converted pack is intentionally **not installable**; retry `build` with the same revisions and paths to resume completed layers. The `INCOMPLETE` marker is removed only after all layers, file sizes, and SHA-256 sums are checked.

## Exact native representation

- `q4` codes: signed odd levels `[1,3,...,15,-1,-3,...,-15]` in low/high nibbles, eight bytes per 16 values.
- Each 16-value block has one E4M3FN nonnegative scale byte. Each whole matrix has a floating global factor (in tensor metadata for dense weights; `layers.N.mlp.experts.scales[...,1]` for expert down-projections).
- Native expert Q4 is `tile8`, interleaving rows in tiles of 32, per 64-column chunks, with affine nibble remapping.
- Expert byte stride is `q4(2 * moe_ff, hidden) + q4(hidden, moe_ff)`; the gate/up portion is preserved. This builder patches only the latter `down_proj` bytes and the matching scale value.
- Dense `o_proj` and `shared_expert.down_proj` remain row-wise Q4 (not tiled on disk).
- See the inspected upstream [Geode engine pack reader](https://github.com/sergqwer/geode/blob/main/engine/src/pack.cpp), [Q4 kernels](https://github.com/sergqwer/geode/blob/main/engine/src/kernels.cpp) and [model manifest](https://huggingface.co/Maximilian228/Geode-Qwen3.6-35B-A3B/blob/main/Q4/geode.json).

## Validation gates before deployment

1. **SOURCE:** Pin upstream and derivative Hugging Face revisions, verify shape/offset/format for every targeted safetensors tensor and checksum the Geode base pack.
2. **FORMAT:** Run synthetic Q4 decode/encode, tile8 byte-roundtrip and Geode C++ reader parity tests. Baseline pack must verify byte-for-byte.
3. **CONVERSION:** A distinct output `Q4/` pack with SHA-256 manifest and `INCOMPLETE` removed. Original source pack remains untouched.
4. **ACCEPTANCE:** On REDMAGIC, load from app-private `/data/.../files/models/<new-model-id>/` via Geode's import or Hugging Face pack source. Do **not** place expert data on shared `/sdcard` for inference; Geode uses `O_DIRECT` against `/data`.
5. **REALITY:** Generate deterministic test prompts with the model actually selected; compare text, vision, token/s, memory, NPU/GPU utilization against stock. Record refusal and non-refusal quality objectively. Keep the stock model selectable until gates pass.

## Known limitations / non-claims

- The abliterated author did not publish its exact base model revision, so this is a **hybrid** derivative, not proven bitwise equivalent to re-quantizing every V2 tensor.
- This packer does not reproduce Geode's proprietary GPTQ calibration; quality may be worse than the official Geode pack. Hardware performance is UNKNOWN.
- MTP and vision remain stock; compatibility and draft accept rate are UNKNOWN until tested on a real phone.
- Fully rerunning the quantizer may need many hours and substantial download bandwidth. A host job running is **not** proof of output.
- No keys, device addresses, or other private infrastructure should go into the public branch.
- Software code is published for reproducibility; model redistribution must follow upstream model licensing.