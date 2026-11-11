#!/usr/bin/env bash
# Stamp the same BUILD id into version.json, index.html, and sw.js.
# Run from (or pass) the site root immediately before each deploy / commit.
#   ./scripts/stamp-build.sh
#   ./scripts/stamp-build.sh /path/to/xscape-site
#   BUILD=custom-id ./scripts/stamp-build.sh
# Tags use UTC (YYYYMMDDHHMMSS) so they sort by time. builtAt is UTC with a Z.
set -euo pipefail
ROOT="${1:-.}"
if [[ ! -f "$ROOT/index.html" || ! -f "$ROOT/sw.js" ]]; then
  echo "stamp-build: $ROOT is missing index.html or sw.js" >&2
  exit 1
fi
utc_stamp() { date -u +%Y%m%d%H%M%S; }
short_hash() {
  if git -C "$ROOT" rev-parse --short=7 HEAD >/dev/null 2>&1; then
    git -C "$ROOT" rev-parse --short=7 HEAD
  fi
}
if [[ -n "${BUILD:-}" ]]; then
  ID="$BUILD"
  # If the caller passed a YYYYMMDDHHMMSS[-hash] tag, warn when it is not
  # within a few minutes of current UTC (so NY-local stamps don't slip in).
  if [[ "$ID" =~ ^([0-9]{14})([.-].*)?$ ]]; then
    passed="${BASH_REMATCH[1]}"
    now="$(utc_stamp)"
    python3 - "$passed" "$now" << 'PY' || true
import datetime, sys
passed, now = sys.argv[1], sys.argv[2]
def parse(s):
    return datetime.datetime.strptime(s, "%Y%m%d%H%M%S").replace(tzinfo=datetime.timezone.utc)
try:
    delta = abs((parse(passed) - parse(now)).total_seconds())
except ValueError:
    sys.exit(0)
if delta > 5 * 60:
    mins = int(round(delta / 60))
    sys.stderr.write(
        "stamp-build: warning: BUILD timestamp %s is %s minutes off current UTC %s.\n"
        "  Tags should use UTC so they sort by time. Example:\n"
        "  BUILD=\"$(date -u +%%Y%%m%%d%%H%%M%%S)-$(git rev-parse --short=7 HEAD)\" ./scripts/stamp-build.sh .\n"
        % (passed, mins, now)
    )
PY
  fi
else
  ID="$(utc_stamp)"
  hash="$(short_hash)"
  if [[ -n "$hash" ]]; then
    ID="${ID}-${hash}"
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
