#!/usr/bin/env python3
"""FR3K Emulation Studio: bounded offline capability/test runner (stdlib only).

No arbitrary shell, Docker privilege escalation, image downloads or live ports.
PLANNED/BLOCKED profiles never report test PASS.
"""
import argparse
import hashlib
import json
import os
import platform
import resource
import shutil
import socket
import subprocess
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

BASE = Path(__file__).resolve().parent
CATALOG = BASE / "profiles.json"
EVIDENCE_DIR = Path(os.environ.get("FR3K_EMUL_EVIDENCE_DIR", str(Path.home() / ".local/share/fr3k-emulation-studio/runs")))


def canonical(obj):
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def sha(obj):
    return hashlib.sha256(canonical(obj)).hexdigest()


def catalog():
    data = json.loads(CATALOG.read_text())
    if data.get("schema_version") != 1:
        raise RuntimeError("Unknown catalog schema")
    ids = [x["id"] for x in data["profiles"]]
    if len(ids) != len(set(ids)):
        raise RuntimeError("Duplicate profile IDs")
    return data


def host():
    try:
        mem = {}
        for line in Path("/proc/meminfo").read_text().splitlines():
            if line.startswith(("MemTotal:", "MemAvailable:")):
                key, number, *_ = line.split()
                mem[key[:-1]] = int(number) // 1024
    except (OSError, ValueError):
        mem = {}
    try:
        d = shutil.disk_usage(str(Path.home()))
        free_mb = d.free // 1024 // 1024
    except OSError:
        free_mb = None
    return {
        "hostname": socket.gethostname(),
        "system": platform.system(),
        "machine": platform.machine(),
        "python": platform.python_version(),
        "cpu_count": os.cpu_count(),
        "memory_mib": mem,
        "disk_free_mib": free_mb,
        "kvm_accessible": os.access("/dev/kvm", os.R_OK | os.W_OK),
        "docker_socket_accessible": os.access("/var/run/docker.sock", os.R_OK | os.W_OK),
        "emulators_present": {x: bool(shutil.which(x)) for x in [
            "qemu-aarch64", "qemu-arm", "qemu-ppc64le", "qemu-s390x",
            "qemu-system-aarch64", "qemu-system-x86_64", "qemu-system-riscv64",
            "renode", "adb", "docker"]},
    }


# Deliberately fixed commands. Profiles are DATA, not executable user input.
RUNNERS = {
    "linux-amd64-native": [
        sys.executable, "-c",
        "import platform,sys; assert platform.system()=='Linux' and platform.machine() in ('x86_64','AMD64'); print('LINUX_AMD64_OK')"],
    "python-host-smoke": [
        sys.executable, "-c",
        "import ssl,subprocess,json,platform; assert ssl.OPENSSL_VERSION; assert subprocess.run(['true'],check=False).returncode==0; print('PYTHON_TLS_PROCESS_OK')"],
    "sandbox-controls": [
        sys.executable, "-c",
        "import os,resource; assert resource.getrlimit(resource.RLIMIT_CPU)[0] <= 15; print('BOUNDED_SUBPROCESS_OK')"],
}


def state(profile, facts):
    if profile["status"] != "ready":
        return "BLOCKED", "no verified runner; " + ", ".join(profile.get("requires", []))
    if profile["engine"] != "native" or profile["id"] not in RUNNERS:
        return "BLOCKED", "runner not implemented"
    if facts["system"] != "Linux":
        return "BLOCKED", "native runner requires Linux"
    if profile["id"] == "linux-amd64-native" and facts["machine"] not in ("x86_64", "AMD64"):
        return "BLOCKED", "host architecture mismatch"
    return "READY", "fixed native smoke runner available"


def limits():
    resource.setrlimit(resource.RLIMIT_CPU, (10, 10))
    resource.setrlimit(resource.RLIMIT_AS, (256 * 1024 * 1024, 256 * 1024 * 1024))
    resource.setrlimit(resource.RLIMIT_NOFILE, (64, 64))
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))


def record(profile, facts, status, reason, result):
    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True, mode=0o700)
    identifier = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-" + uuid.uuid4().hex
    base = {
        "schema_version": 1, "run_id": identifier,
        "observed_at_utc": datetime.now(timezone.utc).isoformat(),
        "profile_id": profile["id"], "family": profile["family"],
        "architecture": profile["architecture"], "engine": profile["engine"],
        "status": status, "reason": reason, "host": facts,
        "catalog_sha256": hashlib.sha256(CATALOG.read_bytes()).hexdigest(),
        "test": result,
    }
    base["record_sha256"] = sha(base)
    target = EVIDENCE_DIR / (identifier + ".json")
    with target.open("x", encoding="utf-8") as out:
        os.chmod(target, 0o600)
        json.dump(base, out, indent=2, sort_keys=True)
        out.write("\n")
    return base


def execute(profile, facts):
    verdict, reason = state(profile, facts)
    if verdict != "READY":
        return record(profile, facts, "BLOCKED", reason, {"attempted": False})
    cmd = RUNNERS[profile["id"]]
    started = time.monotonic()
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, errors="replace",
                              timeout=20, preexec_fn=limits, shell=False, cwd=str(BASE),
                              env={"PATH": os.defpath, "LANG": "C.UTF-8"})
        output = {"attempted": True, "argv": cmd, "returncode": proc.returncode,
                  "stdout": proc.stdout[:4096], "stderr": proc.stderr[:4096],
                  "duration_ms": round((time.monotonic() - started) * 1000)}
        return record(profile, facts, "PASS" if proc.returncode == 0 else "FAIL",
                      "process completed" if proc.returncode == 0 else "nonzero process exit", output)
    except (OSError, subprocess.TimeoutExpired) as ex:
        return record(profile, facts, "FAIL", type(ex).__name__,
                      {"attempted": True, "error": str(ex)[:512],
                       "duration_ms": round((time.monotonic() - started) * 1000)})


def verify(path):
    record_data = json.loads(path.read_text())
    asserted = record_data.pop("record_sha256", "")
    actual = sha(record_data)
    return {"file": str(path), "integrity": "VERIFIED" if asserted == actual else "TAMPERED",
            "run_id": record_data.get("run_id"), "test_status": record_data.get("status"),
            "catalog_fingerprint_present": bool(record_data.get("catalog_sha256"))}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="action", required=True)
    commands.add_parser("probe")
    commands.add_parser("matrix")
    runner = commands.add_parser("run")
    runner.add_argument("profile_id")
    commands.add_parser("suite")
    checker = commands.add_parser("verify")
    checker.add_argument("run_id")
    commands.add_parser("report")
    args = parser.parse_args()
    facts = host()
    if args.action == "probe":
        print(json.dumps(facts, indent=2, sort_keys=True))
        return 0
    if args.action == "verify":
        requested = args.run_id
        if "/" in requested or "\\" in requested or requested in (".", ".."):
            parser.error("run_id must be a basename")
        artifact = EVIDENCE_DIR / (requested if requested.endswith(".json") else requested + ".json")
        if not artifact.is_file():
            parser.error("evidence record not found")
        found = verify(artifact)
        print(json.dumps(found, indent=2))
        return 0 if found["integrity"] == "VERIFIED" else 1
    if args.action == "report":
        records = sorted(EVIDENCE_DIR.glob("*.json"), reverse=True)[:50] if EVIDENCE_DIR.exists() else []
        print(json.dumps({"recent_records": [verify(p) for p in records]}, indent=2))
        return 0
    profiles = catalog()["profiles"]
    if args.action == "matrix":
        print(json.dumps([{**p, "observed_state": state(p, facts)[0],
                           "reason": state(p, facts)[1]} for p in profiles], indent=2))
        return 0
    if args.action == "run":
        matching = [p for p in profiles if p["id"] == args.profile_id]
        if not matching:
            parser.error("unknown profile")
        outcomes = [execute(matching[0], facts)]
    else:
        outcomes = [execute(p, facts) for p in profiles if p["status"] == "ready"]
    summary = {"results": [{"run_id": r["run_id"], "profile": r["profile_id"],
                            "status": r["status"], "record_sha256": r["record_sha256"]}
                           for r in outcomes],
               "passed": sum(r["status"] == "PASS" for r in outcomes),
               "failed": sum(r["status"] == "FAIL" for r in outcomes),
               "blocked": sum(r["status"] == "BLOCKED" for r in outcomes),
               "unattempted_profiles": len(profiles) - len(outcomes) if args.action == "suite" else None}
    print(json.dumps(summary, indent=2))
    return 1 if summary["failed"] else (2 if args.action == "run" and summary["blocked"] else 0)


if __name__ == "__main__":
    sys.exit(main())
