#!/usr/bin/env bash
# Diagnose why tippecanoe aborts partway through trails-tagged.{geojsonseq,geojsonl}
# with "Expected a comma, not a list item". Run this on the host (not inside
# Docker). It prints raw bytes around the failing line, scans for stray
# control chars, and counts strict-JSON failures across the whole file.
#
# Usage: ./diagnose-trails-tagged.sh [path-to-file]
#   default: ~/Documents/PRJ/2026/spatialData/.trails-build-cache/trails-tagged.geojsonseq

set -euo pipefail

DEFAULT_FILE="$HOME/Documents/PRJ/2026/spatialData/.trails-build-cache/trails-tagged.geojsonseq"
FILE="${1:-$DEFAULT_FILE}"
# Pulled from your tippecanoe error. Override on the command line if a
# new run reports a different line.
BAD_LINE="${BAD_LINE:-17548}"

if [[ ! -f "$FILE" ]]; then
  echo "ERROR: file not found: $FILE"
  echo "Pass the path as arg 1, or check the cache dir."
  exit 1
fi

hr() { printf '\n──── %s ────\n' "$*"; }

hr "file basics"
ls -lh "$FILE"
echo "total lines: $(wc -l < "$FILE")"

hr "image build sanity (does the running image know about .geojsonl?)"
if command -v docker >/dev/null && docker image inspect silkymaps-bake >/dev/null 2>&1; then
  docker run --rm silkymaps-bake sh -c 'grep -E "^TAGGED_|^THRU_" /work/build.sh' \
    || echo "(could not grep build.sh — image may be missing the file)"
else
  echo "(silkymaps-bake image not present — skipping)"
fi

hr "line $BAD_LINE — length and tail"
LEN=$(awk -v n="$BAD_LINE" 'NR==n {print length($0); exit}' "$FILE")
echo "length: ${LEN:-<line not found>}"
echo "last 300 chars of the line:"
awk -v n="$BAD_LINE" 'NR==n' "$FILE" | tail -c 300
echo

hr "raw bytes spanning lines $((BAD_LINE - 1)) → $((BAD_LINE + 1))"
# `od -c` shows printable + escape sequences for control chars (\n, \t, \036
# for RS, etc.) so a missing newline or stray RS is visible.
awk -v lo="$((BAD_LINE - 1))" -v hi="$((BAD_LINE + 1))" \
  'NR>=lo && NR<=hi' "$FILE" | od -c | head -60

hr "0x1e (record separator) chars anywhere in the file?"
RS_COUNT=$(LC_ALL=C grep -c $'\x1e' "$FILE" 2>/dev/null || echo 0)
echo "RS char count: $RS_COUNT"
if [[ "$RS_COUNT" -gt 0 ]]; then
  echo "first occurrence:"
  LC_ALL=C grep -nm1 $'\x1e' "$FILE" | head -c 300; echo
fi

hr "first line failing strict JSON (rejects NaN / Infinity)"
# Python's `parse_constant` fires for the literals NaN, Infinity, -Infinity
# that Python normally accepts but tippecanoe (strict JSON) rejects. We
# also flag any structural parse failure.
python3 - "$FILE" <<'PY'
import json, sys
def strict(x): raise ValueError(f"forbidden constant: {x}")
path = sys.argv[1]
n = bad = 0
first_bad = None
nan_lines = 0
with open(path) as f:
    for i, line in enumerate(f, 1):
        n += 1
        try:
            json.loads(line, parse_constant=strict)
        except ValueError as e:
            bad += 1
            if "forbidden constant" in str(e):
                nan_lines += 1
            if first_bad is None:
                first_bad = i
                print(f"first bad: line {i}")
                print(f"  error  : {str(e)[:120]}")
                print(f"  length : {len(line)}")
                print(f"  preview: {line[:240]!r}")
                if len(line) > 240:
                    print(f"  tail   : {line[-200:]!r}")
        except Exception as e:
            bad += 1
            if first_bad is None:
                first_bad = i
                print(f"first bad: line {i}")
                print(f"  error  : {type(e).__name__}: {str(e)[:120]}")
                print(f"  preview: {line[:240]!r}")
print()
print(f"total lines : {n:,}")
print(f"strict-bad  : {bad:,}")
print(f"  of which NaN/Infinity: {nan_lines:,}")
PY

hr "isolation test (writes a 200-line window to /tmp and hands it to tippecanoe)"
WIN_LO=$((BAD_LINE - 100))
WIN_HI=$((BAD_LINE + 100))
WIN_FILE="/tmp/trails-window.geojsonl"
awk -v lo="$WIN_LO" -v hi="$WIN_HI" 'NR>=lo && NR<=hi' "$FILE" > "$WIN_FILE"
echo "wrote $(wc -l < "$WIN_FILE") lines to $WIN_FILE"
if command -v docker >/dev/null && docker image inspect silkymaps-bake >/dev/null 2>&1; then
  echo "running tippecanoe on the window…"
  docker run --rm -v /tmp:/tmp --entrypoint tippecanoe silkymaps-bake \
    -o /tmp/trails-window.pmtiles -l trails -z13 --force "$WIN_FILE" 2>&1 \
    | tail -20 || true
else
  echo "(skipping — docker / silkymaps-bake image not available)"
fi

echo
echo "Done."
