#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

TS_NODE_TRANSPILE_ONLY=1 \
NODE_PATH="$ROOT_DIR/new-be/node_modules" \
"$ROOT_DIR/new-be/node_modules/.bin/ts-node" \
  -P "$ROOT_DIR/new-be/tsconfig.json" \
  "$ROOT_DIR/script-patch/patch_legacy_subscriber2.ts" \
  "$@"
