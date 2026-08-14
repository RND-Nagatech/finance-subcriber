#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

run_step() {
  local title="$1"
  local script="$2"
  shift 2

  echo ""
  echo "============================================================"
  echo "$title"
  echo "============================================================"
  "$ROOT_DIR/script-patch/$script" "$@"
}

run_step "1. Patch Master Program" "run-patch-program2.sh" "$@"
run_step "2. Patch Master Subscriber" "run-patch-subscriber2.sh" "$@"
run_step "3. Patch Master Karyawan dari Subscriber" "run-patch-karyawan-from-subscriber.sh" "$@"
run_step "4. Patch Master Group Toko dari Subscriber" "run-patch-group-toko-from-subscriber.sh" "$@"
run_step "5. Patch Subscription Detail + Rekap" "run-patch-subscription-from-detail2.sh" "$@"

echo ""
MODE="DRY-RUN"
for arg in "$@"; do
  if [[ "$arg" == "--apply" ]]; then
    MODE="APPLY"
  fi
done
echo "Selesai. Mode: $MODE"
