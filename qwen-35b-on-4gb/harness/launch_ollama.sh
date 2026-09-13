#!/usr/bin/env bash
# launch_ollama.sh — boot one Ollama config by creating a derivative model with custom params,
# then pre-loading it into VRAM. Ollama 0.22 uses llama.cpp internally and supports --n-cpu-moe
# semantics via offload_to_cpu_moe in modelfile (or via OLLAMA_NUM_PARALLEL etc).
#
# Knob mapping (Ollama → video flag):
#   num_gpu           → --n-gpu-layers
#   num_ctx           → --ctx-size
#   use_mmap=false    → --no-mmap
#   use_mlock=true    → --mlock
#   OLLAMA_KV_CACHE_TYPE env (q8_0/q4_0/f16)  → --cache-type-k/v
#
# n-cpu-moe equivalent: Ollama auto-offloads experts when num_gpu < total_layers.
# To control more precisely we set num_gpu to (total_layers - n_cpu_moe + 1).
# Qwen3.6-35B-A3B has 48 transformer layers (verify in logs).

set -euo pipefail

BASE_MODEL="${BASE_MODEL:-huihui_ai/Qwen3.6-abliterated:35b-a3b}"
DERIV_NAME="${DERIV_NAME:-qwenbench:current}"
NUM_GPU="${NUM_GPU:-1}"        # GPU layer count
NUM_CTX="${NUM_CTX:-8192}"
USE_MMAP="${USE_MMAP:-true}"
USE_MLOCK="${USE_MLOCK:-true}"
KV_TYPE="${KV_TYPE:-q8_0}"     # q8_0 / q4_0 / f16

TMPF="$(mktemp -t modelfile.XXXX)"
cat > "$TMPF" <<EOF
FROM ${BASE_MODEL}
PARAMETER num_ctx ${NUM_CTX}
PARAMETER use_mmap ${USE_MMAP}
PARAMETER use_mlock ${USE_MLOCK}
EOF
if [ "${NUM_GPU}" != "-1" ]; then
  echo "PARAMETER num_gpu ${NUM_GPU}" >> "$TMPF"
fi

# stop any running model
curl -fsS -X POST http://127.0.0.1:11434/api/generate \
  -d "{\"model\":\"${DERIV_NAME}\",\"keep_alive\":0}" >/dev/null 2>&1 || true

# set KV cache type via service env (requires ollama restart for new value to take)
EXPECTED_ENV="OLLAMA_KV_CACHE_TYPE=${KV_TYPE}"
CURRENT="$(systemctl show ollama -p Environment --value 2>/dev/null || true)"
if ! echo "$CURRENT" | grep -q "$EXPECTED_ENV"; then
  # This benchmark changes the system Ollama service. Configure passwordless
  # sudo for only these service-management commands, or run interactively.
  sudo systemctl stop ollama
  sudo install -d /etc/systemd/system/ollama.service.d
  sudo tee /etc/systemd/system/ollama.service.d/kv.conf >/dev/null <<EOC
[Service]
Environment="OLLAMA_KV_CACHE_TYPE=${KV_TYPE}"
Environment="OLLAMA_FLASH_ATTENTION=1"
Environment="OLLAMA_KEEP_ALIVE=10m"
EOC
  sudo systemctl daemon-reload
  sudo systemctl start ollama
  for i in 1 2 3 4 5 6 7 8; do
    sleep 2
    curl -fsS http://127.0.0.1:11434/api/version >/dev/null 2>&1 && break
  done
fi

# create derivative
ollama create "${DERIV_NAME}" -f "$TMPF" >/dev/null 2>&1
rm -f "$TMPF"

# preload (sends empty prompt with keep_alive)
PRELOAD_RESP="$(curl -fsS -X POST http://127.0.0.1:11434/api/generate \
  -d "{\"model\":\"${DERIV_NAME}\",\"keep_alive\":\"10m\",\"prompt\":\"\"}")"
echo "PRELOADED:${DERIV_NAME}"
