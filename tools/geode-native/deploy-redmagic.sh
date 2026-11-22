#!/usr/bin/env bash
# Fail-closed REDMAGIC native Geode pack staging. Never changes the current default.
set -eo pipefail
mode="$1"; [ -n "$mode" ] || mode="preflight"
pack="$GEODE_PACK_DIR"; [ -n "$pack" ] || pack="/mnt/fr3k-models/fr3k-geode-native/output/Q4"
serial="$ADB_SERIAL"
folder="/sdcard/Download/FR3K-Geode-Abliterated-Q4-V2"
die(){ printf 'BLOCKED: %s\n' "$*" >&2; exit 2; }
[[ "$mode" == preflight || "$mode" == stage ]] || die "use preflight or stage"
# Enforce a single authoritative writer for this pack, across scheduled/manual jobs.
# flock releases on process exit or termination; lock is outside the model folder.
if [[ "$mode" == stage ]]; then
    command -v flock >/dev/null 2>&1 || die "flock is required for model staging"
    exec 9>"${pack%/}.fr3k-stage.lock"
    flock -n 9 || die "a second transfer worker is already active"
    echo "STAGING_LEASE_ACQUIRED"
fi
[[ -f "$pack/geode.json" ]] || die "no complete geode.json at $pack"
[[ ! -e "$pack/INCOMPLETE" ]] || die "conversion still marked INCOMPLETE"
# A complete-looking file set is insufficient: pin this *specific* V2 derivative.
# The journal remains after finalization; require it, complete layers and exact provenance.
[[ -f "$pack/fr3k-progress.json" ]] || die "missing source-pinned V2 conversion journal"
python3 - "$pack" <<'PY'
import json, pathlib, sys
p=pathlib.Path(sys.argv[1])
journal=json.loads((p/'fr3k-progress.json').read_text())
manifest=json.loads((p/'geode.json').read_text())
layers=journal.get('completed_layers')
if not isinstance(layers,list) or any(type(x) is not int for x in layers) or sorted(layers)!=list(range(40)):
    raise SystemExit('BLOCKED: V2 conversion journal is not 40/40')
prov=manifest.get('fr3k_provenance')
if not isinstance(prov,dict):
    raise SystemExit('BLOCKED: missing FR3K V2 provenance')
if prov.get('source_repo') != 'wangzhang/Qwen3.6-35B-A3B-abliterated-v2':
    raise SystemExit('BLOCKED: wrong derivative source')
for k in ('source_revision','base_revision'):
    v=journal.get(k)
    if not isinstance(v,str) or len(v)!=40 or any(c not in '0123456789abcdef' for c in v.lower()):
        raise SystemExit('BLOCKED: invalid revision '+k)
    if prov.get(k)!=v:
        raise SystemExit('BLOCKED: revision mismatch '+k)
if prov.get('status') != 'CONVERSION_OUTPUT_UNVERIFIED_ON_DEVICE':
    raise SystemExit('BLOCKED: unexpected lifecycle status')
if manifest.get('source') != prov['source_repo']+'@'+prov['source_revision']:
    raise SystemExit('BLOCKED: manifest source does not match pinned provenance')
print('PROVENANCE_VERIFIED: V2 derivative, 40/40 layers, immutable revisions')
PY
total="$(
python3 - "$pack" <<'PY'
import json, pathlib, sys
p=pathlib.Path(sys.argv[1]); d=json.loads((p/'geode.json').read_text())
if (d.get('format'),d.get('version'),d.get('arch')) != ('geode-pack',1,'qwen35moe'):
    raise SystemExit('BLOCKED: unsupported pack')
files=d.get('files')
if not isinstance(files,list) or not files: raise SystemExit('BLOCKED: missing file manifest')
total=0
for f in files:
    n=f['name']; h=f.get('sha256',''); size=f['size']
    if pathlib.PurePath(n).name!=n or n.startswith('.'): raise SystemExit('BLOCKED: unsafe file path')
    if len(h)!=64 or any(c not in '0123456789abcdef' for c in h.lower()):
        raise SystemExit('BLOCKED: invalid SHA256 for '+n)
    fp=p/n
    if not fp.is_file() or fp.stat().st_size!=size:
        raise SystemExit('BLOCKED: missing or wrong-sized '+n)
    total+=size
print(total)
PY
)" || die "manifest validation failed"
printf 'PACK=%s BYTES=%s\n' "$pack" "$total"
if [[ -z "$serial" && "$mode" == preflight ]]; then
    echo 'PREFLIGHT_FILES_OK: not device-verified; no changes made'
    exit 0
fi
[[ -n "$serial" ]] || die "set ADB_SERIAL to the authorized REDMAGIC ADB serial"
[[ "$(adb -s "$serial" get-state 2>/dev/null || true)" == device ]] || die "ADB not authorized"
model="$(adb -s "$serial" shell getprop ro.product.model | tr -d '\r')"
[[ "$model" == NX809J ]] || die "refusing unexpected device $model"
free_k="$(adb -s "$serial" shell 'df -Pk /data | tail -n 1' | awk '{print $4}' | tr -d '\r')"
[[ "$free_k" =~ ^[0-9]+$ ]] || die "could not establish /data free space"
free_bytes="$((free_k*1024))"
required="$((2*total + 8*1024*1024*1024))"
printf 'MODEL=%s FREE_BYTES=%s REQUIRED_BYTES=%s\n' "$model" "$free_bytes" "$required"
((free_bytes>=required)) || die "not enough space for shared staging and Geode's private import"
[[ "$mode" == stage ]] || { echo 'PREFLIGHT_OK; no changes made'; exit 0; }
python3 - "$pack" <<'PY'
import hashlib, json, pathlib, sys
p=pathlib.Path(sys.argv[1])
for f in json.loads((p/'geode.json').read_text())['files']:
    h=hashlib.sha256()
    with (p/f['name']).open('rb') as src:
        while data:=src.read(8*1024*1024): h.update(data)
    if h.hexdigest().lower()!=f['sha256'].lower():
        raise SystemExit('BLOCKED: local hash mismatch '+f['name'])
print('SOURCE_HASHES_VERIFIED')
PY
adb -s "$serial" shell mkdir -p "$folder"
python3 - "$pack" <<'PY' | while IFS=$'\t' read -r name sha; do
import json,pathlib,sys
for f in json.loads((pathlib.Path(sys.argv[1])/'geode.json').read_text())['files']:
    print(f["name"]+"\t"+f["sha256"])
PY
    remote="$folder/$name"
    have="$(adb -s "$serial" shell "sha256sum '$remote' 2>/dev/null" | awk '{print $1}' | tr -d '\r' || true)"
    if [[ "$have" == "$sha" ]]; then echo "SKIP_VERIFIED $name"; continue; fi
    adb -s "$serial" push "$pack/$name" "$remote.uploading"
    got="$(adb -s "$serial" shell "sha256sum '$remote.uploading'" | awk '{print $1}' | tr -d '\r')"
    [[ "$got" == "$sha" ]] || die "device hash mismatch $name"
    adb -s "$serial" shell mv "$remote.uploading" "$remote"
    echo "DEVICE_VERIFIED $name"
done
adb -s "$serial" push "$pack/geode.json" "$folder/geode.json.uploading"
expected="$(sha256sum "$pack/geode.json" | awk '{print $1}')"
actual="$(adb -s "$serial" shell "sha256sum '$folder/geode.json.uploading'" | awk '{print $1}' | tr -d '\r')"
[[ "$actual" == "$expected" ]] || die "device manifest mismatch"
adb -s "$serial" shell mv "$folder/geode.json.uploading" "$folder/geode.json"
echo "STAGED_HASH_VERIFIED=$folder"
echo "NEXT: Geode > Models > Import folder; wait for its app-private copy and verification."
echo "DO NOT CHANGE DEFAULT until real Geode text + vision + MTP + GPU/NPU tests pass."
