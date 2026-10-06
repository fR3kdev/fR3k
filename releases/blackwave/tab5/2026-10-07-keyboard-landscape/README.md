# BLACKWAVE Tab5 — keyboard + landscape — 2026-10-07

Target: M5Stack Tab5 / ESP32-P4.

This build adds:
- landscape-first 1280x720 BLACKWAVE UI
- native Tab5 keyboard input over Grove I2C
- typed prompt submission
- typing-triggered microphone mute while keeping TTS/voice replies enabled
- keyboard reconnect handling
- size-optimized build that preserves the existing A/B OTA partition layout

For M5Launcher, prefer `fr3k_blackwave_tab5_merged.bin` so the app and generated assets travel together.
The app-only image is `fr3k_blackwave_agent.bin`.

Flash layout:
- 0x2000 bootloader.bin
- 0x8000 partition-table.bin
- 0xd000 ota_data_initial.bin
- 0x20000 fr3k_blackwave_agent.bin
- 0x800000 generated_assets.bin

Build verification:
- app size: 3,768,352 bytes
- app partition: 0x3f0000 bytes
- app free space after build: 0x57fe0 bytes (~9%)
- app SHA-256: 0b798d09dd076740f4b0ad865b80940aa721fb4f8c0313a4c484ec75500a606f
- merged SHA-256: 5f3d05ef19964adf2d0922400202da6151870a8794f87545f1310d5b20f1f24e

Hardware behavior remains unverified until flashed and exercised on the physical Tab5.
