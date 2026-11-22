# Geode native abliterated conversion — evidence log

Date: 2026-11-22.

**VERIFIED — source inspection:** Geode source loader requires `geode-pack` v1 with `qwen35moe`; dense Q4 and tile8 expert Q4 formats are distinct. Source safetensors has fused routed expert `down_proj` and attention `o_proj` tensors.

**VERIFIED — network:** HTTP range reads (206) work on official native expert binary and abliterated source safetensors; full weight transfer not required for selective re-encoding.

**VERIFIED — local simulation:** Six Python unit tests passed on synthetic tensors, including Q4 row decode and exact tile8 roundtrip. NOT a hardware test or proof of inference quality.

**UNVERIFIED:** Full source model shape check, whole-pack staging, Geode C++ parity, mobile inference, GPTQ-relative quality, MTP acceptance, vision, CPU/GPU/NPU acceleration.

**SAFETY:** Source and built native packs must be separate. `INCOMPLETE` marker prevents deployment until hashing/manifest checks finish. Original calibration quality results removed from derivative manifest.

**NEXT GATE:** Run the source header preflight, stage the pristine official base, run full selective re-encoding, verify artifact, then test against stock Geode on target hardware. No deployment is claimed.
