#!/usr/bin/env python3
"""FR3K Android release gate: APK static analysis + isolated emulator smoke.

Outputs local raw receipts and screenshots. Never declares an actual release cleared.
Uses an explicitly selected emulator serial; refuses physical-device serials.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time
import uuid
import zipfile
from datetime import datetime, timezone

BASE = Path(__file__).resolve().parent
SDK = Path(os.getenv("ANDROID_HOME") or os.getenv("ANDROID_SDK_ROOT") or str(Path.home() / "Android/Sdk"))
OUTPUT = Path(os.getenv("FR3K_ANDROID_EVIDENCE_DIR") or str(Path.home() / ".local/share/fr3k-emulation-studio/android-runs"))


def digest(path):
    h = hashlib.sha256()
    with path.open("rb") as f:
        for buf in iter(lambda: f.read(1024 * 1024), b""):
            h.update(buf)
    return h.hexdigest()


def tool(name):
    if name == "adb":
        choices = [SDK / "platform-tools/adb", Path(shutil.which("adb") or "/nonexistent")]
    else:
        root = SDK / "build-tools"
        choices = sorted(root.glob("*/" + name), reverse=True) if root.is_dir() else []
        choices += [Path(shutil.which(name) or "/nonexistent")]
    return next((str(p) for p in choices if p.is_file()), None)


def command(argv, seconds=30, input_bytes=None):
    try:
        r = subprocess.run(argv, input=input_bytes, capture_output=True, timeout=seconds, check=False)
        return {"rc": r.returncode, "out": r.stdout.decode("utf-8", "replace")[:16000],
                "err": r.stderr.decode("utf-8", "replace")[:3000]}
    except (OSError, subprocess.TimeoutExpired) as exc:
        return {"rc": 124, "out": "", "err": type(exc).__name__ + ": " + str(exc)[:400]}


def match(pattern, text):
    found = re.search(pattern, text, flags=re.MULTILINE)
    return found.group(1) if found else None


def static_scan(apk, deep=False):
    summary = {"apk_sha256": digest(apk), "bytes": apk.stat().st_size}
    failures = []
    try:
        with zipfile.ZipFile(apk) as zipf:
            files = zipf.infolist()
            names = {i.filename for i in files}
            summary["zip_entries"] = len(files)
            summary["zip_uncompressed_bytes"] = sum(i.file_size for i in files)
            summary["abis"] = sorted({m.group(1) for i in files
                                      if (m := re.match(r"lib/([^/]+)/[^/]+\.so$", i.filename))})
            if len(files) > 200000 or summary["zip_uncompressed_bytes"] > 50 * 1024 ** 3:
                failures.append("ZIP_RESOURCE_LIMIT")
            if "AndroidManifest.xml" not in names:
                failures.append("NO_ANDROID_MANIFEST")
            if any(i.file_size > max(i.compress_size, 1) * 2000 and i.file_size > 16 * 1024 ** 2 for i in files):
                failures.append("SUSPICIOUS_COMPRESSION_RATIO")
            if deep and not failures:
                corrupted = zipf.testzip()
                if corrupted is not None:
                    failures.append("ZIP_CRC_FAILURE")
                    summary["corrupted_entry"] = corrupted
    except (OSError, zipfile.BadZipFile, RuntimeError) as exc:
        failures.append("INVALID_ZIP")
        summary["zip_error"] = type(exc).__name__

    aapt = tool("aapt")
    if aapt:
        result = command([aapt, "dump", "badging", str(apk)], 90)
        summary["aapt_rc"] = result["rc"]
        summary["package"] = match(r"^package: name='([^']+)'", result["out"])
        summary["version_code"] = match(r"^package:.*versionCode='([^']+)'", result["out"])
        summary["version_name"] = match(r"^package:.*versionName='([^']+)'", result["out"])
        summary["min_sdk"] = match(r"^sdkVersion:'([^']+)'", result["out"])
        summary["target_sdk"] = match(r"^targetSdkVersion:'([^']+)'", result["out"])
        summary["launcher"] = match(r"^launchable-activity: name='([^']+)'", result["out"])
        if result["rc"] or not summary["package"]:
            failures.append("AAPT_MANIFEST_PARSE")
        perms = command([aapt, "dump", "permissions", str(apk)], 90)
        summary["requested_permissions"] = sorted(set(re.findall(r"name='(android\.permission\.[^']+)'", perms["out"])))
    else:
        failures.append("AAPT_UNAVAILABLE")

    signer = tool("apksigner")
    if signer:
        result = command([signer, "verify", "--print-certs", str(apk)], 120)
        summary["apksigner_rc"] = result["rc"]
        summary["signing_cert_sha256"] = match(r"certificate SHA-256 digest: ([a-f0-9]+)", result["out"])
        summary["debug_signer"] = bool(re.search(r"CN=Android Debug|O=Android, CN=Android Debug", result["out"]))
        if result["rc"]:
            failures.append("APK_SIGNATURE_INVALID")
        if summary["debug_signer"]:
            failures.append("DEBUG_SIGNED_NOT_DISTRIBUTABLE")
    else:
        failures.append("APKSIGNER_UNAVAILABLE")
    summary["static_errors"] = failures
    summary["static_status"] = "PASS" if not failures else "FAIL"
    return summary


def android_smoke(apk, static, serial, output_dir):
    if not serial.startswith("emulator-") or not re.fullmatch(r"emulator-[0-9]{4,5}", serial):
        return {"status": "BLOCKED", "reason": "ONLY_EXPLICIT_EMULATORS_ALLOWED"}
    adb = tool("adb")
    if not adb or not static.get("package") or not static.get("launcher"):
        return {"status": "BLOCKED", "reason": "ADB_OR_LAUNCHER_UNAVAILABLE"}
    def call(*argv, seconds=40):
        return command([adb, "-s", serial, *argv], seconds)
    state = call("get-state")
    if state["rc"] != 0 or state["out"].strip() != "device":
        return {"status": "BLOCKED", "reason": "EMULATOR_NOT_ONLINE", "state": state}
    boot = call("shell", "getprop", "sys.boot_completed")
    if boot["out"].strip() != "1":
        return {"status": "BLOCKED", "reason": "ANDROID_BOOT_INCOMPLETE", "boot_value": boot["out"].strip()}
    guest_api = call("shell", "getprop", "ro.build.version.sdk")
    guest_abi = call("shell", "getprop", "ro.product.cpu.abi")
    outcome = {"serial": serial, "guest_api": guest_api["out"].strip(), "guest_abi": guest_abi["out"].strip()}
    if static.get("min_sdk") and guest_api["out"].strip().isdigit():
        if int(static["min_sdk"]) > int(guest_api["out"].strip()):
            return {**outcome, "status": "BLOCKED", "reason": "MIN_SDK_ABOVE_EMULATOR"}
    installed = call("install", "-r", "-t", str(apk), seconds=360)
    outcome["install_rc"] = installed["rc"]
    outcome["install_message"] = (installed["out"] + installed["err"])[:1000]
    if installed["rc"]:
        return {**outcome, "status": "FAIL", "reason": "INSTALL_FAILED"}
    package = static["package"]
    launcher = static["launcher"]
    if launcher.startswith("."):
        launcher = package + launcher
    elif "." not in launcher:
        launcher = package + "." + launcher
    activity = package + "/" + launcher
    call("logcat", "-c", seconds=15)
    launched = call("shell", "am", "start", "-W", "-n", activity, seconds=70)
    outcome["activity"] = activity
    outcome["launch_rc"] = launched["rc"]
    outcome["launch_message"] = (launched["out"] + launched["err"])[:1000]
    time.sleep(7)
    pid = call("shell", "pidof", package)
    outcome["pid_present"] = pid["rc"] == 0 and pid["out"].strip().isdigit()
    png = command([adb, "-s", serial, "exec-out", "screencap", "-p"], 30)  # text command can't preserve PNG
    # Direct binary screenshot without conversion.
    try:
        shot = subprocess.run([adb, "-s", serial, "exec-out", "screencap", "-p"],
                              capture_output=True, timeout=35, check=False)
        if shot.returncode == 0 and shot.stdout.startswith(b"\x89PNG"):
            screenshot = output_dir / "launch.png"
            screenshot.write_bytes(shot.stdout)
            screenshot.chmod(0o600)
            outcome["screenshot_sha256"] = digest(screenshot)
            outcome["screenshot_bytes"] = screenshot.stat().st_size
        else:
            outcome["screenshot_error"] = "PNG_NOT_CAPTURED"
    except (subprocess.TimeoutExpired, OSError) as exc:
        outcome["screenshot_error"] = type(exc).__name__
    logs = call("logcat", "-d", "-t", "1300", "-v", "brief", seconds=30)
    raw = output_dir / "guest-logcat-private.txt"
    raw.write_text(logs["out"][:100000], encoding="utf-8")
    raw.chmod(0o600)
    outcome["raw_log_sha256"] = digest(raw)
    outcome["crash_suspected"] = ("FATAL EXCEPTION" in logs["out"] and package in logs["out"])
    outcome["overlay_permission_state"] = call("shell", "cmd", "appops", "get",
                                                package, "SYSTEM_ALERT_WINDOW")["out"][:350]
    passed = (launched["rc"] == 0 and outcome["pid_present"] and
              bool(outcome.get("screenshot_sha256")) and not outcome["crash_suspected"])
    outcome["status"] = "PASS" if passed else "FAIL"
    outcome["scope"] = "install_launch_screenshot_process_only"
    outcome["unverified"] = ["microphone_audio", "speech_recognition", "accessibility_service",
                             "overlay_window_visible_outside_app", "rotation", "gesture",
                             "physical_arm_device", "permissions_dialogs"]
    return outcome


def main():
    p = argparse.ArgumentParser()
    p.add_argument("apk", type=Path)
    p.add_argument("--serial", default=None, help="Run on an explicitly named emulator, e.g. emulator-5580")
    p.add_argument("--deep-zip", action="store_true")
    args = p.parse_args()
    apk = args.apk.resolve(strict=True)
    if not apk.is_file() or apk.suffix.lower() != ".apk":
        p.error("must be a regular .apk")
    OUTPUT.mkdir(parents=True, exist_ok=True, mode=0o700)
    run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-" + uuid.uuid4().hex[:12]
    directory = OUTPUT / run_id
    directory.mkdir(mode=0o700)
    static = static_scan(apk, args.deep_zip)
    runtime = android_smoke(apk, static, args.serial, directory) if args.serial else {"status": "NOT_ATTEMPTED"}
    overall = "NOT_CLEARED"
    evidence = {"schema": 1, "run_id": run_id, "time_utc": datetime.now(timezone.utc).isoformat(),
                "artifact_name": apk.name, "static": static, "runtime": runtime,
                "release_gate": overall, "reason": "manual_voice_overlay_permissions_and_production_signing_pending"}
    b = json.dumps(evidence, sort_keys=True, separators=(",", ":")).encode()
    evidence["record_sha256"] = hashlib.sha256(b).hexdigest()
    target = directory / "record.json"
    target.write_text(json.dumps(evidence, indent=2, sort_keys=True) + "\n")
    target.chmod(0o600)
    print(json.dumps({"run_id": run_id, "apk_sha256": static["apk_sha256"], "static": static["static_status"],
                      "static_errors": static["static_errors"], "package": static.get("package"),
                      "runtime": runtime["status"], "runtime_reason": runtime.get("reason"),
                      "evidence": str(target), "release_gate": overall}, indent=2))
    return 0 if static["static_status"] == "PASS" and runtime["status"] in ("PASS", "NOT_ATTEMPTED") else 1


if __name__ == "__main__":
    sys.exit(main())
