#!/usr/bin/env python3
"""Read-only Android overlay verification on an explicitly selected test emulator.

Requires the APK to have been installed, permissions granted and Play pressed
before running. Does not grant privileges, press buttons or touch real devices.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
from datetime import datetime, timezone
from uuid import uuid4

def command(serial, *args):
    try:
        p = subprocess.run(["adb", "-s", serial, *args], capture_output=True,
                           text=True, errors="replace", timeout=35, check=False)
        return (p.returncode, p.stdout[:350000])
    except (OSError, subprocess.TimeoutExpired):
        return (124, "")

def windows_for_package(text, package):
    matches = []
    for block in re.split(r"(?=\n  Window #\d+ Window\{)", text):
        if "package=" + package not in block:
            continue
        if "ty=APPLICATION_OVERLAY" not in block:
            continue
        matches.append({
            "visible": "isVisible=true" in block,
            "on_screen": "isOnScreen=true" in block,
            "surface_shown": "Surface: shown=true" in block,
        })
    return matches

def decision(permission_allowed, launcher_visible, windows):
    if not permission_allowed:
        return "BLOCKED", "OVERLAY_PERMISSION_NOT_GRANTED"
    if not launcher_visible:
        return "BLOCKED", "HOME_NOT_FOREGROUND"
    if not windows:
        return "FAIL", "NO_APP_OWNED_OVERLAY_WINDOW"
    if not any(w["visible"] and w["on_screen"] for w in windows):
        return "FAIL", "APP_OVERLAY_NOT_VISIBLE"
    return "PASS", "WINDOW_MANAGER_OVERLAY_VISIBLE"

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--serial", required=True)
    parser.add_argument("--package", required=True)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if not re.fullmatch(r"emulator-\d{4,5}", args.serial):
        parser.error("real-device testing is not authorized by this runner")
    if not re.fullmatch(r"[a-zA-Z][a-zA-Z0-9_.]+", args.package):
        parser.error("invalid Android package ID")
    rc, windows = command(args.serial, "shell", "dumpsys", "window", "windows")
    _, focus = command(args.serial, "shell", "sh", "-c", "dumpsys window | grep mCurrentFocus")
    _, operations = command(args.serial, "shell", "cmd", "appops", "get", args.package, "SYSTEM_ALERT_WINDOW")
    candidates = windows_for_package(windows, args.package) if rc == 0 else []
    allowed = "SYSTEM_ALERT_WINDOW: allow" in operations
    at_home = "launcher" in focus.lower()
    status, reason = decision(allowed, at_home, candidates)
    receipt = {
        "schema": 1,
        "run_id": datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-" + uuid4().hex[:10],
        "time_utc": datetime.now(timezone.utc).isoformat(),
        "serial": args.serial,
        "package": args.package,
        "permission_allowed": allowed,
        "launcher_foreground": at_home,
        "window_count": len(candidates),
        "app_owned_overlay_windows": candidates,
        "status": status,
        "reason": reason,
        "scope": "Android WindowManager overlay state only; video alpha, animation, drag and voice are not assessed",
        "release_gate": "NOT_CLEARED",
    }
    receipt["record_sha256"] = hashlib.sha256(json.dumps(receipt, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    evidence_root = Path(os.environ.get("FR3K_ANDROID_EVIDENCE_DIR", str(Path.home() / ".local/share/fr3k-emulation-studio/android-runs")))
    out = args.output or (evidence_root / (receipt["run_id"] + "-overlay.json"))
    out.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    out.write_text(json.dumps(receipt, indent=2, sort_keys=True) + "\n")
    out.chmod(0o600)
    print(json.dumps({"status":status,"reason":reason,"app_owned_overlay_windows":len(candidates),"evidence":str(out),
                      "release_gate":"NOT_CLEARED"}, indent=2))
    return 0 if status == "PASS" else 1

if __name__ == "__main__":
    raise SystemExit(main())
