# Android-first Emulation Studio evidence — 2026-11-08

## Gate status
**NOT CLEARED FOR PUBLIC RELEASE.** Tests were performed on X1's accelerated Android 15 (API 35, x86_64) emulator, with Contabo acting as the source-controlled test controller. No physical ARM handset, microphone, voice, animation quality, gestures or transparency testing is claimed.

The authorised root SSH route from the connected phone to Contabo was verified. The VPS lacks accessible KVM and Android binder support, so it is inappropriate for accelerated Android guest testing. Existing services were left unchanged.

## APK under test
- Artifact: FR3K-Overlay-Full-AgentOps-Lab-20261108.apk
- SHA-256: 8ab3e17844b545a191f0fe8d07af9327fe5bd79b138f6e793d74af3b7470398b
- Size: 418395058 bytes
- Package: dev.fr3k.overlay.full.lab
- Minimum SDK: 26; target SDK: 35; ABIs: arm64-v8a, armeabi-v7a, x86, x86_64
- Signed with Android Debug certificate: TEST ONLY, not a production release.
- ZIP includes 203 video files (366052119 uncompressed bytes).

## Raw observations and reconciliation
1. A separate AVD named fr3k-release-studio-api35 was created without overwriting the existing beta AVD. First boot took about 182s.
2. APK installation before boot completion failed with a PackageManagerInternal NullPointerException. After the OS reported boot complete, installation succeeded.
3. Original smoke-harness receipt incorrectly showed narrow runtime PASS because it accepted process+PNG despite System UI ANR and notification dialog. We preserved the original record and fixed the checker to fail ANR and require UI hierarchy and app foreground. Initial receipt ID: 20261108T032735Z-7de8cfde7c5f.
4. Initial catalog rows showed media unavailable; static APK contains the videos and code installs them asynchronously. After copy/hash validation, Crow, Dragon, Spider, Scorpion, Wolf, Tiger and Phoenix displayed installed; the first six showed ten playable files. This was a transient state, not evidence of missing bundle content.
5. Overlay permission was granted on the test emulator. A first Home-screen check returned zero app-owned overlay windows. Further log inspection found the selected Cassowary show was a **single scene**, and the service naturally logged "show complete; queue exhausted" and stopped.
6. Another restart encountered an Android microphone permission dialog. After granting test-only microphone permission and explicitly selecting Crow's **ten-scene** track, pressing PLAY logged the foreground-service start. On switching immediately to the launcher, Android WindowManager confirmed an app-owned visible APPLICATION_OVERLAY with SYSTEM_ALERT_WINDOW permission while the launcher was foreground. This verifies an active-playback floating overlay can coexist with the launcher; it does not verify actual video alpha or audio.
7. The original missing-overlay check was correct *at that instant*, but is not a valid general claim that overlay support is broken. Check active playback lifecycle and expected auto-stop semantics separately.

## Implemented code
- android_gate.py: APK ZIP, manifest, signer and emulator-only runtime checker with evidence receipts and stricter UI assertions.
- android_overlay_check.py: explicitly selected emulator only; reports per-package APPLICATION_OVERLAY WindowManager visibility/ownership and permission state; no physical-device mutations.
- Unit tests for false-positive ANRs, permission-dialog blocking, missing UI and window ownership.
- Evidence retained privately on X1 under FR3K/emulation-studio/runs; do not publish screenshots/raw logs, keys or infrastructure data.

## Outstanding (all unverified unless explicitly above)
Production signing; full video/alpha quality, move/zoom/rotation, first-run permission UX, microphone/STT/TTS and auto-listen, end-to-end voice with creatures, Android TV, older OS matrix, long-running repeated UI tests, physical ARM phones, and Contabo-to-X1 controlled jobs/evidence transfer.

**Do not merge the draft PR or clear a release based solely on this smoke suite.**

## Final live automated overlay check

After selecting the installed Crow 10-scene track, enabling the app's own overlay permission and switching to Android Home during playback, the corrected read-only checker returned **PASS / WINDOW_MANAGER_OVERLAY_VISIBLE**, with one FR3K-owned visible window, permission allowed and launcher foreground. Receipt on X1: FR3K/emulation-studio/runs/android35-crow-overlay-live-check-v2.json. An intermediate checker returned BLOCKED/HOME_NOT_FOREGROUND because its adb shell-pipe parser failed to capture focus; the parser was fixed, tested and retested. Do not rewrite that earlier receipt. The previous zero-window observation followed the natural end of the one-scene Cassowary show.

**Contabo final code validation:** 20/20 Python unit tests passed after a clean Git fast-forward. Python compilation of both Android runners succeeded. No actual Android guest OS was booted on Contabo; X1 supplied KVM-accelerated emulator execution. The isolated APK remains debug-signed, therefore public release is still blocked.

## Evidence integrity and transfer authority

Latest live overlay receipt run ID: 20261108T034917Z-ad53bd25ad; status PASS / WINDOW_MANAGER_OVERLAY_VISIBLE, one visible app-owned window, launcher foreground. A subsequent FR3K Fleet command reread the raw private X1 JSON and recomputed its canonical record SHA-256: **VERIFIED**. Source-file SHA-256: 669ee65478327ac4eb504ee14e138b85557f15523d4a1422627665c83c16659d.

A separate cross-device X1-to-Contabo receipt transfer was requested but the FR3K gateway classified it as **approval_required**, job 3dfb1d7172d34f1aab6a9efa382d6e30. **No successful transfer to Contabo is claimed** and the authority gate was not bypassed. X1 original evidence remains privately available, and Contabo retains the committed code and human-readable audit notes.
