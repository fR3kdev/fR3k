#!/usr/bin/env bash
set -euo pipefail
ROOT="${FR3K_GEODE_ROOT:-/mnt/fr3k-models/fr3k-geode-native}"
CODE="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$ROOT" "$ROOT/reference" "$ROOT/logs"
exec > >(tee -a "$ROOT/logs/build-$(date -u +%Y%m%d).log") 2>&1
cd "$CODE"
python3 -m unittest discover -s tests -v
python3 geode_native.py inspect --reference "$ROOT/reference"
python3 geode_native.py stage --reference "$ROOT/reference" --base-dir "$ROOT/base/Q4"
python3 geode_native.py verify-base --reference "$ROOT/reference" --base-dir "$ROOT/base/Q4"
python3 geode_native.py build --reference "$ROOT/reference" --base-dir "$ROOT/base/Q4" --output "$ROOT/output/Q4"
python3 geode_native.py verify-output --reference "$ROOT/reference" --output "$ROOT/output/Q4"
printf 'CONVERSION_OUTPUT_READY_FOR_HARDWARE_TEST %s\n' "$(date -u +%FT%TZ)"
