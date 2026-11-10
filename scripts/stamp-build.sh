#!/usr/bin/env bash
# Stamp the same BUILD id into version.json, index.html, and sw.js.
# Run from (or pass) the site root immediately before each deploy / commit.
#   ./scripts/stamp-build.sh
#   ./scripts/stamp-build.sh /path/to/xscape-site
#   BUILD=custom-id ./scripts/stamp-build.sh
set -euo pipefail
ROOT="${1:-.}"
if [[ ! -f "$ROOT/index.html" || ! -f "$ROOT/sw.js" ]]; then
  echo "stamp-build: $ROOT is missing index.html or sw.js" >&2
  exit 1
fi
if [[ -n "${BUILD:-}" ]]; then
  ID="$BUILD"
else
  ID="$(date -u +%Y%m%d%H%M%S)"
  if git -C "$ROOT" rev-parse --short HEAD >/dev/null 2>&1; then
    ID="${ID}-$(git -C "$ROOT" rev-parse --short HEAD)"
  fi
fi
BUILT_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
python3 - "$ROOT" "$ID" "$BUILT_AT" << 'PY'
import json, re, sys
from pathlib import Path
root, build, built_at = sys.argv[1], sys.argv[2], sys.argv[3]
if not re.fullmatch(r"[A-Za-z0-9._-]+", build):
    raise SystemExit("invalid BUILD id: " + build)
(Path(root) / "version.json").write_text(
    json.dumps({"build": build, "builtAt": built_at}, indent=2) + "\n"
)
index = Path(root) / "index.html"
it = index.read_text()
it2, n = re.subn(
    r'(window\.XSCAPE_BUILD\s*=\s*")[^"]*(")',
    r"\g<1>" + build + r"\2",
    it,
    count=1,
)
if n != 1:
    raise SystemExit("index.html: expected exactly one window.XSCAPE_BUILD assignment")
index.write_text(it2)
sw = Path(root) / "sw.js"
st = sw.read_text()
st2, n = re.subn(
    r'(var BUILD\s*=\s*")[^"]*(")',
    r"\g<1>" + build + r"\2",
    st,
    count=1,
)
if n != 1:
    raise SystemExit("sw.js: expected exactly one var BUILD assignment")
sw.write_text(st2)
print("Stamped BUILD=%s into %s (version.json, index.html, sw.js)" % (build, root))
PY
