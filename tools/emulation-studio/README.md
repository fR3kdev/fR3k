# FR3K Emulation Studio · Contabo pre-release test control plane

**Status (2026-11-08): MVP native smoke engine with evidence receipts.** This is **not** a claim that all OS targets are installed, booted or verified.

The connected Contabo FR3K fleet target was observed running Ubuntu 24.04.5, x86_64, 6 vCPU, ~11 GiB RAM and ~143 GiB free disk. `/dev/kvm` was absent. Docker 29.1.3 is installed but the fleet principal `fr3kagent` cannot access its daemon socket. QEMU binaries and binfmt handlers were not present. A privileged capability check was **HELD FOR APPROVAL**; no workaround was attempted.

## Use

```sh
cd tools/emulation-studio
python3 studio.py probe
python3 studio.py matrix
python3 -m unittest discover -s tests -v
python3 studio.py suite
python3 studio.py report
# Recheck a returned receipt ID:
python3 studio.py verify 20261108T000000Z-<actual-id>
```

Default evidence directory: `~/.local/share/fr3k-emulation-studio/runs/`, override with `FR3K_EMUL_EVIDENCE_DIR`.

**Assurance:** fixed allowlisted subprocess commands, non-shell execution, timeout, CPU/memory/file-descriptor ceilings, separate record per run, SHA-256 integrity digest, attempted-versus-blocked distinction. On its own, a SHA digest detects local changes but is **not** a tamper-proof external attestation. A later collector must preserve signed immutable copies in an append-only remote evidence store. There is no network listener, no root permission request and no image auto-download.

## Coverage tiers

| Tier | Engine | Platform targets | Gate |
| --- | --- | --- | --- |
| 0 | native stdlib runners | Linux amd64 / Python / controls | Immediately runnable on compatible host |
| 1 | QEMU user + binfmt | ARM64/ARMv7/PPC64LE/s390x Linux apps | Non-root user-mode runner, checksum-pinned images, tested ABI |
| 2 | QEMU TCG system | Linux RISC-V, FreeBSD, OpenWrt | Signed guest images, timeout/CPU budgets, disposable network |
| 3 | Renode + Robot | Zephyr, FreeRTOS, ARM/RISC-V peripherals | Validated machine descriptions/firmware/board fixtures |
| 4 | KVM-backed VM and Android emulator | Windows, Android UI and broad desktop guest tests | Separate KVM-capable or bare-metal worker; **not currently available on Contabo** |
| 5 | physical devices + eligible Apple runners | Android overlay/audio/accessibility, iOS/macOS | Real devices, Apple hardware where required; no simulated pass |

Do not interpret Linux containers as independent OS kernels, Wine as Windows, QEMU TCG boots as native performance benchmarks, or Renode peripherals as real silicon certification. Full-system emulation and user-mode emulation have different coverage.

## Product architecture

GitHub artifacts -> immutable release candidate digest -> profile planner -> centralized scheduler (stable job ID, leases, fencing, idempotency, dependencies) -> isolated worker with resource limit -> immutable raw evidence -> interpretation -> release gate. No automatic physical writes. Gate release on required profile PASS **and** verified provenance; optional profiles may be BLOCKED but never silently counted as PASS.

- **OBSERVE:** host capabilities, target matrix, existing fleet work.
- **VERIFY:** actual emulator availability and owner authority.
- **RECONCILE:** compare release targets against current coverage, mark gaps.
- **IMPROVE:** add a worker by exact platform, using a pinned image and integration test.
- **TEST:** cold boot, install, smoke, UI/voice/overlay where feasible, boundary and failure cases.
- **RECORD:** preserve raw logs, tool versions, guest image hashes and reviewer gate.

**Resources:** keep Contabo controller + low-concurrency preflight runners. Run GPU-heavy Android tests and nested virtualization only on capable devices. Omarchy replaces retired Parrot, but was offline when observed. Existing FR3K RVM work on Contabo was left untouched.

See [RESEARCH.md](RESEARCH.md) for upstream choices, small-repo leads and adoption risks.
