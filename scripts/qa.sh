#!/usr/bin/env bash
# Run the Phase 4 combat-rules lock (task 4.6).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
exec node --test tests/combat.test.js
