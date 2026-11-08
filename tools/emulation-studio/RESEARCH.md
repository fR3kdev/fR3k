# Emulation tooling investigation · 2026-11-08

## Established projects (candidate integrations, not installed)
- QEMU system + Tiny Code Generator (TCG): https://www.qemu.org/docs/master/system/ — full-machine guest boots without KVM, generally slow.
- QEMU user mode: https://www.qemu.org/docs/master/user/ — foreign-CPU Linux applications, **same host kernel**, not a virtual OS.
- Docker multi-platform Buildx + binfmt: https://docs.docker.com/build/building/multi-platform/ — architecture matrix for container builds; requires controlled binfmt registration by approved admin.
- Renode + Robot Framework: https://renode.readthedocs.io/en/latest/introduction/testing.html — CPU/board/peripheral simulation for firmware, with CI snapshots.
- Google Android emulator container scripts: https://github.com/google/android-emulator-container-scripts — documentation requires KVM; **cannot presently run here as advertised**.
- Playwright: https://playwright.dev — browser regression testing, not OS emulation.
- Wine: https://www.winehq.org — Windows API compatibility layer, not actual Windows validation.

## Zero-star candidate repos discovered via GitHub search
Star count was constrained at **search time**, not continuously verified:
- https://github.com/xoviat/cargo-qemu-test — embedded Rust test execution, fresh QEMU per test, arm/riscv/esp32 paths. **Read README**. Small, unreviewed; check its license and CI before adopting.
- https://github.com/ssalonen/openwrt-netbird-e2e-test — detailed OpenWrt x86_64+arm64 e2e and cleanup receipts. **Read README**. Contains networking and temporary fixture logic; run only on disposable workers.
- https://github.com/aculnaig/gnumach-harness — QEMU libqtest AArch64 Mach kernel harness; **read README**. Narrow kernel use case, not a generic OS.
- https://github.com/evo-os/evo-os-tests — possible tiny test harness, unreviewed.
- https://github.com/fitzgeraldtech/expunge-testing — possible QEMU test harness, unreviewed.

Do not vendor third-party code without checking provenance, license, maintenance, dependency pinning and actual tests. No star count indicates quality or safety.

## Contabo observation vs requirements

**Observed (fleet command receipts):** connected/online FR3K device named `contabo`; Ubuntu 24.04.5, 6 x86_64 CPUs, ~11 GiB RAM, 143 GiB available disk, Docker binary installed, `/dev/kvm` missing, default shell user `fr3kagent`, Docker daemon socket permission denied, QEMU binary unavailable, no qemu binfmt handlers shown. Existing `fr3k-rvm-worker` directory was found and not modified.

**Still unknown:** acceptable KVM/nested virtualization offering from Contabo plan, operator-granted privileged worker, guest disk image licensing, necessary release platform list, emulated peripheral fidelity.

**Approval blocker:** a privileged diagnostic was classified as high risk by the FR3K fleet gateway and **requires out-of-band approval**. The studio core does not need that approval to run its native test receipts.

## Priorities
1. Deploy and run nonprivileged MVP and verify receipt records.
2. Pin guest assets and add one Linux arm64 **actual binary** run under QEMU user, not merely an emulator version check.
3. Add QEMU-TCG OpenWrt guest with stable snapshot/boot/login and network cleanup validation.
4. Add Renode Robot test fixtures for LilyGo K230 / ESP32 / firmware where device models support them.
5. Add Android overlay, microphone, background listening and accessibility tests to an authorized physical Android runner; synthetic emulator evidence remains separate.
6. Introduce KVM-enabled external worker for Windows/Android VMs; integrate Apple hardware worker for legal macOS/iOS tests.

## Additional verified experiment (2026-11-08)

A rootless Ubuntu `qemu-user-static` 8.2.2 package was downloaded using `apt download`, unpacked with `dpkg-deb -x` under the FR3K service user's home, and executed directly (without sudo, Docker or binfmt registration). Signed package provenance was not independently checked for the foreign-arch BusyBox downloads; the exact extracted ELF hashes were captured and pinned in code. Five static foreign-CPU binaries were executed under QEMU: arm64/aarch64, armhf/armv7l, ppc64el/ppc64le, riscv64 and s390x. Each printed an emulated machine architecture, evaluated `expr 6 + 7` to `13` and exited with status 0. This verifies **user-mode CPU execution only**, not a guest kernel, networking, graphics, device drivers or real hardware.
